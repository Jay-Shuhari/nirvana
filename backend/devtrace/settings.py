# ======================================================================
# ANCHOR: settings.py
# FILE: settings.py
# ROLE: Project configuration. Secrets come from backend/.env, never hard-coded.
# SEE:  docs/Supabase-Security.md
# ======================================================================
import os
from datetime import timedelta
from pathlib import Path
import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_list(name, default=""):
    """Comma-separated env var -> clean list (strips spaces and trailing slashes)."""
    raw = os.getenv(name, default)
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


# ! Off by default so a forgotten variable fails safe. Set DEBUG=1 in your local backend/.env.
DEBUG = os.getenv("DEBUG", "0") == "1"

# ! In production (DEBUG=0) SECRET_KEY must be set, or the app refuses to start.
SECRET_KEY = os.getenv("SECRET_KEY") or ("dev-only" if DEBUG else None)
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set when DEBUG=0")

# * Comma-separated hostnames, no https://. Example on Render: nirvana-0p99.onrender.com
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

# ANCHOR: Apps and middleware
INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "corsheaders", "core",
]
# ? Order matters: CORS first, WhiteNoise right after Security.
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]
ROOT_URLCONF = "devtrace.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "APP_DIRS": True,
    "OPTIONS": {"context_processors": ["django.template.context_processors.request",
    "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages"]}}]

# ANCHOR: Database (Supabase)
# * DATABASE_URL = Supabase Session-pooler URI. Empty means local SQLite for quick testing.
# ! ssl_require is on whenever DATABASE_URL is set - Supabase requires SSL.
# ? Why the pooler and not the direct connection? Direct is IPv6-only on many networks.
DATABASES = {"default": dj_database_url.config(
    default=os.getenv("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    conn_max_age=60, ssl_require=bool(os.getenv("DATABASE_URL")))}
# ! Must be set BEFORE the first migration, otherwise Django keeps the default user table.
AUTH_USER_MODEL = "core.User"
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ANCHOR: CORS and CSRF
# * CORS_ORIGIN = your frontend URL, e.g. https://nirvana-xxxx.vercel.app (https:// yes, trailing slash no).
#   Several origins can be comma-separated. Local dev on port 5173 is always allowed.
CORS_ALLOWED_ORIGINS = env_list("CORS_ORIGIN") + ["http://localhost:5173"]
# * Only needed if you log in to /admin on the deployed site.
#   Example on Render: CSRF_TRUSTED_ORIGINS=https://nirvana-0p99.onrender.com
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
# * Render terminates HTTPS at its proxy; this tells Django the original request was secure.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ANCHOR: API auth
# * Every endpoint requires a JWT unless a view opts out (register, login).
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}
SIMPLE_JWT = {"ACCESS_TOKEN_LIFETIME": timedelta(hours=8)}
# * Used by analyzer.py to lift GitHub's rate limit.
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Serve the built React app (frontend/dist) from Django: one URL for everything.
# ANCHOR: Single URL
# * WhiteNoise serves the built React files; run `npm run build` in frontend/ after changing the UI.
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
WHITENOISE_ROOT = FRONTEND_DIST
STATIC_ROOT = BASE_DIR / "staticfiles"

# ANCHOR: AI provider
# * Any OpenAI-compatible endpoint works (Groq free tier, xAI Grok, Gemini's compat endpoint...).
#   Leave LLM_API_KEY empty to use the built-in rule-based check instead.
# ! Student code is sent to this provider when a key is set. Say so in your course privacy notice.
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")