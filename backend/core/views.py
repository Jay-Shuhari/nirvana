# ======================================================================
# ANCHOR: views.py
# FILE: backend/core/views.py
# ROLE: All REST endpoints. One function = one URL (wired in core/urls.py).
# SEE:  docs/Architecture.md, .tours/02-request-from-click-to-database.tour
# ======================================================================
import csv
import hashlib
import hmac
import json
import logging
import re
from datetime import date, timedelta

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .ai import review_submission
from .analyzer import analyze, gh
from .github_app import (
    GitHubAppError,
    repositories_for_user,
    token_for_repository,
    verify_installation,
)
from .models import (
    Course,
    CriterionScore,
    GitHubInstallation,
    GitHubInstallState,
    Notification,
    Project,
    Submission,
    Task,
)

User = get_user_model()
logger = logging.getLogger(__name__)

# ANCHOR: Limits
# * Tune these. They stop a student registering endless projects or hammering GitHub.
MAX_PROJECTS_PER_STUDENT = 10
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")

# ANCHOR: Helpers
def notify(user, text, link=""):
    """* Adds an item to a user's in-app inbox (sidebar badge + Notifications page)."""
    Notification.objects.create(user=user, text=text[:240], link=link)
    if settings.EMAIL_NOTIFICATIONS_ENABLED and user.email:
        from django.core.mail import send_mail

        try:
            send_mail(
                "Nirvana notification",
                f"{text[:240]}\n\nOpen Nirvana: {settings.FRONTEND_URL}{link}",
                settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER,
                [user.email],
                fail_silently=False,
            )
        except Exception:
            logger.exception("Could not email notification to user %s", user.pk)

def name_of(u): return u.get_full_name() or u.username

def user_json(u): return {"id": u.id, "name": name_of(u), "email": u.email, "role": u.role, "matric": u.matric}

def score(sub, which="final"):
    """* Total = sum of criterion points. which='final' uses overrides, 'auto' ignores them."""
    if which == "final" and sub.overall_override is not None:
        return round(sub.overall_override)
    return round(sum(getattr(c, which) for c in sub.criteria.all()))

def sub_json(s):
    rubric_items = (s.ai or {}).get("rubric", {}).get("items", [])
    return {"id": s.id, "sha": s.sha, "status": s.status, "error": s.error, "created": s.created,
            "auto_score": score(s, "auto"), "final_score": score(s), "stats": s.metrics.get("stats", {}),
            "evidence": s.evidence, "ai": s.ai, "overall_override": s.overall_override,
            "overall_reason": s.overall_reason,
            "criteria": [{"id": c.id, "name": c.name, "metric": c.metric, "weight": c.weight,
                          "auto": round(c.auto, 1), "override": c.override, "reason": c.reason,
                          "recommendation": next((item for item in rubric_items
                                                  if item.get("criterion") == c.name and item.get("metric") == c.metric), None)}
                         for c in s.criteria.all()]}

def task_brief(t):
    return {"id": t.id, "title": t.title, "description": t.description, "requirements": t.requirements, "due": t.due} if t else None

def project_json(p, full=False, viewer=None):
    latest = next((x for x in p.submissions.all() if x.status == "done"), None)
    d = {"id": p.id, "name": p.name, "repo": p.repo, "student": user_json(p.student), "created": p.created,
         "task": task_brief(p.task), "can_edit": bool(viewer and viewer.id == p.student_id),
         "submission_locked": p.submission_locked,
         "course": {"id": p.course_id, "code": p.course.code, "title": p.course.title,
                    "supervisor": name_of(p.course.supervisor)},
         "latest": sub_json(latest) if latest and not full else None}
    if full: d["submissions"] = [sub_json(s) for s in p.submissions.all()]
    return d

def task_json(t, user=None):
    d = {**task_brief(t), "course": {"id": t.course_id, "code": t.course.code, "title": t.course.title},
         "projects": t.projects.count(),
         "submitted": Submission.objects.filter(project__task=t, status="done").values("project").distinct().count()}
    if user is not None and user.role == "student":
        p = t.projects.filter(student=user).first()
        lat = p and next((x for x in p.submissions.all() if x.status == "done"), None)
        d["project"] = {"id": p.id, "score": score(lat) if lat else None} if p else None
    return d

