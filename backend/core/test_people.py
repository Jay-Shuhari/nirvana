"""Identity linking, onboarding gate, student course page, groups and dashboard."""
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (Course, CourseGroup, GitHubInstallation, GitHubInstallState, GroupMembership,
                     IdentityAccount, Notification, OnboardingProfile, Task, User)
from .teams import plan_groups

ANSWERS = {"areas": ["frontend"], "languages": ["javascript"], "experience": "some", "team_role": "builder"}


def make_ready(user, installation_id=777, areas=("frontend",), experience="some", github_id=None):
    """Test helper: give a student a finished onboarding (name, matric, strengths, GitHub identity + App)."""
    user.first_name = user.first_name or "Test"
    user.matric = user.matric or f"MAT{user.pk:04d}"
    user.save()
    IdentityAccount.objects.get_or_create(user=user, provider="github",
                                          defaults={"subject": str(github_id or 9000 + user.pk), "login": f"gh{user.pk}"})
    OnboardingProfile.objects.update_or_create(user=user, defaults={
        "strengths": {"version": 1, "answers": {**ANSWERS, "areas": list(areas), "experience": experience}},
        "completed": timezone.now()})
    return GitHubInstallation.objects.create(user=user, installation_id=installation_id + user.pk)


def claims(uid="fb-1", email="new@example.com", verified=True, **ids):
    return {"sub": uid, "email": email, "email_verified": verified, "name": "New Person",
            "firebase": {"identities": {f"{k}.com": [v] for k, v in ids.items()}, "sign_in_provider": "google.com"}}


