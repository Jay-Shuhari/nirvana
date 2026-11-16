import smtplib
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Course, CriterionScore, Notification, Project, Submission, Task, User


class EmailNotificationTests(TestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user(
            username="supervisor@example.com",
            email="supervisor@example.com",
            role="supervisor",
            first_name="Super",
        )
        self.student = User.objects.create_user(
            username="student@example.com",
            email="student@example.com",
            role="student",
            first_name="Alice",
        )
        self.course = Course.objects.create(code="CSC 401", title="Capstone", supervisor=self.supervisor)
        self.course.students.add(self.student)
        self.task = Task.objects.create(course=self.course, title="Final Submission")
        self.project = Project.objects.create(
            student=self.student,
            course=self.course,
            task=self.task,
            name="Alice Capstone",
            repo="alice/capstone",
        )
        self.submission = Submission.objects.create(project=self.project, status="done")
        self.criterion = CriterionScore.objects.create(
            submission=self.submission,
            name="Testing",
            metric="tests",
            weight=20,
            auto=14,
        )
        self.client = APIClient()

    @override_settings(
        EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL="noreply@nirvana.test",
        FRONTEND_URL="https://nirvana.example.com",
    )
    @patch("django.core.mail.send_mail")
    def test_task_assignment_sends_email_notification(self, mock_send_mail):
        self.client.force_authenticate(self.supervisor)
        response = self.client.post(
            "/api/tasks",
            {
                "course": self.course.id,
                "title": "New Milestone",
                "description": "Milestone details",
                "requirements": "Write docs\nPass lint",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        # In-app notification created
        self.assertTrue(Notification.objects.filter(user=self.student, text__contains="New task in CSC 401").exists())

        # Email sent
        mock_send_mail.assert_called_once()
        args, kwargs = mock_send_mail.call_args
        subject, body, from_email, recipient_list = args
        self.assertIn("Metis notification", subject)
        self.assertIn("https://nirvana.example.com/tasks/", body)
        self.assertEqual(from_email, "noreply@nirvana.test")
        self.assertEqual(recipient_list, ["student@example.com"])

    @override_settings(
        EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL="noreply@nirvana.test",
        FRONTEND_URL="https://nirvana.example.com",
    )
    @patch("django.core.mail.send_mail")
    @patch("core.views.review_submission", return_value={"mode": "rules", "summary": "Ok", "items": [], "rubric": {"mode": "metrics", "summary": "Ok", "items": []}})
    @patch("core.views.analyze", return_value=("sha123", {}, {}, {"paths": []}))
    def test_submission_sends_email_notification_to_supervisor(self, _analyze, _review, mock_send_mail):
        unsubmitted_project = Project.objects.create(
            student=self.student,
            course=self.course,
            name="Alice Project 2",
            repo="alice/p2",
        )
        self.client.force_authenticate(self.student)
        response = self.client.post(f"/api/projects/{unsubmitted_project.id}/submit", {}, format="json")
        self.assertEqual(response.status_code, 201)

        # In-app notification for supervisor
        self.assertTrue(Notification.objects.filter(user=self.supervisor, text__contains="submitted Alice Project 2").exists())

        # Email sent to supervisor
        mock_send_mail.assert_called_once()
        args, _ = mock_send_mail.call_args
        self.assertIn("submitted Alice Project 2", args[1])
        self.assertIn(f"https://nirvana.example.com/projects/{unsubmitted_project.id}", args[1])
        self.assertEqual(args[3], ["supervisor@example.com"])

    @override_settings(
        EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL="noreply@nirvana.test",
        FRONTEND_URL="https://nirvana.example.com",
    )
    @patch("django.core.mail.send_mail")
    def test_criterion_override_sends_email_to_student(self, mock_send_mail):
        self.client.force_authenticate(self.supervisor)
        response = self.client.post(
            f"/api/criteria/{self.criterion.id}/override",
            {"score": 18, "reason": "Good coverage in tests."},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        # In-app notification for student
        self.assertTrue(Notification.objects.filter(user=self.student, text__contains="adjusted Testing on Alice Capstone").exists())

        mock_send_mail.assert_called_once()
        args, _ = mock_send_mail.call_args
        self.assertIn("adjusted Testing on Alice Capstone", args[1])
        self.assertEqual(args[3], ["student@example.com"])

    @override_settings(
        EMAIL_NOTIFICATIONS_ENABLED=True,
        DEFAULT_FROM_EMAIL="noreply@nirvana.test",
        FRONTEND_URL="https://nirvana.example.com",
    )
    @patch("django.core.mail.send_mail")
    def test_overall_grade_override_and_reset_sends_email(self, mock_send_mail):
        self.client.force_authenticate(self.supervisor)
        # Override
        response = self.client.post(
            f"/api/submissions/{self.submission.id}/override",
            {"score": 88, "reason": "Thorough implementation."},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.student, text__contains="adjusted the overall score").exists())
        self.assertEqual(mock_send_mail.call_count, 1)

        # Reset
        mock_send_mail.reset_mock()
        response = self.client.post(
            f"/api/submissions/{self.submission.id}/override",
            {"score": None},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.student, text__contains="reset the overall score").exists())
        self.assertEqual(mock_send_mail.call_count, 1)

    @override_settings(EMAIL_NOTIFICATIONS_ENABLED=True)
    @patch("django.core.mail.send_mail", side_effect=smtplib.SMTPException("Connection refused"))
    def test_smtp_failure_does_not_break_in_app_notification(self, _mock_send_mail):
        self.client.force_authenticate(self.supervisor)
        # Attempt an action that triggers notify
        response = self.client.post(
            f"/api/criteria/{self.criterion.id}/override",
            {"score": 19, "reason": "Excellent tests."},
            format="json",
        )
        # Endpoint succeeds despite SMTP failure
        self.assertEqual(response.status_code, 200)

        # In-app notification was still created!
        self.assertTrue(
            Notification.objects.filter(user=self.student, text__contains="adjusted Testing on Alice Capstone").exists()
        )

    @override_settings(
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY="test-service-key",
        SUPABASE_EMAIL_FUNCTION_NAME="send-email",
        DEFAULT_FROM_EMAIL="noreply@nirvana.test",
    )
    @patch("core.email.requests.post")
    def test_supabase_email_backend_sends_post_request(self, mock_post):
        from django.core.mail import EmailMessage
        from core.email import SupabaseEmailBackend

        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"ok": True}

        backend = SupabaseEmailBackend()
        email = EmailMessage(
            subject="Task Review",
            body="Review details",
            to=["student@example.com"],
        )
        sent = backend.send_messages([email])
        self.assertEqual(sent, 1)

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://example.supabase.co/functions/v1/send-email")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-service-key")
        self.assertEqual(kwargs["headers"]["apikey"], "test-service-key")
        self.assertEqual(kwargs["json"]["to"], ["student@example.com"])
        self.assertEqual(kwargs["json"]["subject"], "Task Review")
        self.assertEqual(kwargs["json"]["text"], "Review details")

    @override_settings(
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY="test-service-key",
    )
    @patch("core.email.requests.post")
    def test_supabase_email_backend_handles_errors(self, mock_post):
        import requests
        from django.core.mail import EmailMessage
        from core.email import SupabaseEmailBackend

        mock_post.side_effect = requests.RequestException("Network unreachable")

        backend = SupabaseEmailBackend(fail_silently=False)
        email = EmailMessage(subject="Test", body="Body", to=["student@example.com"])
        with self.assertRaises(requests.RequestException):
            backend.send_messages([email])

        silent_backend = SupabaseEmailBackend(fail_silently=True)
        sent = silent_backend.send_messages([email])
        self.assertEqual(sent, 0)

    @override_settings(SUPABASE_URL="", SUPABASE_SERVICE_ROLE_KEY="")
    def test_supabase_email_backend_requires_credentials(self):
        from django.core.mail import EmailMessage
        from core.email import SupabaseEmailBackend

        backend = SupabaseEmailBackend(fail_silently=False)
        email = EmailMessage(subject="Test", body="Body", to=["student@example.com"])
        with self.assertRaises(RuntimeError):
            backend.send_messages([email])
