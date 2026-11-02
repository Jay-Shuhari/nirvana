# ======================================================================
# ANCHOR: analyzer.py
# FILE: analyzer.py
# ROLE: Reads a GitHub repo and turns it into metrics (0..1) plus evidence.
# SEE:  docs/Scoring.md, .tours/01-how-a-submission-is-scored.tour
# ======================================================================
"""Reads a GitHub repo and produces metrics (0..1) plus evidence for each one."""
import re
from datetime import datetime
import requests
from django.conf import settings

# ANCHOR: Constants
# * Commit messages matching this are flagged 'Generic message' (update, final2, wip...).
GENERIC = re.compile(r"^(update|updates|fix|final\d*|changes?|wip|test|commit|asdf|\.+|initial commit)$", re.I)
# * Any of these counts as 'dependencies are pinned'.
LOCKFILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Pipfile.lock", "requirements.txt"}

# ANCHOR: GitHub client
# * Tiny wrapper around the GitHub REST API.
# ! Without GITHUB_TOKEN GitHub allows only 60 requests/hour per IP. Set the token in backend/.env.
# TODO: handle HTTP 403 rate-limit with a friendlier message and retry-after.
def gh(path, params=None):
    h = {"Accept": "application/vnd.github+json"}
    if settings.GITHUB_TOKEN: h["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    r = requests.get(f"https://api.github.com{path}", headers=h, params=params, timeout=20)
    r.raise_for_status()
    return r.json()

# ANCHOR: analyze()
# * Entry point: returns (short_sha, metrics, evidence, stats). Called from views.submit.
# TODO: analyse a specific commit chosen by the student (the `sha` parameter is wired but the UI does not send it yet).
# TODO: fetch more than 100 commits (pagination).
def analyze(repo, sha=None):
    # STEP 1: fetch up to 100 recent commits.
    commits = gh(f"/repos/{repo}/commits", {"per_page": 100, **({"sha": sha} if sha else {})})
    if not commits: raise ValueError("Repository has no commits")
    head = commits[0]["sha"]
    # STEP 2: sort commits oldest to newest as (date, short sha, first message line).
    rows = sorted((datetime.fromisoformat(c["commit"]["author"]["date"].replace("Z", "+00:00")),
                   c["sha"][:7], c["commit"]["message"].splitlines()[0]) for c in commits)
    # STEP 3: bucket commits into weeks - this array is the commit timeline chart.
    start = rows[0][0]
    n_weeks = max(1, (rows[-1][0] - start).days // 7 + 1)
    weekly = [0] * n_weeks
    for d, _, _ in rows: weekly[(d - start).days // 7] += 1
    # * Days between consecutive commits. The largest value is the 'inactivity gap'.
    gaps = [(b[0] - a[0]).days for a, b in zip(rows, rows[1:])]
    longest_gap = max(gaps, default=0)
    # STEP 4: message quality = share of commits with a meaningful message.
    generic = [r for r in rows if GENERIC.match(r[2].strip()) or len(r[2].strip()) < 8]
    quality = 1 - len(generic) / len(rows)

    # STEP 5: list every file at the latest commit (one API call, recursive).
    tree = gh(f"/repos/{repo}/git/trees/{head}", {"recursive": 1}).get("tree", [])
    paths = [t["path"] for t in tree if t["type"] == "blob"]
    names = {p.split("/")[-1] for p in paths}
    has = lambda pred: [p for p in paths if pred(p)]
    tests = has(lambda p: re.search(r"(^|/)(tests?|__tests__)/|test_.*\.py$|\.(test|spec)\.[jt]sx?$", p))
    env_files = has(lambda p: p.split("/")[-1] in {".env", "id_rsa"} or p.endswith(".pem"))
    tops = {p.split("/")[0] for p in paths if "/" in p}

    # STEP 6: turn raw facts into 0..1 metrics. Each rubric criterion points at one of these keys.
    # ? Why divide tests by 3? Three test files is treated as 'enough'; tune to taste.
    # ? Why len(tops)/4 for structure? 4+ top-level folders is a rough proxy for separation of concerns.
    # ! 'security' is 0 only when a .env / key file is committed. It does NOT scan file contents yet.
    # TODO: scan file contents for hard-coded secrets (SECRET_KEY, API keys) and add them as evidence.
    m = {
        "message_quality": quality,
        "repo_hygiene": ((".gitignore" in names) + bool(names & LOCKFILES)) / 2,
        "readme": 1.0 if any(n.lower().startswith("readme") for n in names) else 0.0,
        "tests": min(1.0, len(tests) / 3),
        "structure": min(1.0, len(tops) / 4),
        "process": (min(1.0, sum(1 for w in weekly if w) / n_weeks) + (1 - min(1.0, longest_gap / 28))) / 2,
        "security": 0.0 if env_files else 1.0,
    }
    # STEP 7: evidence = the receipts behind each score (commits, files). Shown on the Evidence tab.
    evidence = {
        "message_quality": [{"type": "commit", "sha": r[1], "note": f"Generic message: {r[2]}"} for r in generic[:10]],
        "tests": [{"type": "file", "path": p, "note": "Test file"} for p in tests[:10]]
                 or [{"type": "note", "note": "No test files found"}],
        "security": [{"type": "file", "path": p, "note": "Sensitive file committed"} for p in env_files],
        "process": [{"type": "note", "note": f"Longest gap: {longest_gap} days"}],
    }
    # STEP 8: numbers for the timeline screen (weekly bars, longest gap, commit log).
    stats = {"weekly": weekly, "commits": len(rows), "paths": paths[:300], "longest_gap": longest_gap,
             "final_week_share": round(weekly[-1] / len(rows), 2),
             "log": [{"sha": r[1], "message": r[2], "date": r[0].date().isoformat(), "generic": r in generic}
                     for r in reversed(rows[-30:])]}
    return head[:7], m, evidence, stats