def can_see(u, p):
    """! SECURITY: only the owning student or the course supervisor may open a project."""
    return p.student_id == u.id or p.course.supervisor_id == u.id

def norm_repo(raw):
    """* Accepts owner/name or a full GitHub URL; returns owner/name or raises a friendly error."""
    r = (raw or "").strip().replace("https://github.com/", "").replace("http://github.com/", "")
    r = r.removesuffix(".git").strip("/")
    if not REPO_RE.match(r): raise ValidationError("Enter the repository as owner/name, for example jane-doe/my-app.")
    return r

def check_repo(repo, user=None, installation_id=None):
    """! Fail at REGISTRATION (not at submit) when the repo is missing, private or GitHub is unreachable."""
    try:
        app_token = token_for_repository(user, repo, installation_id) if user else None
        if installation_id and not app_token:
            raise ValidationError("This repository is not available to the selected GitHub App installation.")
        gh(f"/repos/{repo}", token=app_token)
        return app_token
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 0
        if code == 404: raise ValidationError("Repository not found. Check the spelling, or it may be private.")
        if code in (401, 403): raise ValidationError("GitHub refused the request (bad token or rate limit). Ask your admin to check GITHUB_TOKEN.")
        raise ValidationError(f"GitHub returned an error ({code}).")
    except requests.RequestException:
        raise ValidationError("Could not reach GitHub. Check the internet connection.")
    except GitHubAppError as e:
        raise ValidationError(str(e))

# ANCHOR: Authentication
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    d = request.data
    email = (d.get("email") or "").strip().lower()
    if "@" not in email: raise ValidationError("Enter a valid email address.")
    if User.objects.filter(username=email).exists(): raise ValidationError("That email is already registered.")
    if len(d.get("password", "")) < 8: raise ValidationError("Password must be at least 8 characters.")
    # TODO: stop anyone choosing role=supervisor - add an invite code or admin approval.
    u = User.objects.create_user(username=email, email=email, password=d["password"],
        first_name=(d.get("name") or "").strip(), role="supervisor" if d.get("role") == "supervisor" else "student",
        matric=d.get("matric", ""), department=d.get("department", ""))
    return Response(user_json(u), status=201)

# ANCHOR: Profile and settings
@api_view(["GET", "PATCH"])
def me(request):
    u = request.user
    if request.method == "PATCH":
        d = request.data
        name = (d.get("name") or "").strip()
        if not name: raise ValidationError("Name cannot be empty.")
        u.first_name, u.last_name = name[:150], ""
        u.department = (d.get("department") or "")[:80]
        if u.role == "student": u.matric = (d.get("matric") or "")[:30]
        u.save()
    return Response({**user_json(u), "department": u.department, "unread": u.notifications.filter(read=False).count()})

@api_view(["POST"])
def change_password(request):
    u, d = request.user, request.data
    if not u.check_password(d.get("old", "")): raise ValidationError("Current password is incorrect.")
    if len(d.get("new", "")) < 8: raise ValidationError("New password must be at least 8 characters.")
    u.set_password(d["new"]); u.save()
    return Response({"ok": True})

# ANCHOR: Notifications
@api_view(["GET"])
def notifications(request):
    return Response([{"id": n.id, "text": n.text, "link": n.link, "read": n.read, "created": n.created}
                     for n in request.user.notifications.all()[:50]])

@api_view(["POST"])
def notifications_read(request):
    request.user.notifications.filter(read=False).update(read=True)
    return Response({"ok": True})

# ANCHOR: GitHub App
@api_view(["POST"])
def github_install_start(request):
    if not settings.GITHUB_APP_SLUG or not settings.GITHUB_APP_ID:
        return Response({"detail": "GitHub App setup is not configured on the backend."}, status=503)
    if not settings.GITHUB_APP_PRIVATE_KEY:
        return Response({"detail": "GitHub App credentials are not configured on the backend."}, status=503)
    state = GitHubInstallState.objects.create(user=request.user)
    url = f"https://github.com/apps/{settings.GITHUB_APP_SLUG}/installations/new?state={state.nonce}"
    return Response({"url": url})


