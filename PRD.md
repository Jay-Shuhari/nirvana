# Metis Product Requirements Document

| Field | Value |
|---|---|
| Product | Metis |
| Document status | Rebuild product requirements; existing implementation is a legacy reference, not the target contract |
| Last updated | 2026-11-13 |
| Source of truth | This document defines product intent; implementation details remain in code and technical documentation |

## 1. Executive summary

Metis is a GitHub-centered learning and assignment platform for an academy. Supervisors publish assignments, learning materials, deadlines, and flexible rubrics. Students create an account with Google or GitHub, link GitHub if they used Google, complete progressive onboarding, join their school course, choose an already-authorized repository, and submit it for evaluation. Metis reviews repository files, including tests and supporting material, against the assignment requirements and supervisor-authored criteria using explicit AI guardrails. Supervisors remain accountable for grading and can override recommendations with a written reason.

Students must never add an arbitrary public repository. Repository choices come only from the linked student's GitHub account through the Metis GitHub App installation. A supervisor may attach an optional reference repository to assignment materials; access is granted to Metis by the supervisor and exposed only to eligible students for that assignment.

The experience begins with a public landing page and clear sign-in/sign-up. Each page presents the information and actions needed for its specific workflow. Onboarding progressively collects a required matriculation number and the student's developer strengths. This document is the target product contract for a fresh rebuild; it does not assert that the current code already implements these requirements.

## 2. Problem and opportunity

An academy needs a consistent way to distribute software assignments and assess work in students' existing GitHub repositories. Students need a simple path from school identity to course enrollment, task materials, repository selection, submission, and explainable feedback. Supervisors need control over assignment requirements, reference material, rubric weights, and the number of allowed submissions.

The product should reduce:

- Unnecessary project-registration steps between opening an assignment and starting work.
- Manual repository entry, public-repository fallbacks, and uncertainty about which repositories Metis can access.
- Unclear separation between student identity, academy enrollment, GitHub authorization, and developer-profile onboarding.
- Opaque or inconsistent AI evaluations, attempt limits, reminders, reference materials, and submission failures.
- Divergence between product requirements, data/API contracts, UI behavior, and implementation guidance.

## 3. Product goals and non-goals

### Goals

1. Support a complete supervisor-to-student course, task, repository, evaluation, and review lifecycle.
2. Make each role's permissions, available actions, and workflow state explicit.
3. Keep scoring explainable through criteria, evidence, and transparent AI/metric recommendations.
4. Treat database, API, validation, and UI/form schemas as related contracts with consistent constraints.
5. Provide an accessible, responsive, cohesive design system for all product surfaces.
6. Preserve secure server-side authorization and protect repository and account data.

### Non-goals for the initial rebuild

- Allow students to submit arbitrary public repositories or type repository URLs manually.
- Replace institutional course/enrollment workflows with an open social network.
- Provide a native mobile application; responsive web is the initial target.
- Let AI make unreviewable or binding grading decisions.
- Let a student bypass the mandatory linked GitHub account before enrollment and submission.
- Claim integrations or production behavior are implemented until verified against the rebuilt system and live services.

## 4. Users and permissions

### Student

- Sign up/sign in with Google or GitHub; if Google is used, link and authorize a GitHub account before enrollment.
- Complete progressive onboarding, including required matriculation number and developer-strength questions.
- Join the academy course using its approved enrollment mechanism and school identity.
- View assignment instructions, requirements, reference materials, due date, allowed attempts, and own submission state.
- Pick only from repositories returned for the student's linked GitHub account by the Metis GitHub App.
- Start an assignment directly from the assignment page; do not create a separate project record first.
- Submit an eligible repository state and view attempt count, score, criteria, evidence, and feedback.
- Configure assignment reminder preferences in Settings.

### Supervisor

- Sign up/sign in with Google or GitHub and link/authorize a GitHub account.
- Create and manage academy courses and rosters.
- Create assignments with instructions, requirements, due date, optional GitHub reference repository, flexible rubric criteria, and a per-task maximum submission count.
- Grant Metis GitHub App access to a reference repository so eligible students can view its files/instructions.
- Review student submissions, attempt history, rubric evidence, and AI recommendations.
- Override criterion scores or an overall grade with a required reason.
- Configure assignment reminder policy and receive relevant course activity notifications.

### System

