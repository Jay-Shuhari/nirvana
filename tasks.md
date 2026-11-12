# Nirvana implementation tasks

Priorities reflect security and workflow dependencies. Each item includes its completion check.

## P0 — Core access and submission integrity

- [x] **GitHub App access and webhook:** Add a signed installation flow, verify installations server-side, persist the user-to-installation association, expose only installed repositories, use installation tokens for private repository reads, and verify GitHub webhook signatures. Configure the exact setup and webhook routes in deployment guidance.
  - **Check:** API tests reject forged/expired setup state, unknown installations, invalid webhook signatures, and repository access outside the installation.
- [x] **Session and route restoration:** Persist access/refresh tokens, refresh expired access tokens once, retain the requested deep link across reloads/login, and return expired sessions to sign-in without losing their route.
  - **Check:** API client retries a protected request after refresh; invalid refresh tokens clear the session; deep links still load directly.
- [x] **One submission and deadlines:** Permit only one evaluation attempt per project/task, enforce the task due date on the server, and show clear deadline/submission states in the UI.
  - **Check:** duplicate and late submissions are rejected, including concurrent attempts; valid first submissions still evaluate.

## P1 — Teaching workflow and communication

- [x] **Task detail navigation:** Make task rows open a detail page with requirements, deadline, and the students/projects assigned to that task; link directly from task views to student projects.
  - **Check:** supervisors see the task roster; students see their own task/project state; access is scoped to the course.
- [x] **Animated task deletion:** Remove confirmation for task deletion, animate the task left immediately, hide it while the server deletes it, and restore it with an error if deletion fails.
  - **Check:** successful deletion stays hidden and failed deletion restores the task.
- [x] **Email notifications:** Keep the in-app inbox and send corresponding email notifications for task assignment, submissions, and grading/score changes. Make SMTP and frontend URL configurable through backend-only environment variables.
  - **Check:** mocked email tests cover notification events and SMTP failures without breaking the in-app notification.
- [x] **Enable/disable rubric criteria:** Add a persisted criterion toggle, score enabled criteria only, and require enabled weights to total 100%.
  - **Check:** disabled criteria are excluded from AI/rule scoring and cannot receive new scores; existing rubrics remain enabled by default.

## P2 — Product experience and identity

- [x] **Optional mobile-style layout:** Add a saved layout choice with bottom navigation; place account, settings, help, and sign-out actions in an avatar menu with notifications beside it.
  - **Check:** both layout choices work at desktop/mobile sizes, preserve theme and routes, and expose keyboard-accessible controls.
- [x] **Ttonpa identity:** Replace provider-specific wording in evaluation output with the assistant mascot name **Ttonpa**, without implying that Ttonpa is a model provider.
  - **Check:** review UI contains no Gemini-branded grading/output labels.

## P3 — Hosting readiness and final verification

- [x] **Deployment configuration and guide:** Document persistent database requirements, required GitHub App setup/webhook URLs, email SMTP settings, Vercel frontend settings, and production checks. Do not claim a deployment is live unless it can be verified.
  - **Check:** environment examples and deployment instructions match the implemented routes/settings; external deployment credentials/host details are recorded as manual prerequisites if unavailable.
- [x] **Regression validation:** Run backend tests, Django checks/migration checks, and frontend production build; fix failures caused by this work.
  - **Check:** all targeted checks pass and migration files are present.
