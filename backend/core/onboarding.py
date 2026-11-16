# ======================================================================
# ANCHOR: onboarding.py
# FILE: backend/core/onboarding.py
# ROLE: Versioned developer-strength question set, answer validation and onboarding state.
# SEE:  PRD.md §5.4, §8.2 "Developer strengths"; docs/Teaming.md
# ======================================================================
import re

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

# * Bump VERSION when questions or option ids change. Old answers keep their version so they stay readable.
STRENGTHS_VERSION = 1
AREAS = [
    ("frontend", "Frontend & UI"), ("backend", "Backend & APIs"), ("mobile", "Mobile apps"),
    ("data", "Data & ML"), ("devops", "DevOps & cloud"), ("design", "UI/UX design"),
    ("security", "Security"), ("testing", "Testing & QA"),
]
QUESTIONS = [
    {"id": "areas", "type": "multi", "min": 1, "max": 3, "required": True,
     "label": "Which areas do you enjoy working on most?", "help": "Pick up to three, favourite first.",
     "options": [{"id": i, "label": l} for i, l in AREAS]},
    {"id": "languages", "type": "multi", "min": 1, "max": 5, "required": True,
     "label": "Which languages are you comfortable with?", "help": "Pick up to five.",
     "options": [{"id": i, "label": l} for i, l in [
         ("javascript", "JavaScript / TypeScript"), ("python", "Python"), ("java", "Java"), ("c_cpp", "C / C++"),
         ("csharp", "C#"), ("go", "Go"), ("php", "PHP"), ("kotlin_swift", "Kotlin / Swift"), ("dart", "Dart"),
         ("sql", "SQL"), ("other", "Something else")]]},
    {"id": "experience", "type": "single", "required": True,
     "label": "How much coding experience do you have?",
     "options": [{"id": "new", "label": "Less than a year"}, {"id": "some", "label": "1–2 years"},
                 {"id": "confident", "label": "More than 2 years"}]},
    {"id": "team_role", "type": "single", "required": True,
     "label": "In a team, what do you usually take on?", "help": "Used to balance groups.",
     "options": [{"id": "builder", "label": "Building features"}, {"id": "planner", "label": "Planning and coordinating"},
                 {"id": "designer", "label": "Designing the interface"}, {"id": "tester", "label": "Testing and reviewing"},
                 {"id": "presenter", "label": "Writing docs and presenting"}]},
    {"id": "goals", "type": "text", "required": False, "max_length": 280,
     "label": "Anything you want to get better at this term?", "help": "Optional. Your supervisor can see this."},
]
AREA_LABELS = dict(AREAS)
MATRIC_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9/._-]{2,29}$")


def validate_strengths(answers):
    """! Server-side contract for strength answers. Returns cleaned answers or raises ValidationError(field errors)."""
    if not isinstance(answers, dict):
        raise ValidationError({"answers": "Send your answers as an object."})
    unknown = set(answers) - {q["id"] for q in QUESTIONS}
    if unknown:
        raise ValidationError({"answers": f"Unknown question: {sorted(unknown)[0]}."})
    clean, errors = {}, {}
    for q in QUESTIONS:
        value = answers.get(q["id"])
        if q["type"] == "multi":
            ids = {o["id"] for o in q["options"]}
            if value is None: value = []
            if not isinstance(value, list) or not all(isinstance(v, str) and v in ids for v in value) or len(set(value)) != len(value):
                errors[q["id"]] = "Choose from the listed options."
            elif q["required"] and len(value) < q["min"]:
                errors[q["id"]] = "Pick at least one."
            elif len(value) > q["max"]:
                errors[q["id"]] = f"Pick at most {q['max']}."
            else:
                clean[q["id"]] = value
        elif q["type"] == "single":
            ids = {o["id"] for o in q["options"]}
            if value in (None, "") and q["required"]:
                errors[q["id"]] = "Choose one option."
            elif value not in (None, "") and value not in ids:
                errors[q["id"]] = "Choose from the listed options."
            elif value:
                clean[q["id"]] = value
        else:
            value = (value or "")
            if not isinstance(value, str):
                errors[q["id"]] = "Enter text."
            elif len(value.strip()) > q["max_length"]:
                errors[q["id"]] = f"Keep it under {q['max_length']} characters."
            elif value.strip():
                clean[q["id"]] = value.strip()
    if errors:
        raise ValidationError(errors)
    return clean