- Authenticate Google/GitHub identity and securely link provider identities to one Metis account.
- Require verified school email/academy eligibility as configured by the institution; never infer eligibility solely from a GitHub username.
- Verify student and supervisor GitHub App installations and expose only repositories granted to the relevant installation.
- Enforce academy/course/assignment/attempt limits server-side.
- Analyze repository files, tests, and assignment materials under explicit safety, privacy, and size guardrails.
- Persist evaluation evidence/provenance and deliver assignment, due-date reminder, submission, and grading emails.

## 5. Product scope and workflows

### 5.1 Supervisor workflow

1. Sign up/sign in with Google or GitHub; link GitHub and complete supervisor profile/academy verification.
2. Create a course and enroll/approve students using the academy's enrollment process.
3. Configure a flexible rubric; enabled criteria must total exactly 100%.
4. Create an assignment with its own instructions, requirements, due date, optional reference repo, rubric, and maximum submission count.
5. Review student submissions and attempt history for that assignment.
6. Review score recommendations, relevant source/test evidence, and requirement results.
7. Optionally override a criterion or overall score with a reason; the change and reason are visible to the student.

### 5.2 Student workflow

1. Visit the public landing page and sign up with Google or GitHub.
2. If signup used Google, link GitHub before proceeding; install/authorize the Metis App for the account.
3. Complete progressive onboarding: required matriculation number, then developer-strength questions in manageable steps.
4. Join/enroll in the academy course using the school workflow.
5. Open an assignment page containing its own instructions, reference repo, requirements, deadline, attempt limit, and submission status.
6. Start the assignment, choose from the linked account's Metis-App-authorized repository list, and work without a separate project registration flow.
7. Submit before the deadline. Each accepted submission consumes one of the supervisor-configured attempts; draft selection/changes before submit do not.
8. Review the result, evidence, attempt count, and any supervisor adjustments.

### 5.3 GitHub connection workflow

1. A user authenticates with Google or GitHub. A Google-authenticated user must link GitHub before enrollment/assignment participation.
2. The user installs/authorizes the Metis GitHub App. For the academy workflow, configure the App for all repositories on the linked academy account when the user explicitly grants that scope.
3. The backend verifies the installation, links it to the correct Metis user, and returns only repositories fetched through that installation.
4. Student assignment repository selectors display only those fetched repositories. No free-text repository URL or public-repository bypass is allowed.
5. A supervisor selects an optional reference repository from their fetched list when creating/editing assignment materials; the App installation must grant backend access for student viewing.
6. Revoked, suspended, or deleted access removes the repository from selectable options and blocks future reads; explain the state and recovery action.

Connection state is distinct from repository count. A valid installation with no repositories, a disconnected identity, and a GitHub service error are separate states.

### 5.4 Public landing and account workflow

1. Public landing page explains Metis for academy students/supervisors and provides sign-up/sign-in actions.
2. Authentication offers Google and GitHub identity providers, with safe account linking and duplicate-account handling.
3. Role selection or invitation/academy policy determines student versus supervisor capabilities; users cannot self-upgrade to supervisor.
4. Progressive onboarding asks for matric number and developer strengths, with progress, save/resume, validation, and back navigation.
5. GitHub link/Metis App authorization is a required onboarding gate before enrollment or assignment participation.
6. Each page provides context-specific instructions, validation, loading/empty/error states, and next actions; avoid dumping unrelated settings or generic forms on a page.

## 6. Functional requirements

Priority: **P0** = essential for safe core workflow; **P1** = important product quality; **P2** = planned enhancement.

### Identity and access

- **P0** A public landing page leads to sign-up/sign-in with Google and GitHub identity providers.
- **P0** GitHub must be linked and Metis App access authorized before a student can enroll or participate, regardless of initial signup provider.
- **P0** Onboarding progressively collects a required matriculation number and the student's developer strengths; progress can be saved and resumed.
- **P0** Supervisor capabilities are granted through academy policy/invitation, not an unrestricted public role selector.
- **P0** Account linking prevents duplicate identities and requires proof of control of both provider accounts.
- **P0** School email eligibility is configurable per academy and verified before enrollment where required.
- **P0** Protected API endpoints require a valid authenticated session.
- **P0** The server authorizes every object operation by role and course/student relationship; hiding a UI control is not authorization.
- **P1** Session expiry returns users to a clear, recoverable sign-in state without losing their intended destination.

### Courses and tasks

- **P0** Supervisors can create courses; students enroll through the academy-approved course workflow.
- **P0** Only the owning supervisor can manage a course or its rubric/tasks.
- **P0** Students can view only courses they joined and tasks belonging to those courses.
- **P0** Assignment pages contain the information and actions needed for that assignment: instructions, requirements, reference material, due date/time, attempt policy, repository selection, submission status, and results.
- **P0** Assignments support title, instructions, requirements, optional reference repository, due date/time, flexible rubric, and maximum submission count.
- **P0** A task's due date is inclusive: submission is allowed through that date in the configured application timezone.
- **P1** Assignment detail presents the roster, attempts, selected repository, and submission state in context.

