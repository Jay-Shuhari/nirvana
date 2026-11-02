# ======================================================================
# ANCHOR: models.py
# FILE: models.py
# ROLE: Database tables (one class = one table). Django turns these into SQL via `makemigrations` + `migrate`.
# SEE:  docs/Architecture.md, docs/Data-Model.md
# ======================================================================
import secrets
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

# ANCHOR: Default rubric
# * Every new course starts with these 7 criteria. Weights MUST total 100.
# * `metric` names the analyzer measurement (backend/core/analyzer.py) that feeds the criterion.
# TODO: let supervisors pick from saved rubric templates (Django project, React project).
DEFAULT_RUBRIC = [
    {"name": "Code quality", "metric": "message_quality", "weight": 20},
    {"name": "Repository", "metric": "repo_hygiene", "weight": 10},
    {"name": "Documentation", "metric": "readme", "weight": 10},
    {"name": "Testing", "metric": "tests", "weight": 15},
    {"name": "Architecture", "metric": "structure", "weight": 15},
    {"name": "Process", "metric": "process", "weight": 20},
    {"name": "Security", "metric": "security", "weight": 10},
]

# ? Why a function and not a lambda? Django migrations cannot serialise lambdas.
# ANCHOR: Model helpers
def new_join_code(): return secrets.token_hex(3).upper()
def default_rubric(): return list(DEFAULT_RUBRIC)

# ANCHOR: User model
# * Extends Django's built-in user so login, passwords and admin come for free.
# ? Why username = email? The register view sets username to the email so people log in with it.
# TODO: add email verification and password reset.
class User(AbstractUser):
    ROLES = [("student", "Student"), ("supervisor", "Supervisor")]
    role = models.CharField(max_length=12, choices=ROLES, default="student")
    matric = models.CharField(max_length=30, blank=True)
    department = models.CharField(max_length=80, blank=True)

# ANCHOR: Course model
# * A supervisor owns a course; students join with `join_code`; `rubric` is stored as JSON.
class Course(models.Model):
    code = models.CharField(max_length=20)
    title = models.CharField(max_length=120)
    session = models.CharField(max_length=20, default="2026/2027")
    supervisor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")
    students = models.ManyToManyField(User, related_name="enrolled", blank=True)
    join_code = models.CharField(max_length=20, unique=True, default=new_join_code)
    rubric = models.JSONField(default=default_rubric)

# ANCHOR: Project model
# * One student repository inside one course. `repo` is stored as owner/name.
# ANCHOR: Task model
# * A lecturer-defined assignment inside a course. `requirements` is a list of plain sentences
#   (one per line in the UI); the AI/rule check in core/ai.py tests each submitted repo against them.
class Task(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    requirements = models.JSONField(default=list)
    due = models.DateField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)

class Project(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=120)
    repo = models.CharField(max_length=200, help_text="owner/name")
    # ! SET_NULL: deleting a task keeps students' projects (they become "general" course projects).
    task = models.ForeignKey(Task, null=True, blank=True, on_delete=models.SET_NULL, related_name="projects")
    created = models.DateTimeField(default=timezone.now)  # ? default, not auto_now_add: existing rows need a value
    class Meta:
        # ! One project per student per task - stops the "same project uploaded ten times" problem.
        constraints = [models.UniqueConstraint(fields=["student", "task"], condition=models.Q(task__isnull=False), name="one_project_per_task")]

# ANCHOR: Submission model
# * One evaluation of one commit. `metrics` + `evidence` hold analyzer output as JSON.
# ! status is 'failed' when GitHub could not be read; `error` explains why.
# TODO: add a 'running' status once analysis moves to a background job.
class Submission(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="submissions")
    sha = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=10, default="done")  # done | failed
    error = models.TextField(blank=True)
    metrics = models.JSONField(default=dict)
    evidence = models.JSONField(default=dict)
    feedback = models.JSONField(default=list)
    ai = models.JSONField(null=True, blank=True)  # * requirements and rubric review result (core/ai.py)
    overall_override = models.FloatField(null=True, blank=True)
    overall_reason = models.TextField(blank=True)
    created = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ["-created"]

# ANCHOR: CriterionScore model
# * One row per rubric criterion per submission.
# * `auto` = AI rubric recommendation or analyzer metric score. `override` = supervisor's criterion score.
# * A submission-level overall override takes precedence over the sum of criterion scores.
class CriterionScore(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="criteria")
    name = models.CharField(max_length=80)
    metric = models.CharField(max_length=40)
    weight = models.PositiveIntegerField()
    auto = models.FloatField()
    override = models.FloatField(null=True, blank=True)
    reason = models.TextField(blank=True)
    # * `final` is the score everyone sees: supervisor override wins, otherwise the automatic score.
    @property
    def final(self): return self.auto if self.override is None else self.override


# ANCHOR: Notification model
# * Simple in-app inbox. Created by views.notify(); shown on the Notifications page and the sidebar badge.
class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    text = models.CharField(max_length=240)
    link = models.CharField(max_length=120, blank=True)
    read = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ["-created"]
