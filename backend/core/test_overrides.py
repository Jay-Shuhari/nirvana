from django.test import TestCase
from rest_framework.test import APIClient

from .models import Course, CriterionScore, Project, Submission, User


class OverallGradeOverrideTests(TestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user("supervisor@example.com", role="supervisor")
        self.student = User.objects.create_user("student@example.com", role="student")
        course = Course.objects.create(
            code="CSC 100",
            title="Testing",
            supervisor=self.supervisor,
        )
        project = Project.objects.create(
            student=self.student,
            course=course,
            name="Sample project",
            repo="student/sample",
        )
        self.submission = Submission.objects.create(project=project)
        CriterionScore.objects.create(
            submission=self.submission,
            name="Documentation",
            metric="readme",
            weight=10,
            auto=8,
        )
        self.client = APIClient()

    def test_supervisor_can_override_and_reset_overall_grade(self):
        self.client.force_authenticate(self.supervisor)

        response = self.client.post(
            f"/api/submissions/{self.submission.id}/override",
            {"score": 82, "reason": "Reviewed the submitted evidence."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["final_score"], 82)
        self.assertEqual(response.data["overall_reason"], "Reviewed the submitted evidence.")

        response = self.client.post(
            f"/api/submissions/{self.submission.id}/override",
            {"score": None},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["final_score"], 8)
        self.assertIsNone(response.data["overall_override"])

    def test_students_cannot_override_overall_grade(self):
        self.client.force_authenticate(self.student)

        response = self.client.post(
            f"/api/submissions/{self.submission.id}/override",
            {"score": 82, "reason": "Attempted override."},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.submission.refresh_from_db()
        self.assertIsNone(self.submission.overall_override)

    def test_override_requires_a_reason(self):
        self.client.force_authenticate(self.supervisor)

        response = self.client.post(
            f"/api/submissions/{self.submission.id}/override",
            {"score": 82},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.submission.refresh_from_db()
        self.assertIsNone(self.submission.overall_override)

    def test_missing_score_does_not_reset_override(self):
        self.client.force_authenticate(self.supervisor)
        self.submission.overall_override = 82
        self.submission.overall_reason = "Reviewed evidence."
        self.submission.save()

        response = self.client.post(
            f"/api/submissions/{self.submission.id}/override",
            {"reason": "Missing score."},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.overall_override, 82)