def github_install_setup(request):
    state_value = request.GET.get("state", "")
    installation_id = request.GET.get("installation_id", "")
    if request.GET.get("setup_action") != "install" or not installation_id or not state_value:
        return HttpResponse("GitHub installation was not completed.", status=400)
    try:
        state = GitHubInstallState.objects.get(
            nonce=state_value,
            consumed=False,
            created__gte=timezone.now() - timedelta(minutes=15),
        )
        installation_id = int(installation_id)
        verify_installation(installation_id)
    except (GitHubInstallState.DoesNotExist, TypeError, ValueError):
        return HttpResponse("GitHub installation state is invalid or expired.", status=400)
    except (GitHubAppError, requests.RequestException):
        logger.exception("Could not verify GitHub installation %s", installation_id)
        return HttpResponse("Could not verify this GitHub installation.", status=502)

    state.consumed = True
    state.save(update_fields=["consumed"])
    GitHubInstallation.objects.update_or_create(
        installation_id=installation_id,
        defaults={"user": state.user, "active": True, "suspended": False},
    )
    return HttpResponseRedirect(f"{settings.FRONTEND_URL}/settings?github=connected")


@api_view(["GET"])
def github_repositories(request):
    try:
        return Response(repositories_for_user(request.user))
    except (GitHubAppError, requests.RequestException):
        logger.exception("Could not list GitHub repositories for user %s", request.user.pk)
        return Response({"detail": "Could not load repositories from GitHub."}, status=502)
@csrf_exempt
@require_POST
def github_webhook(request):
    if not settings.GITHUB_WEBHOOK_SECRET:
        return JsonResponse({"detail": "Webhook secret is not configured."}, status=503)
    signature = request.headers.get("X-Hub-Signature-256", "")
    digest = hmac.new(
        settings.GITHUB_WEBHOOK_SECRET.encode(),
        request.body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, f"sha256={digest}"):
        return JsonResponse({"detail": "Invalid webhook signature."}, status=403)
    try:
        payload = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"detail": "Invalid webhook JSON."}, status=400)
    if request.headers.get("X-GitHub-Event") != "installation":
        return JsonResponse({"ok": True})
    installation_id = payload.get("installation", {}).get("id")
    action = payload.get("action")
    if not installation_id or action not in {"deleted", "suspend", "unsuspend"}:
        return JsonResponse({"ok": True})
    installations = GitHubInstallation.objects.filter(installation_id=installation_id)
    if action == "deleted":
        installations.delete()
    elif action == "suspend":
        installations.update(suspended=True)
    else:
        installations.update(suspended=False, active=True)
    return JsonResponse({"ok": True})

# ANCHOR: Courses
@api_view(["GET", "POST"])
def courses(request):
    u = request.user
    if request.method == "POST":
        if u.role != "supervisor": raise PermissionDenied()
        code, title = (request.data.get("code") or "").strip(), (request.data.get("title") or "").strip()
        if not code or not title: raise ValidationError("Course code and title are required.")
        c = Course.objects.create(supervisor=u, code=code[:20], title=title[:120])
        return Response({"id": c.id, "join_code": c.join_code}, status=201)
    qs = Course.objects.filter(supervisor=u) if u.role == "supervisor" else u.enrolled.all()
    return Response([{"id": c.id, "code": c.code, "title": c.title, "session": c.session, "supervisor": name_of(c.supervisor),
                      "join_code": c.join_code if u.role == "supervisor" else None,
                      "students": c.students.count(), "rubric": c.rubric} for c in qs])

@api_view(["POST"])
def join_course(request):
    c = Course.objects.filter(join_code=(request.data.get("code") or "").strip().upper()).first()
    if not c: raise ValidationError("Invalid join code.")
    if c.students.filter(pk=request.user.pk).exists(): raise ValidationError("You already joined this course.")
    c.students.add(request.user)
    notify(c.supervisor, f"{name_of(request.user)} joined {c.code}", f"/courses/{c.id}")
    return Response({"id": c.id, "code": c.code})

