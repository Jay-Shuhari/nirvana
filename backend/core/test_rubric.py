from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Course, CriterionScore, Project, User


class RubricCriteriaTests(TestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user("supervisor@example.com", role="supervisor")
        self.student = User.objects.create_user("student@example.com", role="student")
        self.course = Course.objects.create(
            code="CSC 501",
            title="Advanced Topics",
            supervisor=self.supervisor,
            rubric=[
                {"name": "Code quality", "metric": "message_quality", "weight": 50, "enabled": True},
                {"name": "Documentation", "metric": "readme", "weight": 50, "enabled": True},
                {"name": "Security", "metric": "security", "weight": 20, "enabled": False},
            ],
        )
        self.course.students.add(self.student)
        self.project = Project.objects.create(
            student=self.student,
            course=self.course,
            name="Rubric Test Project",
            repo="student/rubric-test",
        )
        self.client = APIClient()

    def test_save_rubric_requires_enabled_weights_total_100(self):
        self.client.force_authenticate(self.supervisor)
        # Total is 80 (50 + 30)
        invalid_rubric = [
            {"name": "Code quality", "metric": "message_quality", "weight": 50, "enabled": True},
            {"name": "Documentation", "metric": "readme", "weight": 30, "enabled": True},
            {"name": "Security", "metric": "security", "weight": 20, "enabled": False},
        ]
        response = self.client.put(f"/api/courses/{self.course.id}/rubric", {"rubric": invalid_rubric}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("must total 100%", str(response.data))

        # No enabled criteria
        none_enabled = [
            {"name": "Code quality", "metric": "message_quality", "weight": 50, "enabled": False},
            {"name": "Documentation", "metric": "readme", "weight": 50, "enabled": False},
        ]
        response = self.client.put(f"/api/courses/{self.course.id}/rubric", {"rubric": none_enabled}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Enable at least one", str(response.data))

        # Valid: enabled total 100, disabled ignored in sum
        valid_rubric = [
            {"name": "Code quality", "metric": "message_quality", "weight": 60, "enabled": True},
            {"name": "Documentation", "metric": "readme", "weight": 40, "enabled": True},
            {"name": "Security", "metric": "security", "weight": 25, "enabled": False},
        ]
        response = self.client.put(f"/api/courses/{self.course.id}/rubric", {"rubric": valid_rubric}, format="json")
        self.assertEqual(response.status_code, 200)
        self.course.refresh_from_db()
        self.assertEqual(self.course.rubric, valid_rubric)

    def test_existing_rubric_without_enabled_field_defaults_to_enabled(self):
        # Emulate existing database row where rubric items have no "enabled" key
        self.course.rubric = [
            {"name": "Testing", "metric": "tests", "weight": 60},
            {"name": "Docs", "metric": "readme", "weight": 40},
        ]
        self.course.save()

        # Save again with toggle works as expected
        enabled = [item for item in self.course.rubric if item.get("enabled", True)]
        self.assertEqual(len(enabled), 2)

    @patch("core.views.review_submission", return_value={"mode": "rules", "summary": "Ok", "items": [], "rubric": {"mode": "metrics", "summary": "Ok", "items": []}})
    @patch("core.views.analyze", return_value=("sha456", {"message_quality": 0.8, "readme": 0.9, "security": 0.2}, {}, {"paths": []}))
    def test_disabled_criteria_excluded_from_scoring_and_cannot_receive_scores(self, _analyze, mock_review):
        self.client.force_authenticate(self.student)
        response = self.client.post(f"/api/projects/{self.project.id}/submit", {}, format="json")
        self.assertEqual(response.status_code, 201)

        # Check what review_submission received
        mock_review.assert_called_once()
        rubric_passed = mock_review.call_args[0][2]
        self.assertEqual(len(rubric_passed), 2)
        names_passed = [r["name"] for r in rubric_passed]
        self.assertIn("Code quality", names_passed)
        self.assertIn("Documentation", names_passed)
        self.assertNotIn("Security", names_passed)

        # CriterionScore records only created for enabled criteria
        submission = self.project.submissions.first()
        criteria = submission.criteria.all()
        self.assertEqual(criteria.count(), 2)
        c_names = [c.name for c in criteria]
        self.assertIn("Code quality", c_names)
        self.assertIn("Documentation", c_names)
        self.assertNotIn("Security", c_names)

