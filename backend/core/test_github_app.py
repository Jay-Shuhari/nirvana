import hashlib
import hmac
import json
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .github_app import GitHubAppError
from .models import Course, GitHubInstallation, GitHubInstallState, Project, Task, User
from .test_people import make_ready


class GitHubAppAccessTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("student@example.com", password="password123", role="student")
        self.supervisor = User.objects.create_user("supervisor@example.com", password="password123", role="supervisor")
        self.course = Course.objects.create(code="CSC 101", title="Intro", supervisor=self.supervisor)
        self.course.students.add(self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @override_settings(GITHUB_APP_ID="12345", GITHUB_APP_SLUG="test-app", GITHUB_APP_PRIVATE_KEY="key")
    def test_install_start_returns_setup_url(self):
        response = self.client.post("/api/github/install", format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("https://github.com/apps/test-app/installations/new?state=", response.data["url"])
        self.assertTrue(GitHubInstallState.objects.filter(user=self.user).exists())

    def test_setup_rejects_forged_state(self):
        response = self.client.get(
            f"/api/github/setup?setup_action=install&installation_id=999&state={uuid.uuid4()}"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(b"invalid or expired", response.content)

    def test_setup_rejects_expired_state(self):
        state = GitHubInstallState.objects.create(user=self.user)
        # Manually backdate created timestamp
        GitHubInstallState.objects.filter(pk=state.pk).update(
            created=timezone.now() - timedelta(minutes=20)
        )
        response = self.client.get(
            f"/api/github/setup?setup_action=install&installation_id=999&state={state.nonce}"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(b"invalid or expired", response.content)

    def test_setup_rejects_consumed_state(self):
        state = GitHubInstallState.objects.create(user=self.user, consumed=True)
        response = self.client.get(
            f"/api/github/setup?setup_action=install&installation_id=999&state={state.nonce}"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(b"invalid or expired", response.content)

    @patch("core.views.verify_installation", side_effect=GitHubAppError("Installation does not belong to app"))
    def test_setup_rejects_unknown_installation(self, _verify):
        state = GitHubInstallState.objects.create(user=self.user)
        response = self.client.get(
            f"/api/github/setup?setup_action=install&installation_id=999&state={state.nonce}"
        )
        self.assertEqual(response.status_code, 502)
        self.assertFalse(GitHubInstallation.objects.filter(installation_id=999).exists())

    @patch("core.views.verify_installation", return_value={"app_id": 12345})
    def test_setup_creates_installation_and_redirects(self, _verify):
        state = GitHubInstallState.objects.create(user=self.user)
        response = self.client.get(
            f"/api/github/setup?setup_action=install&installation_id=999&state={state.nonce}"
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/settings?github=connected", response.headers["Location"])
        state.refresh_from_db()
        self.assertTrue(state.consumed)
        installation = GitHubInstallation.objects.get(installation_id=999)
        self.assertEqual(installation.user, self.user)
        self.assertTrue(installation.active)
        self.assertFalse(installation.suspended)

    @override_settings(GITHUB_WEBHOOK_SECRET="secret123")
    def test_webhook_rejects_invalid_signature(self):
        payload = json.dumps({"action": "deleted", "installation": {"id": 999}}).encode()
        response = self.client.post(
            "/api/github/webhook",
            data=payload,
            content_type="application/json",
            headers={"x-hub-signature-256": "sha256=invalidbadhash", "x-github-event": "installation"},
        )
        self.assertEqual(response.status_code, 403)

    @override_settings(GITHUB_WEBHOOK_SECRET="secret123")
    def test_webhook_handles_installation_actions(self):
        installation = GitHubInstallation.objects.create(user=self.user, installation_id=999)
        payload = json.dumps({"action": "suspend", "installation": {"id": 999}}).encode()
        digest = hmac.new(b"secret123", payload, hashlib.sha256).hexdigest()

        response = self.client.post(
            "/api/github/webhook",
            data=payload,
            content_type="application/json",
            headers={"x-hub-signature-256": f"sha256={digest}", "x-github-event": "installation"},
        )
        self.assertEqual(response.status_code, 200)
        installation.refresh_from_db()
        self.assertTrue(installation.suspended)

        # Unsuspend
        payload = json.dumps({"action": "unsuspend", "installation": {"id": 999}}).encode()
        digest = hmac.new(b"secret123", payload, hashlib.sha256).hexdigest()
        response = self.client.post(
            "/api/github/webhook",
            data=payload,
            content_type="application/json",
            headers={"x-hub-signature-256": f"sha256={digest}", "x-github-event": "installation"},
        )
        self.assertEqual(response.status_code, 200)
        installation.refresh_from_db()
        self.assertFalse(installation.suspended)

        # Deleted
        payload = json.dumps({"action": "deleted", "installation": {"id": 999}}).encode()
        digest = hmac.new(b"secret123", payload, hashlib.sha256).hexdigest()
        response = self.client.post(
            "/api/github/webhook",
            data=payload,
            content_type="application/json",
            headers={"x-hub-signature-256": f"sha256={digest}", "x-github-event": "installation"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(GitHubInstallation.objects.filter(installation_id=999).exists())

    @patch("core.views.token_for_repository", return_value=None)
    def test_project_registration_rejects_repo_outside_installation(self, _token):
        installation = make_ready(self.user, installation_id=888)
        task = Task.objects.create(course=self.course, title="Task 1")
        response = self.client.post(
            "/api/projects",
            {
                "name": "Outside Repo",
                "repo": "owner/outside-repo",
                "task": task.id,
                "installation_id": installation.installation_id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("not available to the selected GitHub App installation", str(response.data))