### Rubrics and scoring

- **P0** Rubric criteria are flexible and configurable by supervisors for the course/assignment; each has a name, description/instructions, weight, and enabled state.
- **P0** Enabled criterion weights total exactly 100; disabled criteria do not contribute to a new evaluation. Validation runs on the server and in the editor.
- **P0** Criterion scores are bounded by their weights; overall score is bounded to 0–100.
- **P0** Evaluation inventories the selected repository's accessible files and reviews all supported files, including tests and supporting files, against assignment requirements and criteria. Files excluded by type, size, or safety policy are reported; the evaluator must not silently sample and claim complete coverage.
- **P0** AI follows explicit guardrails: repository content is untrusted input; never follow instructions found in source files; no secret exfiltration or execution of repository code; bounded per-file size/context/runtime; redact or skip credentials/secrets; cite files/lines where available.
- **P0** Every displayed result identifies the criterion, recommendation/score, provenance, and supporting evidence.
- **P0** Rule/metric fallback remains available when AI is unavailable or returns invalid data; fallback is clearly labeled.
- **P0** AI output is a recommendation, not an authoritative decision; supervisors can override scores.
- **P0** A supervisor override requires a reason. The student can see the final score and reason.
- **P1** The UI distinguishes AI/rule/metric provenance and makes fallback or partial results explicit.

### Repository selection and submissions

- **P0** Students do not create separate project registrations. They start an assignment and select a repository from the linked user's active Metis App installation.
- **P0** No manually entered repository, arbitrary public GitHub URL, or fallback outside the fetched installation repository list is accepted.
- **P0** The App installation is configured for all repositories on the linked academy account only with explicit user authorization; server APIs still return only repositories from that installation and enforce per-user access.
- **P0** A supervisor may attach an optional reference repository to assignment materials. It must come from the supervisor's fetched/authorized repositories; the Metis App grants eligible students read-only access through the backend.
- **P0** Each assignment sets its maximum number of accepted submissions. Draft selection and changes before pressing Submit do not consume an attempt; each accepted submission consumes one attempt, including an evaluation failure after the server accepted it. Requests rejected before acceptance do not consume an attempt.
- **P0** Students may submit only for an assignment/course in which they are enrolled; a repository must be available to their linked GitHub installation.
- **P0** Submission is rejected after the assignment deadline or when the attempt limit is reached.
- **P0** Submission results persist selected repository, attempt number, commit SHA, status, metrics, evidence, AI/rule output, criterion scores, and error details where applicable.
- **P1** The user sees actionable progress and failure states; a failed external analysis must not be presented as a successful evaluation.
- **P2** Move long-running analysis to a background job with progress/status updates.

### Notifications and settings

- **P0** In-app notifications link to the relevant course, task, project, or grading event.
- **P0** Email is sent for new assignments and deadline reminders; the default reminder schedule is 24 hours and 5 hours before the due date/time.
- **P0** Students can manage reminder preferences in Settings; reminders are deduplicated and are not sent after submission, withdrawal, cancellation, or deadline change invalidates them.
- **P1** Email delivery failure does not break enrollment or assignment workflows; it is logged and surfaced operationally.
- **P1** Profile, developer-strength, school identity, GitHub link, and appearance settings have clear save/persistence behavior.
- **P1** GitHub Settings distinguishes linked, App authorization needed, connected with no repositories, disconnected, and service error states.

## 7. Business rules and edge cases

