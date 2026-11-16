# ======================================================================
# ANCHOR: views_people.py
# FILE: backend/core/views_people.py
# ROLE: Identity (Google/GitHub via Firebase), onboarding, student course view, groups, dashboard data.
# SEE:  PRD.md §5.3–5.4, docs/Teaming.md, docs/Firebase-GitHub-Setup.md
# ======================================================================
import logging
from datetime import timedelta
from functools import reduce
from operator import or_

import requests
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from . import onboarding as ob
from .firebase_auth import FirebaseAuthError, identities, verify_id_token
from .models import Course, CourseGroup, GroupMembership, IdentityAccount, Submission, Task, User
from .teams import plan_groups

logger = logging.getLogger(__name__)
PROVIDER_LABEL = {"google": "Google", "github": "GitHub"}


class Conflict(APIException):
    status_code = 409
    default_detail = "This account conflicts with an existing Metis account."


class ProviderError(APIException):
    def __init__(self, message, status):
        self.status_code = status
        super().__init__(message)


def name_of(u): return u.get_full_name() or u.username


def policy_role(email):
    """! Academy policy decides supervisors: exact email or @domain in SUPERVISOR_EMAILS. Default student."""
    email = (email or "").lower()
    if not email or "@" not in email:
        return "student"
    domain = "@" + email.split("@", 1)[1]
    return "supervisor" if email in settings.SUPERVISOR_EMAILS or domain in settings.SUPERVISOR_EMAILS else "student"


def _claims(request):
    try:
        return verify_id_token(request.data.get("id_token"))
    except FirebaseAuthError as exc:
        raise ProviderError(str(exc), exc.status)


def _github_login(subject):
    """* Best effort: turn the numeric GitHub id into a username for display. Failure is not fatal."""
    try:
        r = requests.get(f"https://api.github.com/user/{int(subject)}", timeout=5,
                         headers={"Accept": "application/vnd.github+json"})
        return (r.json().get("login") or "")[:100] if r.ok else ""
    except (requests.RequestException, ValueError):
        return ""


def _attach(user, claims, found):
    """! Link each verified provider identity to `user`; refuse identities that belong to someone else."""
    for provider, subject in found.items():
        if IdentityAccount.objects.filter(provider=provider, subject=subject).exclude(user=user).exists():
            raise Conflict(f"This {PROVIDER_LABEL[provider]} account is already linked to another Metis account.")
        mine = user.identities.filter(provider=provider).first()
        if mine and mine.subject != subject:
            raise Conflict(f"Your Metis account is linked to a different {PROVIDER_LABEL[provider]} account. Unlink it in Settings first.")
        if not mine:
            IdentityAccount.objects.create(
                user=user, provider=provider, subject=subject,
                email=(claims.get("email") or "")[:254] if claims.get("email_verified") else "",
                login=_github_login(subject) if provider == "github" else "")


def _tokens(user, **extra):
    refresh = RefreshToken.for_user(user)
    return Response({"access": str(refresh.access_token), "refresh": str(refresh), **extra})


# ANCHOR: Sign in with Google/GitHub
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def firebase_login(request):
    claims = _claims(request)
    found = identities(claims)
    if not found:
        raise ValidationError("Sign in with Google or GitHub.")
    uid = claims["sub"]
    user = User.objects.filter(firebase_uid=uid).first()
    if not user:
        acct = IdentityAccount.objects.filter(reduce(or_, (Q(provider=p, subject=s) for p, s in found.items()))).select_related("user").first()
        user = acct.user if acct else None
    created = False
    with transaction.atomic():
        if not user:
            email = (claims.get("email") or "").strip().lower()
            verified = bool(claims.get("email_verified"))
            # ! Never merge accounts by email alone: ask the person to prove control of the old account.
            if email and User.objects.filter(Q(email__iexact=email) | Q(username__iexact=email)).exists():
                raise Conflict("An account with this email already exists. Sign in the way you did before, "
                               "then link this provider in Settings.")
            user = User(username=(email or f"firebase-{uid}")[:150], email=email[:254],
                        first_name=(claims.get("name") or "")[:150],
                        role=policy_role(email) if verified else "student", firebase_uid=uid)
            user.set_unusable_password()
            try:
                user.save()
            except IntegrityError:
                raise Conflict("This sign-in is already being set up. Try again.")
            created = True
        elif not user.firebase_uid and not User.objects.filter(firebase_uid=uid).exists():
            user.firebase_uid = uid
            user.save(update_fields=["firebase_uid"])
        _attach(user, claims, found)
    return _tokens(user, created=created)