@api_view(["GET", "DELETE"])
def course_detail(request, pk):
    """* Per-course teacher view: stats, tasks, students. DELETE removes the course and everything in it."""
    c = get_object_or_404(Course, pk=pk, supervisor=request.user)
    if request.method == "DELETE":
        c.delete(); return Response(status=204)
    rows = cohort_rows(c)
    tasks = [task_json(t) for t in c.tasks.select_related("course")]
    students = [{"id": s.id, "name": name_of(s), "email": s.email, "matric": s.matric,
                 "projects": c.projects.filter(student=s).count()} for s in c.students.all()]
    return Response({"course": {"id": c.id, "code": c.code, "title": c.title, "session": c.session,
                                "join_code": c.join_code, "rubric": c.rubric},
                     "stats": {"students": len(students), "tasks": len(tasks), "submitted": len(rows),
                               "average": round(sum(r["score"] for r in rows) / len(rows)) if rows else None,
                               "needs_attention": sum(1 for r in rows if r["flags"] or r["score"] < 55)},
                     "tasks": tasks, "students": students})

# ANCHOR: Rubric
@api_view(["PUT"])
def save_rubric(request, pk):
    c = get_object_or_404(Course, pk=pk, supervisor=request.user)
    r = request.data.get("rubric")
    if not isinstance(r, list) or not r:
        raise ValidationError("Add at least one rubric criterion.")
    try:
        for item in r:
            is_enabled = item.get("enabled", True)
            if not isinstance(is_enabled, bool):
                raise ValueError
            if not isinstance(item, dict):
                raise ValueError
            item["name"] = str(item["name"]).strip()[:80]
            item["metric"] = str(item.get("metric", "custom")).strip()[:40]
            item["weight"] = int(item["weight"])
            item["enabled"] = is_enabled
            if not item["name"] or not 0 <= item["weight"] <= 100:
                raise ValueError
    except (KeyError, TypeError, ValueError):
        raise ValidationError("Each criterion needs a name and a weight from 0 to 100.")
    enabled = [item for item in r if item["enabled"]]
    if not enabled:
        raise ValidationError("Enable at least one rubric criterion.")
    total = sum(item["weight"] for item in enabled)
    if total != 100: raise ValidationError(f"Enabled criteria total {total}%. Their weights must total 100%.")
    c.rubric = r; c.save()
    return Response({"ok": True})

# ANCHOR: Tasks
@api_view(["GET", "POST"])
def tasks(request):
    u = request.user
    if request.method == "POST":
        if u.role != "supervisor": raise PermissionDenied()
        d = request.data
        c = get_object_or_404(Course, pk=d.get("course"), supervisor=u)
        title = (d.get("title") or "").strip()
        if not title: raise ValidationError("Task title is required.")
        due = d.get("due") or None
        if due:
            try: date.fromisoformat(due)
            except ValueError: raise ValidationError("Due date must look like 2026-12-31.")
        reqs = [l.strip()[:300] for l in (d.get("requirements") or "").splitlines() if l.strip()][:20]
        t = Task.objects.create(course=c, title=title[:120], description=(d.get("description") or "")[:2000], requirements=reqs, due=due)
        for s in c.students.all(): notify(s, f"New task in {c.code}: {t.title}", f"/projects/new?task={t.id}")
        return Response(task_json(t), status=201)
    qs = Task.objects.filter(course__supervisor=u) if u.role == "supervisor" else Task.objects.filter(course__students=u)
    return Response([task_json(t, u) for t in qs.select_related("course").order_by("-created")])

@api_view(["GET", "DELETE"])
def task_detail(request, pk):
    """! Deleting a task keeps student projects (task becomes NULL); their evaluations stay."""
    task = get_object_or_404(
        Task.objects.select_related("course"),
        pk=pk,
        **({"course__supervisor": request.user} if request.user.role == "supervisor"
           else {"course__students": request.user}),
    )
    if request.method == "GET":
        students = task.course.students.order_by("first_name", "username")
        if request.user.role == "student":
            students = students.filter(pk=request.user.pk)
        return Response({
            **task_json(task, request.user),
            "description": task.description,
            "requirements": task.requirements,
            "students": [
                {
                    "id": student.id,
                    "name": name_of(student),
                    "matric": student.matric,
                    "project": project_json(project, viewer=request.user)
                    if (project := task.projects.filter(student=student).first()) else None,
                }
                for student in students
            ],
        })
    if request.user.role != "supervisor":
        raise PermissionDenied()
    task.delete()
    return Response(status=204)

