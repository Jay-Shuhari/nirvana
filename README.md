# Metis

Metis is a GitHub-centered academy platform for software assignments and evidence-based repository evaluation. This repository currently contains a legacy Nirvana/DevTrace implementation; the product is being redesigned from the top. The target behavior is specified in [PRD.md](PRD.md).

## Status

- **Product target:** Metis requirements, flows, and logical schemas are in [PRD.md](PRD.md).
- **Rebuild guidance:** [CLAUDE.md](CLAUDE.md).
- **Current code:** the Django/React app now has the Metis landing page, Google/GitHub sign-in (Firebase, verified server-side), progressive onboarding (matric, strengths, GitHub link + App), server gates for enrolment/start, App-only repository selection, course groups, the merged inbox and dashboard widgets. Per-task attempt limits, scheduled reminders and reference repositories are **not implemented yet**. See [tasks.md](tasks.md).
- **Setup for sign-in and GitHub:** [docs/Firebase-GitHub-Setup.md](docs/Firebase-GitHub-Setup.md). **Open product questions:** [questions.md](questions.md).
- **Deployment:** [git.md](git.md) documents a prior Nirvana deployment configuration. Treat its domains and provider settings as legacy until verified and replaced for Metis.

Do not infer that a feature is implemented or deployed because it appears in the PRD.

## Target student experience

1. Visit the public Metis landing page.
2. Sign up/sign in with Google or GitHub.
3. Link a GitHub account and authorize the Metis GitHub App before course enrollment or assignment participation.
4. Progressively complete required onboarding, including matriculation number and developer-strength questions.
5. Enroll in an academy course.
6. Open an assignment with its own instructions, requirements, reference materials, deadline, rubric, and attempt limit.
7. Start the assignment and select only a repository fetched from the student's Metis App installation. Arbitrary public repositories and manual repository URLs are not accepted.
8. Submit; each accepted submission consumes one of the supervisor-configured assignment attempts.
9. Review criteria, evidence, AI/fallback provenance, and supervisor feedback.

## Target supervisor experience

1. Sign up/sign in with Google or GitHub, link GitHub, and receive supervisor access through academy policy.
2. Create and manage academy courses.
3. Create assignments with instructions, requirements, optional reference repositories, deadlines, flexible rubric criteria, and a maximum number of submissions.
4. Review student attempts and evidence; override recommendations with a written reason when needed.

Assignment reference repositories are optional. A supervisor must grant the Metis App access; enrolled students receive read-only access through Metis. New assignments send email notifications, with default due reminders 24 hours and 5 hours before the deadline. Students manage reminder preferences in Settings.

## Legacy development setup

The commands below run the existing application for inspection and maintenance; they do not produce the new Metis product described in the PRD.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

### Frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Use only non-production test credentials. Never commit secrets or place server credentials in `VITE_*` variables.

## Documentation

- [PRD.md](PRD.md) — Metis product requirements, workflows, schemas, design requirements, and unresolved decisions.
- [CLAUDE.md](CLAUDE.md) — project-specific instructions for the rebuild.
- [docs/Architecture.md](docs/Architecture.md) — legacy architecture and target boundaries.
- [docs/Data-Model.md](docs/Data-Model.md) — legacy tables and target logical schema.
- [docs/AI-Analysis.md](docs/AI-Analysis.md) and [docs/Scoring.md](docs/Scoring.md) — current evaluation implementation and target guardrails.
- [git.md](git.md) — prior deployment instructions; not Metis production configuration.

## Legacy API

The existing `/api` endpoints are not the target API contract. The PRD describes the target capabilities; settle route shapes and provider callbacks as part of the rebuild's API design.

## Legacy database

The existing Django migrations define the current database. Do not apply a destructive schema rewrite to an existing deployment. Design the new schema and any migration/import strategy separately, preserving historical submissions and audit records where required.
