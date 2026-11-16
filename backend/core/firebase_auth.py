# ======================================================================
# ANCHOR: firebase_auth.py
# FILE: backend/core/firebase_auth.py
# ROLE: Verify Firebase Authentication ID tokens (Google / GitHub sign-in) on the server.
# SEE:  docs/Firebase-GitHub-Setup.md
# ? Why not firebase-admin? Verification only needs Google's public certificates and PyJWT,
#   so no service-account key has to live on the server.
# ======================================================================
import re
import time

import jwt
import requests
from cryptography.x509 import load_pem_x509_certificate
from django.conf import settings

CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
PROVIDERS = {"google.com": "google", "github.com": "github"}
_cache = {"certs": {}, "expires": 0.0}


class FirebaseAuthError(Exception):
    def __init__(self, message, status=401):
        super().__init__(message)
        self.status = status


def _certs():
    if _cache["certs"] and time.time() < _cache["expires"]:
        return _cache["certs"]
    try:
        response = requests.get(CERTS_URL, timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise FirebaseAuthError("Could not reach Google to verify the sign-in. Try again.", status=502) from exc
    match = re.search(r"max-age=(\d+)", response.headers.get("Cache-Control", ""))
    _cache["certs"], _cache["expires"] = response.json(), time.time() + (int(match.group(1)) if match else 3600)
    return _cache["certs"]


def verify_id_token(id_token):
    """! Returns verified claims or raises FirebaseAuthError. Never trust identities sent by the browser otherwise."""
    project = settings.FIREBASE_PROJECT_ID
    if not project:
        raise FirebaseAuthError("Google and GitHub sign-in are not configured on the server.", status=503)
    if not isinstance(id_token, str) or not id_token:
        raise FirebaseAuthError("Missing sign-in token.", status=400)
    try:
        kid = jwt.get_unverified_header(id_token).get("kid")
    except jwt.PyJWTError as exc:
        raise FirebaseAuthError("Sign-in token is malformed.") from exc
    cert = _certs().get(kid)
    if not cert:
        raise FirebaseAuthError("Sign-in token was signed by an unknown key.")
    try:
        claims = jwt.decode(
            id_token,
            load_pem_x509_certificate(cert.encode()).public_key(),
            algorithms=["RS256"],
            audience=project,
            issuer=f"https://securetoken.google.com/{project}",
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
            leeway=30,
        )
    except jwt.PyJWTError as exc:
        raise FirebaseAuthError("Sign-in token is invalid or expired. Sign in again.") from exc
    if not claims.get("sub") or claims.get("auth_time", 0) > time.time() + 30:
        raise FirebaseAuthError("Sign-in token is invalid.")
    return claims


def identities(claims):
    """* {provider: subject} for the providers Metis supports, from the verified token."""
    found = (claims.get("firebase") or {}).get("identities") or {}
    return {PROVIDERS[k]: str(v[0]) for k, v in found.items() if k in PROVIDERS and v}
