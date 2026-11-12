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
| `POST /api/auth/register`, `/api/auth/login`, `POST /api/auth/refresh`, `GET/PATCH /api/me` | Accounts and profile (JWT)              |
| `GET/POST /api/courses`, `POST /api/courses/join`, `PUT /api/courses/:id/rubric`         | Courses and rubric (weights must total 100) |
| `GET/POST /api/tasks`, `GET/DELETE /api/tasks/:id`                                       | Task assignments and task detail rosters    |
| `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `POST /api/projects/:id/submit` | Projects and one-time evaluations    |
| `POST /api/criteria/:id/override`                                                        | Supervisor criterion score override         |
| `POST /api/submissions/:id/override`                                                     | Supervisor overall-grade override/reset     |
| `POST /api/github/install`, `GET /api/github/repositories`                               | GitHub App signed install & repo picker     |
| `GET /api/github/setup`, `POST /api/github/webhook`                                      | GitHub App setup redirect & HMAC webhook    |
| `GET /api/notifications`, `POST /api/notifications/read`                                 | In-app notifications inbox                  |

## Deploy

Backend: Render/Railway with `gunicorn devtrace.wsgi`, env vars from `.env`, set `DEBUG=0` and `CORS_ORIGIN` to your site. Frontend: Vercel/Netlify with `VITE_API_URL` pointing at the backend.

For the full Vercel + GitHub App deployment guide, Supabase email & SMTP settings, database setup, and production verification checklist, see [git.md](git.md).

## Updating an existing install

```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate      # applies pending schema changes
```

Then paste `supabase/schema.sql` into the Supabase SQL Editor again so any new tables are locked with RLS.

## AI requirements and rubric review (optional)

The backend can use Google Gemini via its OpenAI-compatible endpoint, Groq, or xAI. When configured, the assistant (**Ttonpa**) checks task requirements and recommends points with an evidence-based rationale for each enabled rubric criterion. These points serve as the initial automatic rubric scores; supervisors can override any criterion or the overall grade with a required written reason. Without provider settings, requirements use a local keyword check and rubric scores use repository metrics.

1. Create an API key in your chosen provider's console (e.g., [Google AI Studio](https://aistudio.google.com/apikey)).
2. In `backend/.env`, set:

   ```dotenv
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
   LLM_API_KEY=your_api_key
   LLM_MODEL=gemini-3.8-flash
   ```

3. Restart Django. On the next project evaluation, Ttonpa will review task requirements and recommend rubric points with rationale. If the provider is unavailable, the app falls back to keyword checks and metric-based scoring.

Keep your AI API key only in `backend/.env` (or your backend host's secret environment settings). Never put it in `frontend/.env`, a `VITE_*` variable, source code, or a committed file. See [docs/AI-Analysis.md](docs/AI-Analysis.md).
