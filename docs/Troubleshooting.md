# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `failed to resolve host 'aws-0-region.pooler...'` | placeholder `REGION` left in `DATABASE_URL` | paste the real Session pooler URI; see [[Supabase-Security]] |
| `404` at `http://127.0.0.1:8000/` | old build had no page at `/` | fixed by the single-URL setup; see [[Decisions]] |
| Red lines in the editor | editor uses a different Python | select `backend/.venv` interpreter, then Reload Window |
| `******"password"` in AI output | the tool masks the word "password" | not real; `py_compile` and `pyflakes` pass |
| `/api/me` returns 401 | correct: not logged in | log in at `/` |
| Blank page | `frontend/dist` missing | `cd frontend && npm install && npm run build` |
| HTTP 500 on unknown id | missing `get_object_or_404` | fixed in `views.py` |
| `Repository not found` on register | wrong name or private repo | check owner/name; public only (private needs a token with `repo` scope) |
| `Analysis failed: 404 ... /commits` | same, from an old build with no check at registration | delete the project, register again |
| After updating: `relation core_task does not exist` | new migration not applied | `uv run python manage.py migrate`, then re-run `supabase/schema.sql` |

Back to [[index]].
