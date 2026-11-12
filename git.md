# Nirvana Deployment and GitHub App Configuration Guide

This guide covers deployment for the Nirvana application, connecting the Django REST backend, Vite/React frontend, Supabase PostgreSQL database, GitHub App integration, and transactional email.

- Vercel production frontend domain: `https://nirvana-blond-pi.vercel.app`
- Vercel deployment preview: `https://nirvana-bliuyt1au-jays-projects-e9f34657.vercel.app`

---

## 1. Architecture and Hosting Requirements

| Component            | Recommended Host                                                | Configuration / Environment                                                                   |
| -------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Frontend**   | Vercel                                                          | Root directory `frontend`, Vite preset, `VITE_API_URL=https://<backend-host>/api`         |
| **Backend**    | Render / Railway / Fly.io / VPS                                 | Python 3.12+, Gunicorn (`devtrace.wsgi`), environment secrets from `backend/.env.example` |
| **Database**   | Supabase (PostgreSQL)                                           | Session pooler URI (`DATABASE_URL`), Row Level Security locked via `supabase/schema.sql`  |
| **GitHub App** | GitHub Developer Settings                                       | App ID, Slug, Private Key, Webhook Secret, Setup URL, Webhook URL                             |
| **Email SMTP** | Any standard SMTP (SendGrid, Mailgun, Postmark, AWS SES, Gmail) | Host, port, user, password, TLS/SSL flags                                                     |

> [!IMPORTANT]
> **Manual Prerequisites**: Deploying to production requires credentials and administrative access for Vercel, your backend hosting provider, Supabase, and GitHub Developer Settings. Never declare a deployment live or verified without executing the production verification checks against actual running host endpoints.

---

## 2. Persistent Database Requirements (Supabase PostgreSQL)

1. **Persistent Database**: Nirvana requires a persistent PostgreSQL database. Do not use local SQLite in production (SQLite is only used during automated testing and rapid offline development).
2. **Connection Pooling**: In Supabase, navigate to **Connect** > **Session pooler** (port 5432). Use the session pooler URI for `DATABASE_URL` because direct connection mode is IPv6-only on many networks.
3. **Run Migrations**: On the backend host:
   ```bash
   python manage.py migrate
   ```
4. **Lock Tables with Row Level Security (RLS)**:
   - Supabase exposes public tables to the anon key by default.
   - Run `supabase/schema.sql` in the Supabase SQL Editor.
   - Verify all tables show `rls_enabled = true`.
   - Django connects as `postgres` which bypasses RLS, keeping server-side queries secure.

---

## 3. GitHub App Configuration

The GitHub App provides student repository authorization (both public and private repositories) and server-side webhook synchronization.

In **GitHub > Settings > Developer settings > GitHub Apps > New GitHub App** (or edit your existing app):

| Setting                                           | Value                                                                            | Purpose                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **GitHub App name**                         | `nirvana` (or unique variant e.g. `nirvana-Jay`)                             | Application identifier                                                                |
| **Homepage URL**                            | `https://nirvana-blond-pi.vercel.app`                                          | App home                                                                              |
| **Callback URL**                            | *(Leave empty)*                                                                | Nirvana uses Django JWT, not GitHub OAuth                                             |
| **Setup URL**                               | `https://<backend-host>/api/github/setup`                                      | Post-installation redirect handling state nonce verification and user association     |
| **Redirect on update**                      | Enabled                                                                          | Handles installation repository updates                                               |
| **Webhook Active**                          | **Active (checked)**                                                       | Receives installation events                                                          |
| **Webhook URL**                             | `https://<backend-host>/api/github/webhook`                                    | Receives and verifies HMAC-signed events                                              |
| **Webhook Secret**                          | Strong random string (matches `GITHUB_WEBHOOK_SECRET`)                         | HMAC-SHA256 signature verification                                                    |
| **Repository permissions**                  | **Contents: Read-only****Metadata: Read-only**                       | Allows repository cloning, tree reading, file content inspection, and commit analysis |
| **Subscribe to events**                     | **Installation** (`installation`)                                        | Tracks installation deletion, suspension, and resumption                              |
| **Where can this GitHub App be installed?** | **Any account** (or **Only on this account** during initial testing) | Permits students to authorize their coursework repositories                           |