# ANCHOR: Link another provider to the signed-in account
@api_view(["POST"])
def link_identity(request):
    claims = _claims(request)
    found = identities(claims)
    if not found:
        raise ValidationError("Link a Google or GitHub account.")
    owner = User.objects.filter(firebase_uid=claims["sub"]).exclude(pk=request.user.pk).first()
    if owner:
        raise Conflict("That sign-in already belongs to another Metis account.")
    with transaction.atomic():
        if not request.user.firebase_uid:
            request.user.firebase_uid = claims["sub"]
            request.user.save(update_fields=["firebase_uid"])
        _attach(request.user, claims, found)
    return Response({"identities": [{"provider": i.provider, "login": i.login, "email": i.email}
                                    for i in request.user.identities.all()]})


@api_view(["POST"])
def unlink_identity(request):
    provider = request.data.get("provider")
    acct = get_object_or_404(IdentityAccount, user=request.user, provider=provider)
    if provider == "github" and request.user.role == "student":
        raise ValidationError("Students need a linked GitHub account. Link a different one instead of removing it.")
    others = request.user.identities.exclude(pk=acct.pk).exists() or request.user.has_usable_password()
    if not others:
        raise ValidationError("Link another way to sign in before removing this one.")
    acct.delete()
    return Response({"ok": True})


# ANCHOR: Onboarding
@api_view(["GET", "PATCH"])
def onboarding(request):
    u = request.user
    if request.method == "PATCH":
        d = request.data
        step = d.get("step")
        if step == "profile":
            name = (d.get("name") or "").strip()
            errors = {}
            if not name: errors["name"] = "Enter your full name."
            elif len(name) > 150: errors["name"] = "Keep your name under 150 characters."
            matric = u.matric
            if u.role == "student":
                try: matric = ob.validate_matric(u, d.get("matric"))
                except ValidationError as exc: errors.update(exc.detail)
            if errors: raise ValidationError(errors)
            u.first_name, u.last_name = name, ""
            u.matric = matric
            u.department = (d.get("department") or "").strip()[:80]
            u.save(update_fields=["first_name", "last_name", "matric", "department"])
        elif step == "strengths":
            prof = ob.profile_for(u)
            prof.strengths = {"version": ob.STRENGTHS_VERSION, "answers": ob.validate_strengths(d.get("answers"))}
            prof.save(update_fields=["strengths", "updated"])
        else:
            raise ValidationError({"step": "Unknown onboarding step."})
    return Response(ob.state(u))


@api_view(["POST"])
def onboarding_complete(request):
    return Response(ob.finish(request.user, skip_github=request.data.get("skip_github") is True))


# ANCHOR: Student course page (fellow students, tasks, my group)
def student_course_view(user, c):
    from .views import task_json
    groups = {m.user_id: m.group for m in c.group_memberships.select_related("group")}
    mine = groups.get(user.id)
    tasks = [task_json(t, user) for t in c.tasks.select_related("course").order_by("due", "-created")]
    classmates = [{"id": s.id, "name": name_of(s), "group": groups[s.id].name if s.id in groups else None,
                   "me": s.id == user.id}
                  for s in c.students.order_by("first_name", "username")]
    return Response({
        "role": "student",
        "course": {"id": c.id, "code": c.code, "title": c.title, "session": c.session,
                   "supervisor": name_of(c.supervisor), "group_mode": c.group_mode, "group_size": c.group_size},
        "stats": {"students": len(classmates), "tasks": len(tasks),
                  "submitted": sum(1 for t in tasks if t.get("project") and t["project"]["submitted"])},
        "tasks": tasks, "classmates": classmates,
        "my_group": {"id": mine.id, "name": mine.name} if mine else None,
    })


# ANCHOR: Groups
def _course_for(user, pk):
    if user.role == "supervisor":
        return get_object_or_404(Course, pk=pk, supervisor=user), True
    return get_object_or_404(Course, pk=pk, students=user), False