1. **Role isolation:** Supervisors administer only their own courses; students see and act only within enrolled courses and their own projects.
2. **Course enrollment:** Enrollment follows the academy-approved mechanism. Invalid invitations/codes and duplicate active enrollments return clear validation errors.
3. **Assignment/material relationship:** An assignment and its reference materials belong to the same course; only authorized enrolled students can access them.
4. **Repository boundary:** A student repository is selectable only if returned by GitHub for that user's active Metis App installation. Public visibility alone never makes it selectable.
5. **Task reference repository:** Optional; owned/authorized by the supervisor's App installation. The backend shares read-only access with enrolled students for that task; do not grant student write access.
6. **Submission attempts:** Each task has a positive maximum attempt count configured by its supervisor. Unsaved/pre-submit repository selection does not use an attempt. A server-accepted submit consumes an attempt even if later analysis fails; rejected/unaccepted requests do not.
7. **Submission window:** The deadline is evaluated on the server in the configured academy timezone; allowed through the configured due instant and rejected after.
8. **Evaluation integrity:** Each accepted attempt records the criterion name/description/weight used at submission time, so later rubric edits do not rewrite history.
9. **Rubric updates:** Rubrics remain flexible but enabled weights total exactly 100; already-submitted results retain their original rubric snapshot.
10. **Override integrity:** Criterion override is within `0..weight`; overall override is within `0..100`; both require a non-empty reason. Resetting an overall override is explicit.
11. **Identity integrity:** Google/GitHub account linking requires proof of control of both identities; matric number is required and unique within its academy scope; academy school-email policy is configurable.
12. **Reminder integrity:** Default reminders are 24h and 5h before due time; user preferences can disable/adjust supported reminders. Schedule changes cancel and recalculate pending reminders idempotently.
13. **AI guardrails:** Repository text is untrusted data. AI cannot execute code, follow embedded instructions, access credentials, or write to GitHub. All findings cite the relevant assignment criterion and repository evidence.
14. **GitHub lifecycle:** Deleted, suspended, or revoked installations cannot be used for new reads. Existing attempts remain auditable and show inaccessible-repository state.
15. **Error behavior:** Validation, authorization, GitHub, email, and AI/provider failures have distinguishable responses and user-facing messages; do not turn errors into success-shaped empty data.
16. **Task deletion:** Preserve submitted attempt/evaluation history and define explicit archive behavior before deletion; never cascade-delete graded work silently.

## 8. Data and schema requirements