# ANCHOR: Projects
@api_view(["GET", "POST"])
def projects(request):
    u = request.user
    if request.method == "POST":
        if u.role != "student": raise PermissionDenied()
        d = request.data
        if d.get("task"):
            t = get_object_or_404(Task, pk=d["task"], course__students=u); c = t.course
        else:
            t, c = None, Course.objects.filter(pk=d.get("course"), students=u).first()
            if not c: raise ValidationError("Join the course first.")
        name = (d.get("name") or "").strip()
        if not name: raise ValidationError("Give the project a name.")
        repo = norm_repo(d.get("repo"))
        if u.projects.count() >= MAX_PROJECTS_PER_STUDENT: raise ValidationError(f"You can have at most {MAX_PROJECTS_PER_STUDENT} projects. Delete one first.")
        if t and u.projects.filter(task=t).exists(): raise ValidationError("You already registered a project for this task.")
        if Project.objects.filter(course=c, repo__iexact=repo).exists(): raise ValidationError("This repository is already registered in this course.")
        installation_id = d.get("installation_id")
        installation = None
        if installation_id:
            installation = get_object_or_404(
                GitHubInstallation,
                user=u,
                installation_id=installation_id,
                active=True,
                suspended=False,
            )
        check_repo(repo, u, installation.installation_id if installation else None)
        p = Project.objects.create(
            student=u,
            course=c,
            task=t,
            name=name[:120],
            repo=repo,
            github_installation=installation,
        )
        notify(c.supervisor, f"{name_of(u)} registered {p.name}", f"/projects/{p.id}")
        return Response({"id": p.id}, status=201)
    qs = Project.objects.filter(course__supervisor=u) if u.role == "supervisor" else u.projects.all()
    return Response([project_json(p, viewer=u) for p in qs.select_related("course", "student", "task").order_by("-created")])

@api_view(["GET", "PATCH", "DELETE"])
def project_detail(request, pk):
    p = get_object_or_404(Project, pk=pk)
    if not can_see(request.user, p): raise PermissionDenied()
    if request.method != "GET":
        if p.student_id != request.user.id: raise PermissionDenied()  # ! supervisors view but never edit student projects
        if request.method == "DELETE":
            p.delete(); return Response(status=204)
        d = request.data
        name = (d.get("name") or p.name).strip()
        repo = norm_repo(d.get("repo") or p.repo)
        if repo.lower() != p.repo.lower():
            if p.submissions.exists(): raise ValidationError("The repository can't change after a submission. Delete the project and register again.")
            if Project.objects.filter(course=p.course, repo__iexact=repo).exclude(pk=p.pk).exists(): raise ValidationError("This repository is already registered in this course.")
            check_repo(repo, request.user, p.github_installation_id)
        p.name, p.repo = name[:120], repo
        p.save()
    return Response(project_json(p, full=True, viewer=request.user))

