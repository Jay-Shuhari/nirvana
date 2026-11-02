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
# ! Set a long random SECRET_KEY in .env for any real deployment.
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only")
# ! Must be 0 in production (shows stack traces to visitors when 1).
DEBUG = os.getenv("DEBUG", "1") == "1"
# TODO: restrict to your real domain before deploying.
ALLOWED_HOSTS = ["*"]
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
# * Only needed for `npm run dev` on port 5173. Single-URL mode does not use CORS.
CORS_ALLOWED_ORIGINS = [os.getenv("CORS_ORIGIN", "http://localhost:5173")]
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
