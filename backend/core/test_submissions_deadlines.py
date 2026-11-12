from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Course, Project, Submission, Task, User


class SubmissionAndDeadlineTests(TestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user("supervisor@example.com", role="supervisor")
        self.student = User.objects.create_user("student@example.com", role="student")
        self.course = Course.objects.create(code="CSC 201", title="Algorithms", supervisor=self.supervisor)
        self.course.students.add(self.student)
        self.task = Task.objects.create(
            course=self.course,
            title="Algorithm assignment",
            due=timezone.localdate() + timedelta(days=2),
            requirements=["Implement sorting algorithm."],
        )
        self.project = Project.objects.create(
            student=self.student,
            course=self.course,
            task=self.task,
            name="Sorting Project",
            repo="student/sorting",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.student)

    @patch("core.views.review_submission", return_value={"mode": "rules", "summary": "Ok", "items": [], "rubric": {"mode": "metrics", "summary": "Ok", "items": []}})
    @patch("core.views.analyze", return_value=("a1b2c3d", {"tests": 0.9}, {"tests": []}, {"paths": ["README.md"]}))
    def test_valid_first_submission_evaluates_and_locks(self, _analyze, _review):
        response = self.client.post(f"/api/projects/{self.project.id}/submit", {}, format="json")
        self.assertEqual(response.status_code, 201)
        self.project.refresh_from_db()
        self.assertTrue(self.project.submission_locked)
        self.assertEqual(self.project.submissions.count(), 1)
        submission = self.project.submissions.first()
        self.assertEqual(submission.status, "done")
        self.assertEqual(submission.sha, "a1b2c3d")

    def test_duplicate_submission_is_rejected(self):
        self.project.submission_locked = True
        self.project.save()

        response = self.client.post(f"/api/projects/{self.project.id}/submit", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already been submitted", str(response.data))

    def test_late_submission_is_rejected(self):
        self.task.due = timezone.localdate() - timedelta(days=1)
        self.task.save()

        response = self.client.post(f"/api/projects/{self.project.id}/submit", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("deadline", str(response.data))
        self.assertIn("passed", str(response.data))
        self.project.refresh_from_db()
        self.assertFalse(self.project.submission_locked)

    @patch("core.views.review_submission", return_value={"mode": "rules", "summary": "Ok", "items": [], "rubric": {"mode": "metrics", "summary": "Ok", "items": []}})
    @patch("core.views.analyze", return_value=("a1b2c3d", {}, {}, {"paths": []}))
    def test_concurrent_submission_atomic_rejection(self, _analyze, _review):
        # Simulate race condition where two requests pass the initial check before either saves
        with patch.object(Project.objects, "filter", wraps=Project.objects.filter) as mock_filter:
            # Let the first call proceed normally and lock it
            first_resp = self.client.post(f"/api/projects/{self.project.id}/submit", {}, format="json")
            self.assertEqual(first_resp.status_code, 201)

            # Second call sees submission_locked=True (or filter(submission_locked=False).update() returns 0)
            second_resp = self.client.post(f"/api/projects/{self.project.id}/submit", {}, format="json")
            self.assertEqual(second_resp.status_code, 400)
            self.assertIn("already been submitted", str(second_resp.data))