def _groups_payload(c, user, manage):
    members = {}
    for m in c.group_memberships.select_related("user__onboarding").order_by("role", "joined"):  # "lead" sorts before "member"
        members.setdefault(m.group_id, []).append(m)
    def person(u, role=None):
        p = {"id": u.id, "name": name_of(u), "role": role, "me": u.id == user.id}
        if manage: p["strengths"] = ob.strengths_summary(u)
        return p
    assigned = {m.user_id for ms in members.values() for m in ms}
    groups = [{"id": g.id, "name": g.name,
               "members": [person(m.user, m.role) for m in members.get(g.id, [])]} for g in c.groups.all()]
    mine = next((g["id"] for g in groups if any(p["me"] for p in g["members"])), None)
    unassigned = [person(s) for s in c.students.select_related("onboarding").order_by("first_name", "username")
                  if s.id not in assigned]
    return {"mode": c.group_mode, "size": c.group_size, "can_manage": manage,
            "can_choose": not manage and c.group_mode == "self",
            "groups": groups, "unassigned": unassigned, "my_group": mine}


@api_view(["GET", "POST"])
def course_groups(request, pk):
    c, manage = _course_for(request.user, pk)
    if request.method == "POST":
        if not manage: raise PermissionDenied()
        name = (request.data.get("name") or "").strip()[:60] or f"Group {c.groups.count() + 1}"
        if c.groups.filter(name__iexact=name).exists():
            raise ValidationError({"name": "A group with this name already exists in this course."})
        CourseGroup.objects.create(course=c, name=name)
    return Response(_groups_payload(c, request.user, manage))


@api_view(["PUT"])
def group_settings(request, pk):
    c = get_object_or_404(Course, pk=pk, supervisor=request.user)
    mode, size = request.data.get("mode"), request.data.get("size")
    if mode not in dict(Course.GROUP_MODES):
        raise ValidationError({"mode": "Choose who forms groups."})
    if not isinstance(size, int) or isinstance(size, bool) or not 2 <= size <= 12:
        raise ValidationError({"size": "Group size must be a whole number from 2 to 12."})
    c.group_mode, c.group_size = mode, size
    c.save(update_fields=["group_mode", "group_size"])
    return Response(_groups_payload(c, request.user, True))


@api_view(["POST"])
def auto_groups(request, pk):
    """! Rebuilds every group in the course from onboarding strengths. Requires replace=true when groups exist."""
    from .views import notify
    c = get_object_or_404(Course, pk=pk, supervisor=request.user)
    if c.groups.exists() and request.data.get("replace") is not True:
        raise ValidationError({"replace": "This course already has groups. Confirm to replace them."})
    students = c.students.select_related("onboarding")
    if students.count() < 2:
        raise ValidationError("Enrol at least two students before creating groups.")
    with transaction.atomic():
        c.groups.all().delete()
        for i, members in enumerate(plan_groups(students, c.group_size), start=1):
            g = CourseGroup.objects.create(course=c, name=f"Group {i}")
            for u, role in members:
                GroupMembership.objects.create(group=g, course=c, user=u, role=role)
    for m in c.group_memberships.select_related("group", "user"):
        notify(m.user, f"You are in {m.group.name} for {c.code}", f"/courses/{c.id}?tab=groups")
    return Response(_groups_payload(c, request.user, True))


@api_view(["PATCH", "DELETE"])
def group_detail(request, gid):
    g = get_object_or_404(CourseGroup.objects.select_related("course"), pk=gid, course__supervisor=request.user)
    if request.method == "DELETE":
        g.delete()  # * memberships go with it; students become unassigned
    else:
        name = (request.data.get("name") or "").strip()[:60]
        if not name: raise ValidationError({"name": "Enter a group name."})
        if g.course.groups.filter(name__iexact=name).exclude(pk=g.pk).exists():
            raise ValidationError({"name": "A group with this name already exists in this course."})
        g.name = name; g.save(update_fields=["name"])
    return Response(_groups_payload(g.course, request.user, True))


