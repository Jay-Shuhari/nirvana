# Legacy troubleshooting

These notes apply to the existing Nirvana/DevTrace code, not necessarily to the Metis rebuild. See [PRD.md](../PRD.md) for target behavior.

| Symptom | Cause | Fix |
|---|---|---|
| `failed to resolve host 'aws-0-region.pooler...'` | placeholder `REGION` left in `DATABASE_URL` | paste the real Session pooler URI; see [[Supabase-Security]] |
| `404` at `http://127.0.0.1:8000/` | old build had no page at `/` | fixed by the single-URL setup; see [[Decisions]] |
| Red lines in the editor | editor uses a different Python | select `backend/.venv` interpreter, then Reload Window |
| `******"password"` in AI output | the tool masks the word "password" | not real; `py_compile` and `pyflakes` pass |
| `/api/me` returns 401 | correct: not logged in | log in at `/` |
| Blank page | `frontend/dist` missing | `cd frontend && npm install && npm run build` |
| HTTP 500 on unknown id | missing `get_object_or_404` | fixed in `views.py` |
| `Repository not found` on legacy register | wrong name, inaccessible private repo, or legacy token/App configuration | verify the configured legacy GitHub access. Metis target does not accept typed repository names or public-repository fallback; choose from the linked user's fetched Metis App repositories |
| Metis repository list is empty | GitHub identity not linked, App not installed, installation grants no repositories, or GitHub API issue | distinguish each state; authorize the App for the intended repositories and retry loading |
| Metis reference repository unavailable to students | supervisor installation has not granted Metis access, or assignment reference binding is invalid | supervisor authorizes the reference repository; backend verifies read access before showing material |
| Student cannot enter assignment | required onboarding incomplete, GitHub not linked/authorized, or course enrollment not active | complete matric/strengths onboarding, connect GitHub, and follow academy enrollment |
| Attempt limit reached | accepted submissions equal assignment maximum | inspect attempt history; only supervisor policy changes can increase the limit |
| After updating: `relation core_task does not exist` | new migration not applied | `uv run python manage.py migrate`, then re-run `supabase/schema.sql` |

Back to [[index]].
