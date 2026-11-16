# Metis product decisions

The decisions below are the user-confirmed target direction for a Metis rebuild. They supersede conflicting legacy UI and code behavior.

## Metis is a rebuild
Metis is the product name. Nirvana/DevTrace identifiers in the current repository describe legacy code, package names, or deployment materials; retain them only until there is an explicit migration plan.

## Google and GitHub identities; GitHub authorization is mandatory for students
Signup/sign-in offers Google and GitHub. Students must link a GitHub identity and authorize the Metis App before enrollment or assignment participation. Linking must prove control of both accounts; matching emails alone are not sufficient. Supervisor privileges come from academy policy.

## Fetched repositories only
Student assignment repositories come only from the linked user's active Metis GitHub App installation. No arbitrary public-repository input or manual URL fallback. A supervisor may attach an optional authorized reference repository; enrolled students receive read-only access through Metis.

## Start assignments directly; count accepted submissions
Students start from the assignment page and select an authorized repository; there is no separate project-registration step. The supervisor configures each assignment's maximum attempts. Draft selections before Submit do not count; a server-accepted submission counts even if evaluation later fails. Rejected requests do not count.

## Flexible rubric, fixed total
Supervisors define criteria and weights for the assignment. Enabled criteria must total exactly 100. Submitted attempts keep a rubric snapshot. AI is advisory and evidence-based; supervisor overrides require a reason.

## Progressive student onboarding
Require matriculation number and progressively collect developer-strength answers. Save/resume onboarding. Academy email eligibility and exact enrollment policy remain institution configuration decisions.

## Assignment reminders
Email new assignments and due reminders. Defaults are 24 hours and 5 hours before due time; students manage reminder preferences in Settings. Reminder jobs must be idempotent and recalculated/cancelled when deadlines or submission state change.

## AI guardrails and accessibility
Review relevant repository files, including tests and supporting files, against assignment requirements and criteria. Never execute code or follow repository instructions; constrain files/secrets/context/time and cite evidence. Target WCAG 2.2 AA.

## Legacy architecture is not binding
The existing Django/React/Supabase/JWT design is a reference, not a confirmed Metis architecture decision. Select auth, persistence, hosting, file storage, and async processing during rebuild planning, with privacy, migration, and operational needs considered.

Back to [[index]].