### Backend Environment Variables for GitHub App

Add these secrets to your backend host environment (`backend/.env`):

```dotenv
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-github-app-slug
# Store private key as one line with literal \n escapes or valid multi-line PEM
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_generated_webhook_secret
```

---

## 4. Email Notifications (Supabase or Custom SMTP)

Nirvana supports sending notification emails for task assignments, project submissions, and score overrides directly through **Supabase** (via a Supabase Edge Function) or via custom SMTP.

### Option A: Using Supabase (Recommended)

When `EMAIL_PROVIDER=supabase`, Django delivers email via the Supabase Edge Function `send-email` using your project's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`:

```dotenv
EMAIL_PROVIDER=supabase
EMAIL_NOTIFICATIONS_ENABLED=1
DEFAULT_FROM_EMAIL="Nirvana <notifications@your-domain.com>"
SUPABASE_EMAIL_FUNCTION_NAME=send-email
FRONTEND_URL=https://nirvana-blond-pi.vercel.app
```

The function code is provided in `supabase/functions/send-email/index.ts`. Deploy it to your Supabase project with:

```bash
supabase functions deploy send-email
```

In your Supabase project settings or Edge Function secrets (`supabase secrets set`), set `RESEND_API_KEY` (or configure your transactional email provider).

### Option B: Using Custom SMTP

If using a custom SMTP relay (e.g. configured in Supabase under Authentication > SMTP Settings or directly with SendGrid, Mailgun, Amazon SES, or Postmark):

```dotenv
EMAIL_PROVIDER=smtp
EMAIL_NOTIFICATIONS_ENABLED=1
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_user
EMAIL_HOST_PASSWORD=your_password
EMAIL_USE_TLS=1
EMAIL_USE_SSL=0
DEFAULT_FROM_EMAIL="Nirvana <notifications@your-domain.com>"
FRONTEND_URL=https://nirvana-blond-pi.vercel.app
```

> [!NOTE]
> If `EMAIL_NOTIFICATIONS_ENABLED=0` or an email delivery error occurs, Nirvana gracefully logs the error without breaking in-app notifications or API requests.

---

## 5. Vercel Frontend Configuration

1. In the Vercel dashboard:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
2. **Environment Variables**:
   - `VITE_API_URL`: `https://<backend-host>/api` (do not add a trailing slash)
3. **SPA Routing**: Ensure `vercel.json` exists in `frontend/` (or repository root) with SPA rewrites so direct deep links and reloads work without 404s:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

---

## 6. Django Backend Host Configuration

1. Set `DEBUG=0`.
2. Generate a strong secret key: `SECRET_KEY=...`.
3. Set `ALLOWED_HOSTS=<backend-host>` (without `https://`, e.g. `api.yourdomain.com`).
4. Set `CORS_ORIGIN=https://nirvana-blond-pi.vercel.app` (comma-separated if multiple origins).
5. Start command: `gunicorn devtrace.wsgi:application --bind 0.0.0.0:$PORT`.

---

## 7. Production Verification Checklist

Run these manual and automated checks before releasing to users:

- [ ] **Health Endpoint**: `curl https://<backend-host>/healthz` returns `{"ok": true}`.
- [ ] **Frontend Loading**: `https://nirvana-blond-pi.vercel.app` loads the React app without console errors.
- [ ] **Deep Link Routing**: Direct navigation to `/courses`, `/tasks`, and `/settings` succeeds without 404s.
- [ ] **CORS Verification**: Browser network requests to `https://<backend-host>/api/...` succeed with valid CORS headers.
- [ ] **Authentication & Refresh**: Logging in creates access and refresh tokens. Expiration triggers a single transparent refresh; invalid tokens return to login while preserving the current URL.
- [ ] **GitHub App Connect**: Clicking "Connect GitHub" in Settings opens the GitHub installation URL; completion redirects to `/settings?github=connected` and lists authorized repositories in project registration.
- [ ] **Webhook Verification**: Sending a test installation webhook with valid HMAC signature returns 200; invalid signature returns 403.
- [ ] **Deadlines & Single Submission**: A project can only be evaluated once per task; concurrent and late submissions are rejected with clear user errors.
- [ ] **Email Notifications**: Task creation, project submissions, and grade overrides trigger formatted emails with deep links back to Nirvana.