@api_view(["POST"])
def group_members(request, gid):
    from .views import notify
    g = get_object_or_404(CourseGroup.objects.select_related("course"), pk=gid)
    c = g.course
    manage = c.supervisor_id == request.user.id
    if manage:
        target = get_object_or_404(User, pk=request.data.get("user"), enrolled=c)
    elif c.students.filter(pk=request.user.pk).exists():
        if c.group_mode != "self": raise PermissionDenied("Your supervisor assigns groups in this course.")
        target = request.user
        if g.memberships.count() >= c.group_size:
            raise ValidationError(f"{g.name} is full ({c.group_size} people).")
    else:
        raise PermissionDenied()
    with transaction.atomic():
        GroupMembership.objects.filter(course=c, user=target).delete()
        role = "lead" if manage and request.data.get("role") == "lead" else "member"
        if role == "lead": g.memberships.filter(role="lead").update(role="member")
        GroupMembership.objects.create(group=g, course=c, user=target, role=role)
    if manage:
        notify(target, f"You are in {g.name} for {c.code}", f"/courses/{c.id}?tab=groups")
    return Response(_groups_payload(c, request.user, manage))


@api_view(["DELETE"])
def group_member_remove(request, gid, uid):
    g = get_object_or_404(CourseGroup.objects.select_related("course"), pk=gid)
    c = g.course
    manage = c.supervisor_id == request.user.id
    if not manage and not (uid == request.user.id and c.group_mode == "self"):
        raise PermissionDenied()
    get_object_or_404(GroupMembership, group=g, user_id=uid).delete()
    return Response(_groups_payload(c, request.user, manage))


# ANCHOR: Dashboard widgets
def _day_counts(dates, days=14):
    today = timezone.localdate()
    buckets = {today - timedelta(days=i): 0 for i in range(days)}
    for d in dates:
        d = timezone.localtime(d).date()
        if d in buckets: buckets[d] += 1
    return [{"date": d.isoformat(), "count": buckets[d]} for d in sorted(buckets)]


@api_view(["GET"])
def dashboard(request):
    """* Widget data for the home page. Students: deadlines, progress, results, groups. Supervisors: activity, deadlines."""
    from .views import score, task_json
    u, today = request.user, timezone.localdate()
    since = timezone.now() - timedelta(days=14)
    if u.role == "student":
        tasks = [task_json(t, u) for t in Task.objects.filter(course__students=u).select_related("course")]
        submitted = [t for t in tasks if t["project"] and t["project"]["submitted"]]
        open_tasks = [t for t in tasks if not (t["project"] and t["project"]["submitted"])]
        overdue = [t for t in open_tasks if t["due"] and t["due"] < today]
        upcoming = sorted([t for t in open_tasks if t["due"] and t["due"] >= today], key=lambda t: t["due"])
        subs = Submission.objects.filter(project__student=u, status="done").select_related("project__task").order_by("created")
        results = [{"date": s.created, "score": score(s), "project": s.project_id,
                    "task": s.project.task.title if s.project.task else s.project.name} for s in subs][-10:]
        groups = [{"course": m.course.code, "course_id": m.course_id, "name": m.group.name, "role": m.role,
                   "members": [name_of(x.user) for x in m.group.memberships.select_related("user")]}
                  for m in u.group_memberships.select_related("group", "course")]
        return Response({
            "counts": {"courses": u.enrolled.count(), "tasks": len(tasks), "submitted": len(submitted),
                       "open": len(open_tasks), "overdue": len(overdue)},
            "upcoming": upcoming[:5], "overdue": overdue[:5], "no_due": [t for t in open_tasks if not t["due"]][:3],
            "results": results, "groups": groups,
            "activity": _day_counts(Submission.objects.filter(project__student=u, created__gte=since).values_list("created", flat=True)),
        })
    if u.role != "supervisor": raise PermissionDenied()
    tasks = Task.objects.filter(course__supervisor=u, due__gte=today).select_related("course").order_by("due")[:6]
    upcoming = [{**task_json(t), "enrolled": t.course.students.count()} for t in tasks]
    return Response({
        "activity": _day_counts(Submission.objects.filter(project__course__supervisor=u, created__gte=since).values_list("created", flat=True)),
        "upcoming": upcoming,
        "ungrouped": sum(c.students.exclude(group_memberships__course=c).count() for c in u.courses.all()),
    })