# ANCHOR: Submission pipeline
@api_view(["POST"])
def submit(request, pk):
    """* analyze() -> AI requirements/rubric review -> save one CriterionScore per rubric row.
    ? Why synchronous? Simple for v1: the request waits for GitHub (a few seconds).
    TODO: move analyze() to a background worker (Celery/RQ) and poll status from the UI."""
    p = get_object_or_404(Project, pk=pk, student=request.user)
    if p.task and p.task.due and timezone.localdate() > p.task.due:
        raise ValidationError(f"This task's deadline ({p.task.due}) has passed.")
    if p.submission_locked:
        raise ValidationError("This project has already been submitted for evaluation.")
    if not Project.objects.filter(pk=p.pk, submission_locked=False).update(submission_locked=True):
        raise ValidationError("This project has already been submitted for evaluation.")
    p.refresh_from_db()
    s = Submission.objects.create(project=p, status="running")
    try:
        github_token = None
        if p.github_installation_id:
            github_token = token_for_repository(
                request.user, p.repo, p.github_installation_id
            )
            if not github_token:
                raise GitHubAppError("This repository is no longer available to the connected GitHub App.")
        sha, m, evidence, stats = analyze(p.repo, request.data.get("sha"), github_token)
        paths = stats.pop("paths", [])
    except Exception as e:  # ! GitHub/network errors are stored on the submission instead of crashing
        s.status, s.error = "failed", str(e)[:300]; s.save()
        return Response({"id": s.id, "status": "failed", "error": s.error}, status=502)
    s.status = "done"
    s.sha, s.metrics, s.evidence = sha, {"values": m, "stats": stats}, evidence
    enabled_rubric = [item for item in p.course.rubric if item.get("enabled", True)]
    s.ai = review_submission(p.repo, p.task, enabled_rubric, paths, m, evidence, github_token)
    s.save()
    for r in enabled_rubric:
        recommendation = next((item for item in s.ai["rubric"]["items"]
                               if item["criterion"] == r["name"] and item["metric"] == r["metric"]), None)
        if recommendation:
            points = recommendation["score"]
        else:
            v = m.get(r["metric"], 0.5)  # * points = metric (0..1) x criterion weight
            points = round(v * r["weight"], 1)
        CriterionScore.objects.create(submission=s, name=r["name"], metric=r["metric"], weight=r["weight"], auto=points)
    notify(p.course.supervisor, f"{name_of(request.user)} submitted {p.name}: {score(s)}/100", f"/projects/{p.id}")
    return Response(sub_json(s), status=201)

# ANCHOR: Supervisor override
@api_view(["POST"])
def override(request, pk):
    c = get_object_or_404(CriterionScore.objects.select_related("submission__project__course"), pk=pk)
    p = c.submission.project
    if p.course.supervisor_id != request.user.id: raise PermissionDenied()  # ! only that course's supervisor
    try: val = float(request.data["score"])
    except (KeyError, TypeError, ValueError): raise ValidationError("Enter a number for the score.")
    reason = (request.data.get("reason") or "").strip()
    if not reason: raise ValidationError("A reason is required for an override.")  # ! this is what makes overrides trustworthy
    if not 0 <= val <= c.weight: raise ValidationError(f"Score must be between 0 and {c.weight}.")
    c.override, c.reason = val, reason; c.save()
    notify(p.student, f"{name_of(request.user)} adjusted {c.name} on {p.name}", f"/projects/{p.id}")
    return Response(sub_json(c.submission))

@api_view(["POST"])
def override_overall(request, pk):
    s = get_object_or_404(Submission.objects.select_related("project__course"), pk=pk)
    p = s.project
    if p.course.supervisor_id != request.user.id: raise PermissionDenied()
    if s.status != "done": raise ValidationError("Only completed submissions can receive an overall grade override.")
    if "score" not in request.data: raise ValidationError("Enter an overall score or send null to reset the override.")
    value = request.data["score"]
    if value is None:
        s.overall_override, s.overall_reason = None, ""
        s.save(update_fields=["overall_override", "overall_reason"])
        notify(p.student, f"{name_of(request.user)} reset the overall score for {p.name}", f"/projects/{p.id}")
        return Response(sub_json(s))
    if isinstance(value, bool):
        raise ValidationError("Enter a number for the overall score.")
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValidationError("Enter a number for the overall score.")
    reason = (request.data.get("reason") or "").strip()
    if not reason: raise ValidationError("A reason is required for an overall score override.")
    if not 0 <= value <= 100: raise ValidationError("Overall score must be between 0 and 100.")
    s.overall_override, s.overall_reason = value, reason
    s.save(update_fields=["overall_override", "overall_reason"])
    notify(p.student, f"{name_of(request.user)} adjusted the overall score for {p.name}", f"/projects/{p.id}")
    return Response(sub_json(s))

# ANCHOR: Cohort and overview
def status_of(sc): return "Excellent" if sc >= 90 else "Good" if sc >= 75 else "Needs work" if sc >= 55 else "Critical"