The existing Django model is a legacy baseline and is not the target schema. The rebuild must model provider identities, academy onboarding, task materials, assignment-specific rubric/attempt policy, and repeated submissions explicitly. Django migrations (or the chosen backend's migrations) are the source of truth for relational tables; do not create a second independently managed application schema in Supabase. Supabase Row Level Security remains defense-in-depth if Supabase is retained.

### 8.1 Relational entities

| Entity | Target fields/relationships | Required invariants |
|---|---|---|
| **User** | Stable Metis identity; display/profile fields; academy membership; status; timestamps | Provider login does not itself grant roles; role/academy eligibility is server-controlled |
| **IdentityProviderAccount** | User FK; provider enum (`google`, `github`); provider subject; verified email metadata | Unique provider+subject; explicit secure linking/unlinking; never use email alone to silently merge accounts |
| **StudentProfile** | User/academy FK; matriculation number; onboarding status; developer strengths structured by versioned questions | Matric required and unique within academy; progressive answers validated and resumable |
| **GitHubInstallation** | User FK; verified installation ID; account login/type; granted repository scope; active/suspended state | Installation belongs to linked GitHub identity; App-fetched repositories are the only student options |
| **GitHubRepository** | Installation FK; GitHub repository ID; canonical full name; visibility; URL; sync timestamp | Cached listing is refreshed from GitHub and never treated as authority after revocation |
| **Academy/Course/Enrollment** | Academy policy (email domains, onboarding); course ownership; explicit student enrollment status and timestamps | School-domain policy configurable; server enforces accepted enrollment |
| **Assignment** | Course FK; title/instructions; requirements; due datetime/timezone; max submissions; status; optional reference repo FK; rubric snapshot/configuration | Attempt limit is positive; due date and reference access are validated; only authorized supervisors edit |
| **AssignmentMaterial** | Assignment FK; type (`link`, `file`, `reference_repository`); title/description; URL/storage key; ordering | Materials are authorized for the enrolled course; uploaded files use safe type/size policy |
| **RubricCriterion** | Assignment/course FK; name, instructions, weight, enabled/order; optional metric mapping | Enabled weights total exactly 100; criteria versioned/snapshotted per accepted attempt |
| **SubmissionAttempt** | Assignment, student, selected repository, attempt number, commit SHA, status, submitted/evaluated timestamps, error | Unique sequential attempt per student+assignment; attempts cannot exceed configured max; accepted submit consumes one |
| **CriterionResult / EvaluationEvidence** | Attempt FK; criterion snapshot, score, provenance, rationale, file/path/line evidence; supervisor override/reason | Scores bounded by criterion weight; overrides require reason; historical results immutable except audited override |
| **ReminderPreference / ScheduledReminder** | User/assignment preference; scheduled due offsets; sent/cancelled state and idempotency key | Defaults 24h and 5h; per-user preference; cancel/recalculate on submission or deadline change |
| **Notification** | User FK; event type; resource reference; read state; created timestamp | Recipient-only; resource authorization is rechecked when opening |

### 8.2 JSON and enum contracts

These are logical contracts, not a commitment to retain JSON storage indefinitely. All JSON payloads must be validated at the application boundary and have versioning/compatibility considered before changing shape.

**Assignment rubric criterion**

```json
[
  {
    "name": "Testing",
    "instructions": "Assess tests relevant to the assignment requirements.",
    "weight": 15,
    "enabled": true,
    "order": 1
  }
]
```

- `name`: trimmed non-empty string, at most 80 characters.
- `instructions`: criterion-specific guidance used by the evaluator.
- `weight`: integer from 0 to 100. Enabled weights sum to 100.
- `enabled`: boolean.

For the rebuild, do not depend on implicit legacy defaults. Define a versioned rubric contract and validate it at save and evaluation time. Assignment rubric weights for enabled criteria must total exactly 100.

**Assignment requirements/materials:** Requirements are a validated list of instructions/checkable criteria. Reference repository is an optional authorized GitHub repository ID, not arbitrary URL input. File/link attachments carry explicit type, size, ownership, and visibility metadata.

**Evaluation output:** Versioned structure with `mode`/provenance, criterion result list, scores bounded by weights, concise rationales, and evidence references to repository paths/lines where available. Provider output is validated before persistence. Malformed/unavailable AI output follows a documented labeled fallback; it is never represented as a valid AI result.

**Attempt status:** Define stable values such as `queued`, `running`, `completed`, and `failed`; a failed accepted attempt remains in attempt history and counts toward the task limit. User-facing labels and retry/remaining-attempt actions map explicitly to server state.

**Developer strengths:** Store responses against a versioned question set; keep raw profile responses separate from inference/derived tags so future questions do not corrupt prior data.

### 8.3 Schema change requirements

- Use the selected ORM/database migration system for relational schema changes and include migration/backfill behavior for existing rows.
- Preserve existing data and API compatibility where practical; breaking changes require versioning or a coordinated frontend/backend rollout.
- Define validation at the API boundary even where the database type is JSON.
- Add database constraints for invariants that must hold under concurrent requests, not only UI checks.
- Ensure deletion behavior is deliberate and documented (`CASCADE`, `SET_NULL`, or retained audit record).
- Re-run the Supabase RLS locking procedure after migrations and verify every public application table has RLS enabled and no unintended browser grants.
- Do not put provider credentials, GitHub private keys, installation tokens, or service-role credentials in frontend schemas or browser storage.

## 9. API and validation contracts

The backend is the source of truth for authorization, validation, data transformation, and external API access. The current legacy API is JSON over `/api` with JWT; the Metis API and session contract must be designed for the selected Google/GitHub identity and authorization architecture.

| Area | Target API capability (route names are implementation decisions) | Contract requirements |
|---|---|---|
| Identity | OAuth start/callback for Google/GitHub; linked-account management; session endpoints | Secure state/nonce, account linking, verified claims, duplicate prevention, role policy |
| Onboarding | Profile, matric, academy eligibility, strengths question-set/answers, completion status | Progressive save/resume; required fields gate enrollment; versioned responses |
| Courses | Course list/detail, enrollment/join, roster | Academy and role scoping; enrollment state; no client-only authorization |
| Assignments | Create/edit/list/detail; materials; rubric; attempt policy | Supervisor ownership; requirements, due-time, reference repository access, max-attempt validation |
| Repositories | List/sync repositories fetched from user's active Metis App installation | No arbitrary public repo endpoint or manual repository registration; installation ownership checked |
| Attempts | Start/draft, select authorized repo, submit, get attempt/history | Server assigns attempt number; atomically enforce deadline and maximum; submission is idempotent |
| Evaluation | Status/result/evidence; supervisor overrides | Validate provider response and score ranges; preserve snapshot/provenance; audit overrides |
| Reminders/settings | Reminder preferences and scheduled notification state | Defaults 24h/5h; opt-out/preference schema; deduplication and cancellation |
| Notifications | In-app inbox and email delivery events | Recipient-only; relevant deep link; provider failure observability |

### Request validation

- Reject malformed identifiers, unsupported enum values, invalid nested objects, and extra fields where accepting them could obscure client errors.
- Accept a repository identifier only if GitHub returned it for the user's active installation; do not accept arbitrary text, public URL, or unverified client-supplied installation/repository IDs.
- Enforce score bounds, rubric totals, task-course consistency, enrollment, matric scope, attempt limits, deadlines, installation access, and role permissions on the server.
- Return stable, machine-readable field errors plus a human-readable message. Do not rely on clients parsing an arbitrary first value from a response object.
- Document representative success and error response bodies alongside the endpoint as the API evolves; generate or maintain an OpenAPI contract when the API surface is revised.
- Ensure frontend form schemas and messages mirror server rules, while treating server validation as authoritative.

## 10. UX and design-system requirements

### Rebuild page map

Each screen owns the information and actions directly related to its task. Do not rely on users navigating to another page for a required form field or key instruction.

| Page | Required content and actions |
|---|---|
| Public landing | Metis purpose, academy audience, how evaluation works, privacy/GitHub explanation, sign-up/sign-in |
| Sign up/sign in | Google and GitHub provider actions, linking/duplicate-account recovery, terms/privacy, loading/error states |
| Progressive onboarding | Step/progress indicator, required matric number, academy email eligibility, developer-strength questions, back/save/resume, GitHub-link gate |
| Student home | Enrolled courses, upcoming assignments, due dates/reminder state, recent results, next action |
| Course | Enrollment/status, course context, relevant assignment list |
| Assignment detail | Instructions/materials/reference repo, requirements/rubric visibility, deadline/timezone, max/remaining attempts, repo selection, submit/result state |
| Evaluation detail | Overall result, per-criterion score/rationale/evidence, AI/fallback provenance, attempt number, supervisor override/reason |
| Supervisor course | Roster/enrollment, assignments, progress and results |
| Assignment editor | Instructions, requirements, optional reference repo from supervisor's fetched list, due date/time, reminder policy, max attempts, flexible criteria and live 100% weight validation |
| Supervisor evaluation | Student/attempt context, repo/commit, evidence, criterion recommendations, override controls with reason, audit history |
| Settings | Linked Google/GitHub identities, Metis App authorization/repos, profile/matric/developer strengths, reminder preferences, appearance/accessibility |
| Help/privacy | GitHub permissions, repository/AI processing, attempt/reminder rules, support and privacy disclosures |

### Visual baseline and direction

The current frontend has a minimal monochrome style, shared CSS variables, semantic good/warn/bad colors, reusable buttons/panels/badges/tables/toasts/skeletons/forms, system/light/dark appearance, responsive navigation, and reduced-motion rules. Treat it as visual reference only; the rebuild may replace implementation while preserving a calm, high-contrast, accessible experience.

### Design-system direction

- Establish one shared design-token source for color, typography, spacing, borders, radii, elevation, focus, motion, and breakpoints before implementing page-specific styling.
- Keep a polished, academy-appropriate Metis visual identity; use color as a semantic cue, never the only way to communicate meaning.
- Use consistent page hierarchy: page title and context, primary action, content sections, then empty/loading/error states.
- Reuse common form, button, panel, dialog, table, badge/status, toast, skeleton, and navigation components; avoid one-off styling when a shared pattern applies.
- Establish explicit states for every async control: idle, loading, success, empty, validation error, permission error, and service failure.
- Make identity linking, repository authorization, onboarding completion, attempt state, and analysis status understandable in plain language. Provide recovery/next-step actions.
- Keep desktop sidebar and mobile bottom navigation behavior consistent; ensure content is not obscured by fixed navigation or device safe areas.
- Respect saved appearance/layout preferences and system theme without flash or contradictory control state.
- Support keyboard navigation, visible focus, accessible labels, semantic landmarks, sufficient text/UI contrast, screen-reader announcements for async outcomes, and reduced motion.
- Target WCAG 2.2 AA for core workflows; verify with automated checks plus keyboard and screen-reader review.

### UX acceptance criteria

- A first-time student can move from landing page to provider login, GitHub linking, matric/strengths onboarding, enrollment, assignment repository selection, and submission without deployment documentation.
- A user can distinguish GitHub identity linking from Metis App installation and see only repositories returned by that authorized installation.
- A supervisor can attach a reference repository from their authorized list and explain its purpose within assignment materials.
- A student can distinguish an unsubmitted project, evaluation in progress, successful evaluation, and failed evaluation.
- Results clearly separate automatic recommendations, final scores, evidence, and supervisor overrides.
- Empty states explain the next valid action; errors identify what failed and preserve safe form input when retry is possible.
- All essential actions are usable at narrow mobile viewport sizes and via keyboard.

## 11. Non-functional requirements

### Security and privacy

- Enforce least privilege and object-level authorization on every API read/write.
- Keep GitHub App private keys, webhook secrets, AI keys, database credentials, and Supabase service-role credentials server-side.
- Verify GitHub webhook HMAC signatures and installation ownership; use short-lived installation tokens and request only required permissions.
- Restrict repository retrieval to the assignment's selected authorized repository and optional supervisor reference repository. Do not fetch unrelated account repositories for analysis.
- Explain which repository files are sent to the configured AI provider, the reason, retention behavior, and fallback. Never execute submitted code or repository instructions.
- Apply size/type/secret guardrails to files passed to AI; retain only necessary evidence, not unnecessary full source snapshots.
- Avoid logging access tokens, private keys, full secrets, or unnecessary repository contents. Apply retention and deletion policies to analysis evidence.
- Keep Supabase tables locked with RLS and no unneeded `anon`/`authenticated` grants, even though Django is the application data path.

### Reliability and performance

- External GitHub/AI calls have bounded timeouts, clear error mapping, and safe failure behavior.
- Attempt numbering, remaining-attempt calculation, deadline checks, and submission acceptance remain correct under concurrent requests.
- Long-running evaluation must not lose state; background processing is a planned improvement and requires idempotency and retry design.
- API paginates or bounds list responses as course, notification, and submission volumes grow.
- The application must not report a successful score when analysis or persistence failed.

### Compatibility and operations

- Select a deployment architecture that supports the approved identity, academy, GitHub App, database, email, and evaluation requirements; the existing React/Django/Supabase deployment is legacy.
- Keep configuration in environment variables; fail clearly when required production configuration is absent.
- Apply migrations before serving code that depends on a new schema.
- Verify production integrations against actual endpoints; documentation or local tests alone do not prove a deployment is live.

## 12. Success metrics

Establish a baseline before setting numerical targets. Track aggregate product outcomes without collecting unnecessary source-code or personal data.

| Metric | Definition |
|---|---|
| Course activation | Share of created courses with at least one enrolled student and one task |
| Assignment start conversion | Share of assignment views that result in an authorized repository being selected |
| Submission completion | Share of accepted attempts that reach a persisted completed result |
| Evaluation failure rate | Share of accepted attempts ending failed, segmented by GitHub, provider, and internal cause |
| Account-link/onboarding completion | Share of new accounts that link GitHub, complete matric/strengths onboarding, and become eligible to enroll |
| GitHub connection success | Share of provider links/App installations verified and repository lists loaded |
| Attempt utilization | Distribution of attempts used relative to per-assignment limits |
| Reminder delivery | Delivery/duplicate/opt-out rates for 24h and 5h reminders |
| Time to evaluation | Median and 95th percentile from submission request to completed result |
| Feedback usefulness | Student/supervisor feedback on evidence clarity and score explainability |
| Authorization incidents | Count of confirmed cross-user or cross-course access violations; target is zero |
| Accessibility | Core-flow WCAG 2.2 AA audit findings; resolve blocking/critical issues before release |

## 13. Release plan

### Phase 0 — Product and contract alignment

- Adopt Metis as the product name; retain legacy repository/package/deployment identifiers only where migration is not yet done.
- Treat the current application as a legacy reference and start the rebuild from the landing/auth and design-system foundation.
- Confirm academy identity, school-email policy, course enrollment model, and provider-linking rules.
- Align database/API schemas with this PRD before rebuilding screens.

### Phase 1 — Core workflow correctness

- Build landing page, Google/GitHub auth, secure account linking, and progressive required onboarding.
- Build course enrollment and assignment workflow without separate project registration.
- Implement App-fetched-only repository selection, supervisor reference-repo authorization, per-task max attempts, rubric constraints, and deadlines.
- Add contract/security tests for role isolation, provider linking, repository boundaries, attempts, reminders, and concurrent requests.

### Phase 2 — UX and design-system consistency

- Define Metis design tokens and components before page implementation; standardize async, empty, and error states.
- Audit keyboard, screen-reader, contrast, responsive, and reduced-motion behavior across core flows.
- Update product and technical documentation to match shipped behavior.

### Phase 3 — Scale and enhancements

- Design idempotent background evaluation with progress updates and operational monitoring.
- Consider groups/team submissions, feedback threads, reports, and account recovery with explicit privacy/access requirements.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| GitHub App is installed but grants no repositories, appearing disconnected | Represent installation state separately from repository count; show a useful empty state |
| AI output is incomplete, biased, unavailable, or difficult to explain | Validate provider output, retain metric/rule fallback, show provenance/evidence, keep human overrides |
| Duplicate/concurrent submissions exceed the assignment attempt limit | Enforce atomic attempt allocation and idempotent submission acceptance in the database/service layer |
| Data leaks across courses or roles | Server-side object-level authorization, negative tests, least-privilege queries |
| JSON fields drift across API/UI/database | Version/validate logical contracts and add shared contract tests |
| Schema migration disrupts deployed users | Backward-compatible migrations, data backfill, staged deployment, rollback plan |
| Product documentation conflicts with shipped UI | Keep `PRD.md`, `CLAUDE.md`, data/API contracts, and page flows in sync |
| AI or GitHub processing creates privacy expectations mismatch | Disclose file processing clearly, minimize retained data, document provider/retention behavior |

## 15. Assumptions and open decisions

The following user decisions are accepted and are not open questions:

- Product name is **Metis**; the user intends a rebuild from the beginning.
- Student and supervisor sign-in/sign-up offer Google and GitHub; GitHub linking and Metis App authorization are mandatory before student enrollment/use.
- Student onboarding requires matriculation number and progressively asks about developer strengths.
- Students choose only repositories fetched through their linked GitHub account's Metis App installation; no manually added public repositories.
- Supervisors may add an optional GitHub reference repository as assignment material; supervisor grants the Metis App access and students receive read-only access.
- Supervisors configure the maximum accepted submissions per assignment. Draft choices before Submit do not count; every accepted submission counts, including later evaluation failures.
- Rubrics are flexible per supervisor/assignment, and enabled weights must total exactly 100.
- AI reviews repository files, including tests, against assignment criteria and requirements, with guardrails; AI is advisory and evidence-based.
- Group submissions are a future feature.
- Design/accessibility should be solid; WCAG 2.2 AA is the stated target.
- Email covers new assignments and due-date reminders. Defaults are 24h and 5h before due time; students manage reminder preferences in Settings.
- Operational targets ("10" in the user's response) are not numerically specified.

Remaining implementation decisions to resolve during rebuild:

1. What exact academy email domains or verification rules determine eligibility?
2. Is student course enrollment by join code, invitation, supervisor approval, or a combination?
3. Are Google/GitHub the only identity providers, and what is the exact secure account-recovery path?
4. Which developer-strength questions/options and question versioning are approved?
5. What assignment reference-repository formats and access-sharing limits are supported?
6. Which repository file types/sizes are analyzed, and what retention/provider-consent policy applies to source files?
7. Can supervisors edit assignment criteria/deadlines after attempts begin, and how are existing attempts snapshotted?
8. What timezone is authoritative for assignment deadlines and reminders?
9. Which reminder preferences are configurable (disable each default, custom offsets, or both)?
10. Which deployment architecture, hosting domains, provider accounts, scale, uptime, latency, backup, and data-retention targets are required?

## 16. Acceptance checklist

A release that claims to satisfy this PRD must demonstrate:

- [ ] Landing, Google/GitHub auth, account linking, school eligibility, and progressive onboarding work end-to-end.
- [ ] Form/API/database constraints agree for identity, matric, strengths, academy enrollment, assignment materials, rubric, repository, attempts, scores, and overrides.
- [ ] GitHub identity/App authorization and repository list states are clear; selection is restricted to fetched repositories.
- [ ] Supervisor reference repositories are read-only to enrolled students and require verified App access.
- [ ] Assignment maximum attempts, accepted-submission semantics, deadline, retries, and concurrent allocation are tested.
- [ ] Reminder preferences and 24h/5h emails are deduplicated and correctly cancelled/rescheduled.
- [ ] Evaluation results include score provenance, evidence, guardrail behavior, and clear success/failure states.
- [ ] Each page contains the related information, contextual validation, loading/empty/error states, and next actions.
- [ ] Theme/layout, responsive navigation, keyboard operation, focus visibility, and reduced motion are verified.
- [ ] Database migrations preserve existing data and Supabase RLS remains enabled.
- [ ] API/client contract and documentation are updated with any implemented schema changes.
- [ ] Production verification is performed against the actual deployed frontend, backend, database, and GitHub App configuration.

## 17. Related project documentation

- [README.md](./README.md) — setup, workflows, and API overview.
- [CLAUDE.md](./CLAUDE.md) — rebuild guidance and project-specific working conventions.
- [docs/Architecture.md](./docs/Architecture.md) — component and request architecture.
- [docs/Data-Model.md](./docs/Data-Model.md) — current relational model.
- [docs/Scoring.md](./docs/Scoring.md) — scoring inputs and fallback behavior.
- [docs/Roadmap.md](./docs/Roadmap.md) — implementation history and remaining product work.
- [git.md](./git.md) — legacy deployment notes; review before reuse for Metis.
