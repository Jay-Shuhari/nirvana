# ======================================================================
# ANCHOR: urls.py
# FILE: backend/core/urls.py
# ROLE: Maps API URLs to view functions (all prefixed with /api/).
# ======================================================================
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView
from . import views as v

# ANCHOR: API routes
urlpatterns = [
    # SECTION: Accounts and profile
    path("auth/register", v.register), path("auth/login", TokenObtainPairView.as_view()),
    path("me", v.me), path("me/password", v.change_password),
    path("notifications", v.notifications), path("notifications/read", v.notifications_read),
    # SECTION: Courses, rubric, cohort
    path("overview", v.overview),
    path("courses", v.courses), path("courses/join", v.join_course), path("courses/<int:pk>", v.course_detail),
    path("courses/<int:pk>/rubric", v.save_rubric),
    path("courses/<int:pk>/cohort", v.cohort), path("courses/<int:pk>/cohort.csv", v.cohort_csv),
    # SECTION: Tasks
    path("tasks", v.tasks), path("tasks/<int:pk>", v.task_detail),
    # SECTION: Projects, submissions, overrides
    path("projects", v.projects), path("projects/<int:pk>", v.project_detail),
    path("projects/<int:pk>/submit", v.submit), path("criteria/<int:pk>/override", v.override),
    path("submissions/<int:pk>/override", v.override_overall),
]
