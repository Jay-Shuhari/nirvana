# ======================================================================
# ANCHOR: devtrace/urls.py
# FILE: devtrace/urls.py
# ROLE: Top-level routing: admin, API, and the React app (single URL).
# SEE:  docs/Decisions.md#one-url
# ======================================================================
from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path

# ANCHOR: React catch-all
# ? Why? React Router handles pages like /projects/5 in the browser. If you refresh there, Django must still return index.html.
def spa(request, *args, **kwargs):
    """Serve the React app for every non-API route so page refreshes and deep links work."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse("Frontend not built. Run: cd frontend && npm install && npm run build", status=503)
    return HttpResponse(index.read_text(encoding="utf-8"))

# ANCHOR: Routes
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    # ! Must stay LAST: it matches everything except api/, admin/ and static/.
    re_path(r"^(?!api/|admin/|static/).*$", spa),
]
