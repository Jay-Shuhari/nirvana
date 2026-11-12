from datetime import date
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Course, Project, Task, User


class TaskDetailNavigationTests(TestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user("supervisor@example.com", role="supervisor", first_name="Super")
        self.other_supervisor = User.objects.create_user("other_sup@example.com", role="supervisor")
        self.student1 = User.objects.create_user("student1@example.com", role="student", first_name="Alice", matric="MAT001")
        self.student2 = User.objects.create_user("student2@example.com", role="student", first_name="Bob", matric="MAT002")
        self.unrelated_student = User.objects.create_user("outsider@example.com", role="student", first_name="Eve")

        self.course = Course.objects.create(code="CSC 301", title="Software Engineering", supervisor=self.supervisor)
        self.course.students.add(self.student1, self.student2)

        self.task = Task.objects.create(
            course=self.course,
            title="Design Patterns Assignment",
            description="Build a factory pattern demo.",
            requirements=["Implement Factory", "Write unit tests"],
            due=date(2026, 12, 15),
        )

        self.project1 = Project.objects.create(
            student=self.student1,
            course=self.course,
            task=self.task,
            name="Alice Pattern Demo",
            repo="alice/factory",
        )
        self.client = APIClient()

    def test_supervisor_sees_task_roster_and_all_students(self):
        self.client.force_authenticate(self.supervisor)
        response = self.client.get(f"/api/tasks/{self.task.id}")
        self.assertEqual(response.status_code, 200)
        data = response.data

        self.assertEqual(data["id"], self.task.id)
        self.assertEqual(data["title"], "Design Patterns Assignment")
        self.assertEqual(data["description"], "Build a factory pattern demo.")
        self.assertEqual(len(data["requirements"]), 2)
        self.assertEqual(data["due"], date(2026, 12, 15))

        # Supervisor sees all enrolled students
        self.assertEqual(len(data["students"]), 2)
        student_ids = [s["id"] for s in data["students"]]
        self.assertIn(self.student1.id, student_ids)
        self.assertIn(self.student2.id, student_ids)

        alice = next(s for s in data["students"] if s["id"] == self.student1.id)
        self.assertIsNotNone(alice["project"])
        self.assertEqual(alice["project"]["id"], self.project1.id)
        self.assertEqual(alice["project"]["name"], "Alice Pattern Demo")

        bob = next(s for s in data["students"] if s["id"] == self.student2.id)
        self.assertIsNone(bob["project"])

    def test_student_sees_only_own_state(self):
        self.client.force_authenticate(self.student1)
        response = self.client.get(f"/api/tasks/{self.task.id}")
        self.assertEqual(response.status_code, 200)
        data = response.data

        # Scoped to student
        self.assertEqual(len(data["students"]), 1)
        self.assertEqual(data["students"][0]["id"], self.student1.id)
        self.assertEqual(data["project"]["id"], self.project1.id)

    def test_outsider_cannot_access_task_detail(self):
        # Unrelated student
        self.client.force_authenticate(self.unrelated_student)
        response = self.client.get(f"/api/tasks/{self.task.id}")
        self.assertEqual(response.status_code, 404)

        # Other supervisor
        self.client.force_authenticate(self.other_supervisor)
        response = self.client.get(f"/api/tasks/{self.task.id}")
        self.assertEqual(response.status_code, 404)

    def test_student_cannot_delete_task(self):
        self.client.force_authenticate(self.student1)
        response = self.client.delete(f"/api/tasks/{self.task.id}")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Task.objects.filter(pk=self.task.id).exists())

    def test_supervisor_can_delete_task(self):
        self.client.force_authenticate(self.supervisor)
        response = self.client.delete(f"/api/tasks/{self.task.id}")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Task.objects.filter(pk=self.task.id).exists())
        # Student project is kept (SET_NULL)
        self.project1.refresh_from_db()
        self.assertIsNone(self.project1.task)