@patch("core.views_people._github_login", return_value="octo")
class FirebaseIdentityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def login(self, c):
        with patch("core.views_people.verify_id_token", return_value=c):
            return self.client.post("/api/auth/firebase", {"id_token": "t"}, format="json")

    def test_new_google_user_is_student_with_identity(self, _):
        r = self.login(claims(google="g-1"))
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)
        u = User.objects.get(firebase_uid="fb-1")
        self.assertEqual(u.role, "student")
        self.assertFalse(u.has_usable_password())
        self.assertTrue(u.identities.filter(provider="google", subject="g-1").exists())

    def test_same_identity_signs_into_same_user(self, _):
        self.login(claims(google="g-1"))
        r = self.login(claims(google="g-1"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(User.objects.count(), 1)

    def test_email_match_is_not_silently_merged(self, _):
        User.objects.create_user("new@example.com", email="new@example.com", password="password123")
        r = self.login(claims(google="g-1"))
        self.assertEqual(r.status_code, 409)
        self.assertEqual(User.objects.count(), 1)

    @override_settings(SUPERVISOR_EMAILS=["@staff.edu"])
    def test_supervisor_role_comes_from_policy(self, _):
        self.login(claims(email="lect@staff.edu", google="g-2"))
        self.assertEqual(User.objects.get(email="lect@staff.edu").role, "supervisor")

    @override_settings(SUPERVISOR_EMAILS=["@staff.edu"])
    def test_unverified_email_never_grants_supervisor(self, _):
        self.login(claims(email="lect@staff.edu", verified=False, github="5"))
        self.assertEqual(User.objects.get(firebase_uid="fb-1").role, "student")

    def test_link_github_to_signed_in_user(self, _):
        u = User.objects.create_user("a@example.com", password="password123")
        self.client.force_authenticate(u)
        with patch("core.views_people.verify_id_token", return_value=claims(uid="fb-a", github="42")):
            r = self.client.post("/api/auth/link", {"id_token": "t"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(u.identities.get(provider="github").login, "octo")

    def test_link_rejects_identity_owned_by_other_user(self, _):
        other = User.objects.create_user("o@example.com")
        IdentityAccount.objects.create(user=other, provider="github", subject="42")
        u = User.objects.create_user("a@example.com", password="password123")
        self.client.force_authenticate(u)
        with patch("core.views_people.verify_id_token", return_value=claims(uid="fb-a", github="42")):
            r = self.client.post("/api/auth/link", {"id_token": "t"}, format="json")
        self.assertEqual(r.status_code, 409)

    def test_firebase_not_configured_is_explicit(self, _):
        r = self.client.post("/api/auth/firebase", {"id_token": "t"}, format="json")
        self.assertEqual(r.status_code, 503)

    @override_settings(LEGACY_PASSWORD_SIGNUP=True)
    def test_password_register_ignores_role_field(self, _):
        r = self.client.post("/api/auth/register", {"email": "x@example.com", "password": "password123",
                                                     "name": "X", "role": "supervisor"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.get(email="x@example.com").role, "student")

    def test_students_cannot_unlink_github(self, _):
        u = User.objects.create_user("a@example.com", password="password123")
        IdentityAccount.objects.create(user=u, provider="github", subject="42")
        self.client.force_authenticate(u)
        r = self.client.post("/api/auth/unlink", {"provider": "github"}, format="json")
        self.assertEqual(r.status_code, 400)


class OnboardingTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user("s@example.com", role="student")
        self.sup = User.objects.create_user("t@example.com", role="supervisor", first_name="Tee")
        self.course = Course.objects.create(code="CSC 1", title="One", supervisor=self.sup)
        self.client = APIClient()
        self.client.force_authenticate(self.student)

    def save(self, body):
        return self.client.patch("/api/onboarding", body, format="json")

    def test_state_lists_student_steps(self):
        r = self.client.get("/api/onboarding")
        self.assertEqual([s["id"] for s in r.data["steps"]], ["profile", "strengths", "github"])
        self.assertEqual(r.data["current"], "profile")
        self.assertFalse(r.data["complete"])

    def test_profile_requires_matric_and_name(self):
        r = self.save({"step": "profile", "name": "", "matric": ""})
        self.assertEqual(r.status_code, 400)
        self.assertIn("name", r.data)
        self.assertIn("matric", r.data)

    def test_matric_is_unique_among_students(self):
        User.objects.create_user("o@example.com", role="student", matric="CSC/21/001")
        r = self.save({"step": "profile", "name": "Ada", "matric": "csc/21/001"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("already registered", str(r.data["matric"]))

    def test_progress_is_saved_and_resumed(self):
        self.assertEqual(self.save({"step": "profile", "name": "Ada L", "matric": "CSC/21/002"}).status_code, 200)
        r = self.client.get("/api/onboarding")
        self.assertEqual(r.data["current"], "strengths")
        self.assertEqual(r.data["profile"]["matric"], "CSC/21/002")

    def test_strengths_are_validated(self):
        r = self.save({"step": "strengths", "answers": {"areas": ["frontend", "nope"], "experience": "x"}})
        self.assertEqual(r.status_code, 400)
        self.assertIn("areas", r.data)
        r = self.save({"step": "strengths", "answers": {**ANSWERS, "areas": ["a", "b", "c", "d"]}})
        self.assertEqual(r.status_code, 400)
        r = self.save({"step": "strengths", "answers": {**ANSWERS, "extra": 1}})
        self.assertEqual(r.status_code, 400)
        r = self.save({"step": "strengths", "answers": ANSWERS})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["strengths"]["answers"]["areas"], ["frontend"])

    def test_student_cannot_finish_or_skip_without_github(self):
        self.save({"step": "profile", "name": "Ada L", "matric": "CSC/21/002"})
        self.save({"step": "strengths", "answers": ANSWERS})
        r = self.client.post("/api/onboarding/complete", {"skip_github": True}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/onboarding/complete", {}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("github", r.data)

    def test_student_finishes_with_github(self):
        self.save({"step": "profile", "name": "Ada L", "matric": "CSC/21/002"})
        self.save({"step": "strengths", "answers": ANSWERS})
        IdentityAccount.objects.create(user=self.student, provider="github", subject="1")
        GitHubInstallation.objects.create(user=self.student, installation_id=55)
        r = self.client.post("/api/onboarding/complete", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["complete"])

    def test_supervisor_may_skip_github(self):
        self.client.force_authenticate(self.sup)
        r = self.client.post("/api/onboarding/complete", {"skip_github": True}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["complete"])

    def test_join_requires_finished_onboarding(self):
        r = self.client.post("/api/courses/join", {"code": self.course.join_code}, format="json")
        self.assertEqual(r.status_code, 403)
        make_ready(self.student)
        r = self.client.post("/api/courses/join", {"code": self.course.join_code}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_start_task_requires_app_repository(self):
        make_ready(self.student)
        self.course.students.add(self.student)
        task = Task.objects.create(course=self.course, title="T")
        r = self.client.post("/api/projects", {"task": task.id, "repo": "someone/public-repo"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("connected GitHub account", str(r.data))
        r = self.client.post("/api/projects", {"course": self.course.id, "repo": "a/b", "installation_id": 1}, format="json")
        self.assertEqual(r.status_code, 400)

    @patch("core.views.verify_installation", return_value={"app_id": 1, "account": {"id": 555, "login": "other", "type": "User"}})
    def test_setup_rejects_installation_of_another_github_account(self, _):
        IdentityAccount.objects.create(user=self.student, provider="github", subject="1")
        state = GitHubInstallState.objects.create(user=self.student, return_to="/onboarding")
        r = self.client.get(f"/api/github/setup?setup_action=install&installation_id=3&state={state.nonce}")
        self.assertEqual(r.status_code, 302)
        self.assertIn("/onboarding?github=mismatch", r["Location"])
        self.assertFalse(GitHubInstallation.objects.filter(installation_id=3).exists())

    @patch("core.views.verify_installation", return_value={"app_id": 1, "account": {"id": 1, "login": "me", "type": "User"}})
    def test_setup_records_account_and_returns_to_onboarding(self, _):
        IdentityAccount.objects.create(user=self.student, provider="github", subject="1")
        state = GitHubInstallState.objects.create(user=self.student, return_to="/onboarding")
        r = self.client.get(f"/api/github/setup?setup_action=install&installation_id=3&state={state.nonce}")
        self.assertIn("/onboarding?github=connected", r["Location"])
        self.assertEqual(GitHubInstallation.objects.get(installation_id=3).account_login, "me")

    @patch("core.views.verify_installation", return_value={"app_id": 1, "account": {"id": 1, "login": "me", "type": "User"}})
    def test_setup_accepts_update_of_existing_installation(self, _):
        IdentityAccount.objects.create(user=self.student, provider="github", subject="1")
        state = GitHubInstallState.objects.create(user=self.student)
        r = self.client.get(f"/api/github/setup?setup_action=update&installation_id=3&state={state.nonce}")
        self.assertIn("/settings?github=connected", r["Location"])

    @override_settings(GITHUB_APP_ID="1", GITHUB_APP_SLUG="app", GITHUB_APP_PRIVATE_KEY="k")
    def test_install_return_path_is_allow_listed(self):
        self.client.post("/api/github/install", {"return_to": "https://evil.example"}, format="json")
        self.assertEqual(GitHubInstallState.objects.get(user=self.student).return_to, "/settings")


class CourseAndGroupTests(TestCase):
    def setUp(self):
        self.sup = User.objects.create_user("t@example.com", role="supervisor")
        self.course = Course.objects.create(code="CSC 2", title="Two", supervisor=self.sup, group_size=2)
        self.students = []
        for i, (area, exp) in enumerate([("frontend", "new"), ("frontend", "confident"), ("backend", "some"),
                                         ("backend", "new"), ("design", "some")]):
            u = User.objects.create_user(f"s{i}@example.com", role="student", first_name=f"S{i}")
            make_ready(u, areas=(area,), experience=exp)
            self.course.students.add(u)
            self.students.append(u)
        self.client = APIClient()

    def test_student_sees_course_page_with_classmates_but_no_join_code(self):
        self.client.force_authenticate(self.students[0])
        r = self.client.get(f"/api/courses/{self.course.id}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["role"], "student")
        self.assertEqual(len(r.data["classmates"]), 5)
        self.assertNotIn("join_code", r.data["course"])
        self.assertNotIn("email", r.data["classmates"][0])

    def test_outsider_cannot_open_course(self):
        out = User.objects.create_user("x@example.com", role="student")
        self.client.force_authenticate(out)
        self.assertEqual(self.client.get(f"/api/courses/{self.course.id}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/courses/{self.course.id}/groups").status_code, 404)

    def test_auto_groups_are_balanced_and_replace_needs_confirmation(self):
        self.client.force_authenticate(self.sup)
        r = self.client.post(f"/api/courses/{self.course.id}/groups/auto", {}, format="json")
        self.assertEqual(r.status_code, 200)
        sizes = sorted(len(g["members"]) for g in r.data["groups"])
        self.assertEqual(sizes, [1, 2, 2])
        self.assertEqual(r.data["unassigned"], [])
        self.assertTrue(all(sum(p["role"] == "lead" for p in g["members"]) == 1 for g in r.data["groups"]))
        self.assertEqual(self.client.post(f"/api/courses/{self.course.id}/groups/auto", {}, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"/api/courses/{self.course.id}/groups/auto", {"replace": True}, format="json").status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.students[0], text__contains="Group").exists())

    def test_plan_groups_spreads_same_area(self):
        groups = plan_groups(self.students[:4], 2)
        for members in groups:
            areas = [u.onboarding.strengths["answers"]["areas"][0] for u, _ in members]
            self.assertEqual(len(set(areas)), len(areas))

    def test_student_cannot_choose_group_in_supervisor_mode(self):
        g = CourseGroup.objects.create(course=self.course, name="A")
        self.client.force_authenticate(self.students[0])
        self.assertEqual(self.client.post(f"/api/groups/{g.id}/members", {}, format="json").status_code, 403)

    def test_self_selection_respects_size_and_one_group_per_course(self):
        self.course.group_mode = "self"; self.course.save()
        a = CourseGroup.objects.create(course=self.course, name="A")
        b = CourseGroup.objects.create(course=self.course, name="B")
        for s in self.students[:2]:
            self.client.force_authenticate(s)
            self.assertEqual(self.client.post(f"/api/groups/{a.id}/members", {}, format="json").status_code, 200)
        self.client.force_authenticate(self.students[2])
        self.assertEqual(self.client.post(f"/api/groups/{a.id}/members", {}, format="json").status_code, 400)
        self.client.force_authenticate(self.students[0])
        self.client.post(f"/api/groups/{b.id}/members", {}, format="json")
        self.assertEqual(GroupMembership.objects.filter(course=self.course, user=self.students[0]).count(), 1)
        self.assertEqual(GroupMembership.objects.get(user=self.students[0]).group, b)

    def test_group_settings_validation(self):
        self.client.force_authenticate(self.sup)
        url = f"/api/courses/{self.course.id}/groups/settings"
        self.assertEqual(self.client.put(url, {"mode": "self", "size": 1}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"mode": "chaos", "size": 4}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"mode": "self", "size": 4}, format="json").status_code, 200)

    def test_supervisor_roster_includes_strengths(self):
        self.client.force_authenticate(self.sup)
        r = self.client.get(f"/api/courses/{self.course.id}")
        self.assertEqual(r.data["students"][0]["strengths"]["areas"][0], "Frontend & UI")

    def test_dashboards(self):
        Task.objects.create(course=self.course, title="Soon", due=timezone.localdate())
        self.client.force_authenticate(self.students[0])
        r = self.client.get("/api/dashboard")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["counts"]["open"], 1)
        self.assertEqual(len(r.data["activity"]), 14)
        self.client.force_authenticate(self.sup)
        r = self.client.get("/api/dashboard")
        self.assertEqual(r.data["ungrouped"], 5)
        self.assertEqual(len(r.data["upcoming"]), 1)

    def test_overview_counts_each_student_once(self):
        other = Course.objects.create(code="CSC 3", title="Three", supervisor=self.sup)
        other.students.add(*self.students[:2])
        self.client.force_authenticate(self.sup)
        self.assertEqual(self.client.get("/api/overview").data["totals"]["students"], 5)

    def test_single_notification_read_is_recipient_only(self):
        n = Notification.objects.create(user=self.students[0], text="hi")
        self.client.force_authenticate(self.students[1])
        self.assertEqual(self.client.post(f"/api/notifications/{n.id}/read").status_code, 404)
        self.client.force_authenticate(self.students[0])
        self.assertEqual(self.client.post(f"/api/notifications/{n.id}/read").status_code, 200)
        n.refresh_from_db(); self.assertTrue(n.read)
