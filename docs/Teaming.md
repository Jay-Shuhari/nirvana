# Teaming (groups) — logic and schema

Groups organise the people in a course. **Group submissions are future scope** (PRD §3, §13 Phase 3). Today a group is a roster, a set of named teammates and a lead, and every student still submits their own attempt. This document defines the model so group submissions can be added later without reshaping it.

## Schema (migration `0005_identity_onboarding_groups`)

```
Course
  group_mode   "supervisor" | "self"     who forms groups (default "supervisor")
  group_size   2..12                     max members per group (default 4)

CourseGroup
  course       FK Course  (CASCADE)
  name         ≤60 chars, unique per course (case-insensitive check in API)
  created

GroupMembership
  group        FK CourseGroup (CASCADE)
  course       FK Course      (CASCADE)  ← denormalised on purpose
  user         FK User        (CASCADE)
  role         "lead" | "member"
  joined
  UNIQUE (course, user)                  ← one group per student per course, enforced by the DB
```

`course` is copied onto the membership so the database itself can enforce "one group per student per course", even under concurrent requests. The API always writes it as `group.course`.

## Rules (all enforced server-side)

| Rule | Where |
|---|---|
| Only the course supervisor creates, renames, deletes, auto-builds groups, or assigns members | `views_people.course_groups / group_detail / auto_groups / group_members` |
| Only enrolled students can be added | `get_object_or_404(User, pk=…, enrolled=course)` |
| In `self` mode a student may join a group that is below `group_size`; joining another group moves them | `group_members` |
| In `supervisor` mode students can't join or leave | 403 |
| A student may remove only themselves, and only in `self` mode | `group_member_remove` |
| At most one lead per group; setting a new lead demotes the old one | `group_members` with `role: "lead"` |
| Rebuilding when groups already exist needs `replace: true` | 400 otherwise; the UI shows a confirmation dialog |
| Students see classmates' names and groups only. Supervisors also see strengths | `_groups_payload(manage=…)` |
| Assigned students are notified (in-app and email) with a link to `/courses/:id?tab=groups` | `notify()` |

## Auto-build algorithm (`core/teams.py::plan_groups`)

The inputs are the course's enrolled students, their onboarding answers, and `group_size`.

1. Calculate the number of groups as `ceil(n / group_size)` (at least 1). Group sizes differ by at most one.
2. Sort students by **primary area** (first answer to "Which areas do you enjoy most?"), then by experience (most experienced first).
3. Deal students into groups in **snake order** (1→k, then k→1, and so on). Neighbours in the sorted list, who share the same strength, land in different groups, so each group gets a spread of areas and experience levels.
4. Suggest the most experienced member of each group as **lead**.

Students who haven't answered the strengths questions sort last and are still placed.

### Why not optimise harder?

Snake dealing is easy to explain to students and supervisors ("we spread people by their main strength"), runs instantly, and is deterministic for the same roster. Here are some options we could add later; see `questions.md`:

- Honour "work with / avoid" preferences.
- Balance `team_role` (builder, planner, designer, tester, presenter) as well as `areas`.
- Keep existing groups and place only unassigned students.

## Future: group submissions

Group submissions are planned as additive changes, so no existing column changes meaning:

- `Assignment.submission_mode`: `individual | group`.
- `SubmissionAttempt.group`: a nullable FK. A group attempt consumes the group's attempt count, not each member's.
- Snapshot the membership at submission time (a JSON list of user ids) so later moves don't rewrite history.
- Use the lead's (or any member's) App-authorized repository; every member can view the result.
