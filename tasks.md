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

## P4 — Metis onboarding, identity, teaming and experience (2026-11-16)

Answers to open product questions are tracked in [questions.md](questions.md). Manual console setup is in [docs/Firebase-GitHub-Setup.md](docs/Firebase-GitHub-Setup.md).

- [x] **Google/GitHub sign-in:** Firebase popup sign-in. The server verifies ID tokens (`/api/auth/firebase`), stores provider identities (`IdentityAccount`), never merges accounts by email, and assigns the supervisor role only through `SUPERVISOR_EMAILS`. Users can link and unlink providers (`/api/auth/link`, `/api/auth/unlink`).
  - **Check:** `test_people.FirebaseIdentityTests`: new user, repeat sign-in, email-collision 409, policy role, unverified email, conflicting link, not-configured 503, role field ignored.
- [x] **Progressive onboarding:** profile (required, unique matric), then versioned strengths questions, then GitHub link and App install. Progress is saved per step and resumes. Students can't skip GitHub; supervisors can.
  - **Check:** `OnboardingTests`: validation, resume, uniqueness, skip rules, completion.
- [x] **Server gates:** joining a course and starting a task need finished onboarding. Starting a task needs a repository from the student's App installation (no manual or public URLs, no task-less projects). The installation must belong to the linked GitHub account. The setup redirect is allow-listed and handles `update`.
  - **Check:** `test_join_requires_finished_onboarding`, `test_start_task_requires_app_repository`, `test_setup_rejects_installation_of_another_github_account`.
- [x] **Public landing page** with code backdrop; split-screen sign-in/sign-up with Google and GitHub and a legacy email option.
- [x] **Dashboard widgets:** student (deadline countdown, progress ring, score trend, coming up, groups, activity, profile) and supervisor (14-day submissions, average, deadlines, needs attention, courses, groups, recent). Data comes from `/api/dashboard`. The overview counts each student once.
- [x] **Courses page:** cards are the main content; create/join is a header button that opens an inline form; search appears when there are more than 6 courses.
- [x] **Course page for students:** tasks with own status, classmates (no emails or matric numbers), and group.
- [x] **Groups tab and teaming schema:** `CourseGroup`, `GroupMembership` (unique course+user), supervisor/self modes, size, auto-build from strengths, lead. See [docs/Teaming.md](docs/Teaming.md).
  - **Check:** `CourseAndGroupTests`.
- [x] **Inbox:** tasks and notifications merged. To-do is grouped by urgency, Activity by day, plus a Done tab. Unread updates show on the matching task row, and each notification can be marked read on its own.
- [x] **Task page repository picker:** distinct states for loading, not configured, GitHub error, nothing installed, installed with no repositories, and the list.
- [x] **Settings:** sign-in methods, GitHub App state, editable strengths; password section only for accounts that have a password.
- [x] **Regression:** 71 backend tests, frontend `npm test`, production build, migration check, and screenshots at 1280–1360 px and 390 px (no horizontal overflow).

### Next (pending)

- [ ] **Max submissions per task (PRD P0):** `max_attempts` on Task; sequential attempt numbers allocated atomically; an accepted submit consumes an attempt even if it fails; replace `submission_locked`.
  - **Check:** concurrency test for attempts; rejected requests don't consume an attempt.
- [ ] **Deadline reminders (PRD P0):** `ReminderPreference` + `ScheduledReminder` (24 h / 5 h defaults), idempotent scheduler, cancelled on submit or deadline change, preferences in Settings.
- [ ] **Supervisor reference repository** on tasks (from the supervisor's App installation, read-only for students).
- [ ] **Deadline time and timezone** once questions.md #12 is answered.
- [ ] **Academy email-domain eligibility** once questions.md #3 is answered.
- [ ] **Accessibility pass:** keyboard and screen-reader review of onboarding, inbox and groups against WCAG 2.2 AA.
- [ ] **Configure Firebase and the GitHub App** in each environment (docs/Firebase-GitHub-Setup.md) and verify against the live deployment.
