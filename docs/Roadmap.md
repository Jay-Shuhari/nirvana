# Metis rebuild roadmap

The target is defined in [PRD.md](../PRD.md). Existing Nirvana/DevTrace code is a legacy reference; completed checkboxes below describe prior implementation, not Metis readiness.

## Phase 0 — Product and technical foundation

- [ ] Confirm academy email policy, enrollment/approval flow, identity recovery, developer-strength question set, deadline timezone, reminder preferences, AI privacy/retention, and operational targets.
- [ ] Inventory legacy code/data and decide which components can be reused safely.
- [ ] Select the Metis hosting, identity, database, file storage, email, and job-processing architecture.
- [ ] Define shared API and validation contracts, migration/import approach, and auth threat model.
- [ ] Establish Metis design tokens, typography, interaction patterns, accessibility baseline, and responsive page shell.

## Phase 1 — Public identity and onboarding

- [ ] Build public landing page with clear Google/GitHub signup and sign-in.
- [ ] Implement secure provider linking without silent email-based account merging.
- [ ] Require linked GitHub identity and Metis GitHub App authorization before student enrollment/use.
- [ ] Build progressive onboarding for matric number and versioned developer-strength questions with save/resume.
- [ ] Provision supervisor access through academy policy/invitation rather than public role selection.
- [ ] Add end-to-end tests for provider callbacks, linking, school eligibility, and unauthorized access.

## Phase 2 — Courses and assignments

- [ ] Build academy/course enrollment and supervisor roster tools.
- [ ] Build assignment creation and context-rich assignment detail pages.
- [ ] Add instructions, requirements, optional supervisor-authorized reference repository, due time, and configurable maximum attempts.
- [ ] Add flexible rubric editing with live and server-side exact-100% enabled-weight validation.
- [ ] Add email for new assignments and deduplicated 24h/5h due reminders with student preferences.

## Phase 3 — Repository and evaluation

- [ ] Provide only repositories fetched from each user's Metis GitHub App installation; remove manual/public-repo entry paths.
- [ ] Make assignment start and repository selection one workflow without separate project registration.
- [ ] Safely fetch relevant source files, tests, and supporting files from the selected repository.
- [ ] Add guarded AI/rule evaluation with file/secret/runtime limits, evidence citations, and visible provenance.
- [ ] Implement atomic attempt allocation, deadline enforcement, retry history, evaluation status, and supervisor overrides.
- [ ] Add reference-repository access tests and AI safety/privacy tests.

## Phase 4 — Quality and operations

- [ ] Meet WCAG 2.2 AA across core workflows; test keyboard, screen reader, contrast, responsive, and reduced motion.
- [ ] Add monitoring for OAuth, GitHub, email, evaluation, and background-task failures without logging secrets.
- [ ] Define backup, retention, deletion, uptime, evaluation-latency, and capacity targets.
- [ ] Run production verification against configured Metis services before release.

## Future scope

- [ ] Group/team assignments and shared submissions.
- [ ] Feedback threads, exportable reports, reusable rubric templates, and additional academy analytics.

## Legacy implementation

The old tasks and completed work are documented in repository history and the legacy code. They should not be marked as Metis-complete until rebuilt and verified against the PRD.