def flags_of(s):
    v, st, f = s.metrics.get("values", {}), s.metrics.get("stats", {}), []
    if v.get("tests", 1) < 0.34: f.append("No tests")
    if st.get("longest_gap", 0) >= 10: f.append(f"Inactive {st['longest_gap']} days")
    if v.get("security", 1) == 0: f.append("Possible secret")
    if s.ai and s.ai.get("total") and s.ai["met"] < s.ai["total"] / 2: f.append("Requirements unmet")
    return f

def cohort_rows(course):
    rows = []
    for p in course.projects.select_related("student", "task").all():
        s = next((x for x in p.submissions.all() if x.status == "done"), None)
        if not s: continue
        total = score(s)
        last = (s.metrics.get("stats", {}).get("log") or [{}])[0].get("date", "")
        rows.append({"project": p.id, "student": name_of(p.student), "matric": p.student.matric, "name": p.name,
                     "task": p.task.title if p.task else "", "score": total, "status": status_of(total),
                     "last_commit": last, "flags": flags_of(s), "course": course.code,
                     "criteria": [{"name": c.name, "score": c.final, "weight": c.weight} for c in s.criteria.all()]})
    return sorted(rows, key=lambda r: -r["score"])

@api_view(["GET"])
def cohort(request, pk):
    c = get_object_or_404(Course, pk=pk, supervisor=request.user)  # ! hides other supervisors' courses (404)
    rows, enrolled = cohort_rows(c), c.students.count()
    dist = [sum(lo <= r["score"] <= hi for r in rows) for lo, hi in ((0, 39), (40, 59), (60, 79), (80, 100))]
    return Response({"course": {"id": c.id, "code": c.code, "title": c.title}, "enrolled": enrolled,
        "submitted": len(rows), "pending": max(0, enrolled - len(rows)),
        "average": round(sum(r["score"] for r in rows) / len(rows)) if rows else None,
        "needs_attention": sum(1 for r in rows if r["flags"] or r["score"] < 55), "distribution": dist, "rows": rows})

@api_view(["GET"])
def overview(request):
    """* Teacher's general overview across every course they own."""
    u = request.user
    if u.role != "supervisor": raise PermissionDenied()
    cs, attention, all_rows = [], [], []
    for c in u.courses.all():
        rows = cohort_rows(c); all_rows += rows
        cs.append({"id": c.id, "code": c.code, "title": c.title, "students": c.students.count(), "tasks": c.tasks.count(),
                   "submitted": len(rows), "average": round(sum(r["score"] for r in rows) / len(rows)) if rows else None,
                   "needs_attention": sum(1 for r in rows if r["flags"] or r["score"] < 55)})
        attention += [r for r in rows if r["flags"] or r["score"] < 55]
    recent = Submission.objects.filter(project__course__supervisor=u, status="done").select_related("project__student", "project__course")[:8]
    return Response({"totals": {"courses": len(cs), "students": sum(c["students"] for c in cs), "submissions": len(all_rows),
                                "average": round(sum(r["score"] for r in all_rows) / len(all_rows)) if all_rows else None},
                     "courses": cs, "attention": [{k: r[k] for k in ("project", "student", "name", "course", "score", "flags")} for r in attention[:8]],
                     "recent": [{"project": s.project_id, "student": name_of(s.project.student), "name": s.project.name,
                                 "course": s.project.course.code, "score": score(s), "created": s.created} for s in recent]})

def _safe(v):
    """! CSV formula injection guard: a cell starting with = + - @ would run as a formula in Excel."""
    v = str(v)
    return "'" + v if v[:1] in ("=", "+", "-", "@") else v

@api_view(["GET"])
def cohort_csv(request, pk):
    c = get_object_or_404(Course, pk=pk, supervisor=request.user)
    resp = HttpResponse(content_type="text/csv")
    resp["Content-Disposition"] = f'attachment; filename="{c.code}-cohort.csv"'
    w = csv.writer(resp)
    w.writerow(["Student", "Matric", "Project", "Task", "Score", "Status", "Last commit", "Flags"])
    for r in cohort_rows(c):
        w.writerow([_safe(r["student"]), _safe(r["matric"]), _safe(r["name"]), _safe(r["task"]), r["score"], r["status"], r["last_commit"], "; ".join(r["flags"])])
    return resp
