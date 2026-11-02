import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from .ai import review_submission


class ReviewSubmissionTests(SimpleTestCase):
    task = SimpleNamespace(
        title="Registration form",
        description="Build a working registration form.",
        requirements=["Validate submitted email addresses."],
    )
    rubric = [{"name": "Testing", "metric": "tests", "weight": 15}]
    response_data = {
        "summary": "The project provides evidence for its task and rubric.",
        "requirements": [{
            "requirement": "Validate submitted email addresses.",
            "met": True,
            "note": "The registration form validates email input.",
        }],
        "rubric": [{
            "criterion": "Testing",
            "metric": "tests",
            "score": 10,
            "note": "The repository includes tests in tests/registration.test.js.",
        }],
    }

    @override_settings(
        LLM_BASE_URL="https://example.test/v1",
        LLM_API_KEY="test-key",
        LLM_MODEL="test-model",
    )
    @patch("core.ai.gather", return_value={"README.md": "Project overview"})
    @patch("core.ai.requests.post")
    def test_ai_review_returns_requirement_and_rubric_results(self, post, _gather):
        response = Mock()
        response.json.return_value = {"choices": [{"message": {"content": json.dumps(self.response_data)}}]}
        post.return_value = response

        result = review_submission(
            "student/project", self.task, self.rubric, ["README.md"], {"tests": 0.3}, {}
        )

        self.assertEqual(result["mode"], "ai")
        self.assertTrue(result["items"][0]["met"])
        self.assertEqual(result["rubric"]["items"][0]["score"], 10)
        self.assertEqual(result["rubric"]["items"][0]["weight"], 15)

    @override_settings(LLM_BASE_URL="", LLM_API_KEY="", LLM_MODEL="")
    @patch("core.ai.gather", return_value={})
    @patch("core.ai.requests.post")
    def test_unconfigured_ai_keeps_rule_check_and_metric_scoring(self, post, _gather):
        result = review_submission(
            "student/project", self.task, self.rubric, ["README.md"], {"tests": 0.3}, {}
        )

        post.assert_not_called()
        self.assertEqual(result["mode"], "rules")
        self.assertEqual(result["rubric"]["mode"], "metrics")
        self.assertEqual(result["items"][0]["met"], False)

    @override_settings(
        LLM_BASE_URL="https://example.test/v1",
        LLM_API_KEY="test-key",
        LLM_MODEL="test-model",
    )
    @patch("core.ai.gather", return_value={})
    @patch("core.ai.requests.post")
    def test_invalid_rubric_score_falls_back_to_metric_check(self, post, _gather):
        invalid = {**self.response_data, "rubric": [{**self.response_data["rubric"][0], "score": 20}]}
        response = Mock()
        response.json.return_value = {"choices": [{"message": {"content": json.dumps(invalid)}}]}
        post.return_value = response

        result = review_submission(
            "student/project", self.task, self.rubric, ["README.md"], {"tests": 0.3}, {}
        )

        self.assertEqual(result["mode"], "rules")
        self.assertEqual(result["rubric"]["mode"], "metrics")
        self.assertIn("ValueError", result["summary"])
