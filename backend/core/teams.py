# ======================================================================
# ANCHOR: teams.py
# FILE: backend/core/teams.py
# ROLE: Balanced auto-grouping from onboarding strengths.
# SEE:  docs/Teaming.md
# ======================================================================
import math

EXPERIENCE_RANK = {"confident": 0, "some": 1, "new": 2, None: 3}


def plan_groups(students, size):
    """* Split students into ceil(n/size) groups so each group mixes areas and experience.

    Students are sorted by (primary area, experience) and dealt round-robin ("snake" order),
    so people with the same strength land in different groups and group sizes differ by at most one.
    The first person dealt into each group (the most experienced of its first round) is suggested as lead.
    Returns a list of lists of (user, role).
    """
    from .onboarding import primary_area

    students = list(students)
    if not students:
        return []
    count = max(1, math.ceil(len(students) / max(2, size)))
    def experience(u):
        prof = getattr(u, "onboarding", None)
        return ((prof.strengths or {}).get("answers", {}).get("experience") if prof else None)
    ordered = sorted(students, key=lambda u: (primary_area(u) or "~", EXPERIENCE_RANK.get(experience(u), 3), u.pk))
    groups = [[] for _ in range(count)]
    for i, user in enumerate(ordered):
        rnd, pos = divmod(i, count)
        index = pos if rnd % 2 == 0 else count - 1 - pos  # snake order keeps sizes and mixes even
        groups[index].append(user)
    result = []
    for members in groups:
        lead = min(members, key=lambda u: EXPERIENCE_RANK.get(experience(u), 3))
        result.append([(u, "lead" if u is lead else "member") for u in members])
    return result
