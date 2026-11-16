# Questions for you

Answer inline under each question (replace `Answer:` with your choice). Each one has a recommended default; where I needed to move forward, I built that default and marked it **(built)**. Once these are answered I'll continue from [tasks.md](tasks.md).

## Identity and onboarding

1. **Can supervisors skip GitHub during onboarding?** Students can't. Supervisors currently can ("Skip for now"), because reference repositories are optional. **(built)**
   Answer:

2. **Which emails make someone a supervisor?** This is set by `SUPERVISOR_EMAILS` (exact addresses or `@staff.domain`). Which addresses or domains should it contain, and should there also be an invite link that a supervisor can send to a colleague?
   Answer:

3. **Should students' school email domain be restricted?** For example, only `@students.uni.edu` could enrol. The PRD lists this as open. Default: no restriction.
   Answer:

4. **What format is the matric number?** It currently accepts 3–30 letters, numbers and `/ . _ -`, and must be unique among students. Is there an exact pattern I should validate, such as `CSC/2021/045`?
   Answer:

5. **Are the developer-strength questions right?** Currently: areas (up to 3), languages (up to 5), experience, team role, and a free-text goal. Should anything be added (for example GitHub experience, availability or time zone) or removed?
   Answer:

6. **Can classmates see each other's strengths?** Right now only supervisors can **(built)**. Showing "Frontend · Backend" next to names would help students pick groups in self-select mode.
   Answer:

7. **Can legacy email/password accounts keep signing in with a password?** They currently can, under "older accounts" **(built)**. Should password sign-in be removed once everyone has linked Google or GitHub?
   Answer:

## Groups

8. **Who forms groups by default?** Currently the supervisor assigns them (`group_mode=supervisor`, size 4) **(built)**. Should new courses default to students choosing instead?
   Answer:

9. **What should auto-build balance?** Currently main area and experience **(built)**. Should it also balance team role, honour "work with / avoid" requests, or keep existing groups and only place new students?
   Answer:

10. **Do you want a group space?** For example a shared note, the group's repositories, or a chat link on each group. Or should groups stay a roster until group submissions arrive?
    Answer:

11. **For group submissions (future):** should a group get one attempt count, should one member submit for everyone, and should the supervisor be able to grade members individually?
    Answer:

## Tasks, inbox and notifications

12. **Should deadlines have a time?** Due dates are calendar dates that stay open until midnight. Do you want an exact time (for example 23:59), and in which timezone? This is PRD open decision 8.
    Answer:

13. **What about maximum submissions per task?** The PRD wants supervisor-set attempts, but the code still allows one submission per task. Is 1–5 attempts the right range, and should the default be 1?
    Answer:

14. **How should reminders work?** Default 24 h and 5 h before the deadline. Should students be able to add custom times, or only turn each one on or off?
    Answer:

15. **Should the bell open a quick panel?** It currently goes to Inbox → Activity. The alternative is a dropdown in place, like GitHub or Linear.
    Answer:

16. **Should there be a daily digest email** instead of one email per event?
    Answer:

## Dashboard and courses

17. **What should the student dashboard show?** Should it include a class-rank or percentile widget, or is that too competitive? I left it out.
    Answer:

18. **Should supervisors see a per-student timeline** (commits per week) on the People tab?
    Answer:

19. **Should courses support archiving** (end of session) instead of deletion?
    Answer:

## Deployment

20. **Where will Metis be hosted** (frontend and backend domains)? I need these for the Firebase authorized domains and the GitHub App URLs.
    Answer:

21. **Which AI provider should be used, and what retention policy applies?** The PRD lists this as open decision 6.
    Answer:
