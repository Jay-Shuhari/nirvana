from django.contrib import admin
from .models import User, Course, Project, Submission, CriterionScore
for m in (User, Course, Project, Submission, CriterionScore): admin.site.register(m)
