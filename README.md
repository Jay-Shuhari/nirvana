# Nirvana (DevTrace)

Django REST backend, React (Vite) frontend, Postgres on Supabase.
Students submit a GitHub commit; DevTrace recommends rubric scores with evidence when an AI provider is configured, and uses repository metrics as a fallback. Supervisors can override criterion scores or the overall grade with a written reason.

## 1. Supabase

1. supabase.com > **New project**. Save the database password.
2. **Connect** (top bar) > **Session pooler** > copy the URI. Use the pooler, not "Direct connection" (direct is IPv6-only on many home and campus networks). URL-encode special characters in the password (`@` is `%40`).
3. **Project Settings > API**: copy the **Project URL**, the **anon** key and the **service_role** key.
4. Fill the two env files:

| File              | Variable                                          | Value                                            |
| ----------------- | ------------------------------------------------- | ------------------------------------------------ |
| `backend/.env`  | `DATABASE_URL`                                  | Session pooler URI                               |
| `backend/.env`  | `SUPABASE_URL`, `SUPABASE_ANON_KEY`           | Project URL, anon key                            |
| `backend/.env`  | `SUPABASE_SERVICE_ROLE_KEY`                     | service_role key. **Secret. Server only.** |
| `frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Project URL, anon key                            |

5. Create the tables: `cd backend && python manage.py migrate` (Django builds them in your Supabase Postgres).
6. **Lock them**: Supabase > **SQL Editor** > New query > paste `supabase/schema.sql` > Run. The last query should list every table with `rls_enabled = true`.
   - Supabase exposes every `public` table to anyone holding the anon key, and the anon key is visible in the browser. This file turns on Row Level Security, revokes anon/authenticated access, and auto-locks tables created by future migrations.
   - Django connects as `postgres`, which bypasses RLS, so the app keeps working.
   - Re-run it after adding new apps if you ever see a table with `rls_enabled = false`.
7. Test the lock: in the SQL Editor run `set role anon; select * from core_user;` and expect `permission denied`.

Architecture note: login, permissions and data go through Django (JWT). The Supabase client in `frontend/src/lib/supabase.js` is ready for Storage or Realtime later but currently reads nothing. Moving login to Supabase Auth would mean replacing Django's user model and writing RLS policies per table: possible, but a larger change.

## 0. Open in VS Code

Open the **devtrace** folder (the one containing backend, frontend, docs). Accept the "install recommended extensions" prompt. Notes live in `docs/` (start at `docs/index.md`), guided walkthroughs in `.tours/`. Comment tags are explained in `docs/Comment-Guide.md`.

## 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill DATABASE_URL and GITHUB_TOKEN
python manage.py migrate
python manage.py createsuperuser   # optional, for /admin
python manage.py runserver         # http://localhost:8000
```

`GITHUB_TOKEN`: a personal access token with no scopes (public repos). Without it GitHub allows 60 requests/hour, enough for testing only.

## 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev     # http://localhost:5173
```

## 4. Try it

1. Register a **Supervisor**, create a course, copy its join code.
2. Register a **Student**, join with the code, register a project (`owner/repo`), click **Submit for evaluation**.
3. Log in as the supervisor, open the project, override a score with a reason.

## API

| Route                                                                                    | Purpose                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| `POST /api/auth/register`, `/api/auth/login`, `GET /api/me`                        | Accounts (JWT)                              |
| `GET/POST /api/courses`, `POST /api/courses/join`, `PUT /api/courses/:id/rubric`   | Courses and rubric (weights must total 100) |
| `GET/POST /api/projects`, `GET /api/projects/:id`, `POST /api/projects/:id/submit` | Projects and evaluations                    |
| `POST /api/criteria/:id/override`                                                      | Supervisor override, reason required        |
| `POST /api/submissions/:id/override`                                                   | Supervisor overall-grade override, reason required; `{"score": null}` resets |

## Deploy

Backend: Render/Railway with `gunicorn devtrace.wsgi`, env vars from `.env`, set `DEBUG=0` and `CORS_ORIGIN` to your site. Frontend: Vercel/Netlify with `VITE_API_URL` pointing at the backend.

## Not built yet (from the brief)

GitHub App install flow (public repos only for now), secret scanning inside file contents (only committed `.env`/key files are flagged), cohort dashboard with filters and CSV export, feedback threads, notifications, PDF report, validation page, dark-mode toggle (follows the system setting), mobile layouts beyond a stacked sidebar.

## Updating an existing install

```bash
cd backend
uv pip install -r requirements.txt
uv run python manage.py migrate      # applies pending schema changes, including overall grade overrides
```

Then paste `supabase/schema.sql` into the Supabase SQL Editor again so the new tables are locked.

## AI requirements and rubric review (optional)

The backend can use Google Gemini via its OpenAI-compatible endpoint; no extra package or frontend key is needed. It also supports Groq and xAI. When configured, the model checks task requirements and recommends points with an evidence-based rationale for each rubric criterion. These points are the automatic rubric scores; supervisors can override a criterion or the overall grade with a reason. Without all three provider settings, the requirements use the local keyword check and rubric scores use repository metrics.

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. In `backend/.env`, set:

   ```dotenv
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
   LLM_API_KEY=your_gemini_api_key
   LLM_MODEL=gemini-3.8-flash
   ```

   `gemini-3.8-flash` is an example model from Google's compatibility guide. Check Google AI Studio for the models currently enabled for your key and use that exact model ID if it differs.
3. Restart Django. On the next project evaluation, Gemini will review the task requirements (if present) and recommend rubric points with rationale. If the provider is unavailable, the app falls back to keyword requirements checks and metric-based rubric points.

Keep the Gemini key only in `backend/.env` (or your backend host's secret environment settings). Never put it in `frontend/.env`, a `VITE_*` variable, source code, or a committed file. The backend sends the selected repository files to Gemini when AI review is configured; tell users about this data transfer. See [docs/AI-Analysis.md](docs/AI-Analysis.md) and Google's [OpenAI compatibility guide](https://ai.google.dev/gemini-api/docs/openai).