def profile_for(user):
    from .models import OnboardingProfile
    return OnboardingProfile.objects.get_or_create(user=user)[0]


def validate_matric(user, raw):
    """! Matric is required for students and unique (case-insensitive) among students."""
    from .models import User
    matric = (raw or "").strip().upper()
    if not matric:
        raise ValidationError({"matric": "Enter your matriculation number."})
    if not MATRIC_RE.match(matric):
        raise ValidationError({"matric": "Use 3–30 letters, numbers, / . _ or -, for example CSC/2021/045."})
    if User.objects.filter(role="student", matric__iexact=matric).exclude(pk=user.pk).exists():
        raise ValidationError({"matric": "This matriculation number is already registered. Contact your supervisor if it is yours."})
    return matric


def github_state(user):
    identity = user.identities.filter(provider="github").first()
    installs = user.github_installations.filter(active=True, suspended=False)
    return {
        "identity": {"login": identity.login, "id": identity.subject} if identity else None,
        "installations": [{"id": i.installation_id, "account": i.account_login} for i in installs],
    }


def state(user):
    """* The whole onboarding state the UI needs: steps, saved answers, GitHub gate, completion."""
    from django.conf import settings
    prof = profile_for(user)
    student = user.role == "student"
    gh = github_state(user)
    answers = (prof.strengths or {}).get("answers", {})
    profile_done = bool(user.get_full_name().strip()) and (bool(user.matric) if student else True)
    strengths_done = bool(answers.get("areas")) and bool(answers.get("experience"))
    github_done = bool(gh["identity"]) and bool(gh["installations"])
    steps = [{"id": "profile", "done": profile_done}]
    if student:
        steps.append({"id": "strengths", "done": strengths_done})
    steps.append({"id": "github", "done": github_done or (not student and prof.github_skipped),
                  "required": student})
    current = next((s["id"] for s in steps if not s["done"]), "done")
    return {
        "role": user.role,
        "complete": bool(prof.completed) and current == "done",
        "current": current,
        "steps": steps,
        "profile": {"name": user.get_full_name(), "matric": user.matric, "department": user.department},
        "strengths": {"version": (prof.strengths or {}).get("version", STRENGTHS_VERSION), "answers": answers},
        "questions": {"version": STRENGTHS_VERSION, "items": QUESTIONS},
        "github": {**gh, "app_configured": bool(settings.GITHUB_APP_SLUG and settings.GITHUB_APP_ID),
                   "firebase_configured": bool(settings.FIREBASE_PROJECT_ID)},
    }


def finish(user, skip_github=False):
    prof = profile_for(user)
    if skip_github:
        if user.role == "student":
            raise ValidationError({"github": "Students must link GitHub and install the Metis App before continuing."})
        prof.github_skipped = True
        prof.save(update_fields=["github_skipped", "updated"])
    s = state(user)
    if s["current"] != "done":
        raise ValidationError({s["current"]: "Finish this step before continuing."})
    prof.completed = prof.completed or timezone.now()
    prof.save(update_fields=["completed", "updated"])
    return state(user)


def require_ready(user, action="continue"):
    """! Server gate: students must finish onboarding (matric, strengths, GitHub) before enrolling or starting work."""
    if user.role != "student":
        return
    if not state(user)["complete"]:
        raise PermissionDenied(f"Finish onboarding (matric number, strengths and GitHub) before you {action}.")


def primary_area(user):
    prof = getattr(user, "onboarding", None)
    areas = ((prof.strengths or {}).get("answers", {}).get("areas") if prof else None) or []
    return areas[0] if areas else None


def strengths_summary(user):
    prof = getattr(user, "onboarding", None)
    answers = (prof.strengths or {}).get("answers", {}) if prof else {}
    return {"areas": [AREA_LABELS.get(a, a) for a in answers.get("areas", [])],
            "experience": answers.get("experience"), "team_role": answers.get("team_role")}
