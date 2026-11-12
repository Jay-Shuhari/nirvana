"""Server-side GitHub App authentication and repository access."""
from datetime import datetime, timedelta, timezone as datetime_timezone

import jwt
import requests
from django.conf import settings

API = "https://api.github.com"


class GitHubAppError(Exception):
    """Raised when the configured GitHub App cannot authorize a request."""


def configured():
    return bool(settings.GITHUB_APP_ID and settings.GITHUB_APP_PRIVATE_KEY)


def _app_jwt():
    if not configured():
        raise GitHubAppError("GitHub App credentials are not configured on the backend.")
    now = datetime.now(datetime_timezone.utc)
    return jwt.encode({
        "iat": int((now - timedelta(seconds=60)).timestamp()),
        "exp": int((now + timedelta(minutes=9)).timestamp()),
        "iss": str(settings.GITHUB_APP_ID),
    }, settings.GITHUB_APP_PRIVATE_KEY, algorithm="RS256")


def _request(method, path, *, token, **kwargs):
    response = requests.request(
        method,
        f"{API}{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=20,
        **kwargs,
    )
    response.raise_for_status()
    return response.json() if response.content else {}


def verify_installation(installation_id):
    data = _request("GET", f"/app/installations/{installation_id}", token=_app_jwt())
    if str(data.get("app_id")) != str(settings.GITHUB_APP_ID):
        raise GitHubAppError("The installation does not belong to this GitHub App.")
    return data


def installation_token(installation_id, repositories=None):
    body = {"repositories": repositories} if repositories else {}
    data = _request(
        "POST",
        f"/app/installations/{installation_id}/access_tokens",
        token=_app_jwt(),
        json=body,
    )
    token = data.get("token")
    if not token:
        raise GitHubAppError("GitHub did not return an installation access token.")
    return token


def installation_repositories(installation_id):
    token = installation_token(installation_id)
    repositories = []
    page = 1
    while True:
        data = _request(
            "GET",
            "/installation/repositories",
            token=token,
            params={"per_page": 100, "page": page},
        )
        batch = data.get("repositories", [])
        repositories.extend(batch)
        if len(batch) < 100:
            return repositories
        page += 1


def repositories_for_user(user):
    rows = []
    for installation in user.github_installations.filter(active=True, suspended=False):
        for repository in installation_repositories(installation.installation_id):
            rows.append({
                "full_name": repository["full_name"],
                "private": repository.get("private", False),
                "html_url": repository.get("html_url", ""),
                "installation_id": installation.installation_id,
            })
    return rows


def token_for_repository(user, repository, installation_id=None):
    target = repository.casefold()
    installations = user.github_installations.filter(active=True, suspended=False)
    if installation_id is not None:
        installations = installations.filter(installation_id=installation_id)
    for installation in installations:
        available = installation_repositories(installation.installation_id)
        match = next(
            (item for item in available if item.get("full_name", "").casefold() == target),
            None,
        )
        if match:
            return installation_token(installation.installation_id, [match["name"]])
    return None
