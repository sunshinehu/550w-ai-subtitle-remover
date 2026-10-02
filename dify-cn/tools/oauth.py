"""550W public-client OAuth with S256 PKCE and encrypted, expiring state.

Dify owns the browser/session callback context. The plugin adds authenticated
state bound to the exact callback, region and client. No process-local state is
used, so daemon restarts and multiple workers do not lose the PKCE verifier.
"""
import base64
import hashlib
import json
import secrets
import time
from urllib.parse import urlencode, urlparse

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from tools.api import BASE_URL
from tools.region import REGION
import requests

SCOPE = "credits:read tasks:read tasks:submit media:upload"
RESOURCE = f"{BASE_URL}/media-api/{REGION}"
AAD = ("550w-dify-oauth-state-v1:" + REGION).encode()


def _key(settings):
    value = settings.get("oauth_state_secret")
    if not isinstance(value, str) or len(value) < 32 or len(value) > 512:
        raise ValueError("Administrator: configure a random OAuth state secret of at least 32 characters")
    return hashlib.sha256(value.encode()).digest()


def _callback(uri):
    parsed = urlparse(uri)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError("Dify requires an HTTPS OAuth callback without embedded credentials")
    return uri


def _post(path, payload):
    try:
        with requests.post(BASE_URL + path, json=payload if path.endswith("register") else None,
                           data=None if path.endswith("register") else payload,
                           timeout=(10, 30), allow_redirects=False, stream=True) as response:
            if response.status_code != 200 and not (path.endswith("register") and response.status_code == 201):
                raise ValueError("550W OAuth request rejected; check client configuration or reconnect")
            if not response.headers.get("Content-Type", "").lower().startswith("application/json"):
                raise ValueError("Invalid OAuth response")
            chunks, size = [], 0
            for chunk in response.iter_content(chunk_size=8192):
                size += len(chunk)
                if size > 65536:
                    raise ValueError("OAuth response too large")
                chunks.append(chunk)
            try:
                result = json.loads(b"".join(chunks))
            except (ValueError, UnicodeError) as exc:
                raise ValueError("Invalid OAuth JSON response") from exc
            if not isinstance(result, dict) or result.get("error"):
                raise ValueError("550W OAuth request failed; reconnect your account")
            return result
    except requests.RequestException as exc:
        raise ValueError("550W OAuth connection failed; no automatic authorization retry") from exc


def authorization_url(redirect_uri, settings):
    callback = _callback(redirect_uri)
    key = _key(settings)
    registration = _post("/oauth2/register", {
        "client_name": f"550W Dify {REGION}", "redirect_uris": [callback],
        "token_endpoint_auth_method": "none", "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"], "scope": SCOPE, "resource": RESOURCE,
    })
    client_id = registration.get("client_id")
    if not isinstance(client_id, str) or not 1 <= len(client_id) <= 128:
        raise ValueError("OAuth registration did not return a client ID")
    verifier = secrets.token_urlsafe(48)
    nonce = secrets.token_bytes(12)
    callback_hash = base64.urlsafe_b64encode(hashlib.sha256(callback.encode()).digest()).decode().rstrip("=")
    payload = json.dumps({"t": int(time.time()), "v": verifier, "c": client_id,
                          "h": callback_hash}, separators=(",", ":")).encode()
    state = base64.urlsafe_b64encode(nonce + AESGCM(key).encrypt(nonce, payload, AAD)).decode().rstrip("=")
    if len(state) > 500:
        raise ValueError("Registered OAuth client ID exceeds the service state size limit")
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return BASE_URL + "/oauth2/authorize?" + urlencode({
        "client_id": client_id, "redirect_uri": callback, "response_type": "code", "scope": SCOPE,
        "resource": RESOURCE, "state": state, "code_challenge": challenge, "code_challenge_method": "S256",
    })


def exchange(redirect_uri, settings, request):
    if request.args.get("error"):
        raise ValueError("550W authorization was cancelled or rejected")
    state, code = request.args.get("state"), request.args.get("code")
    if not isinstance(state, str) or not 1 <= len(state) <= 4096 or not isinstance(code, str) or not 1 <= len(code) <= 2048:
        raise ValueError("OAuth callback is missing valid state or code")
    try:
        raw = base64.urlsafe_b64decode(state + "=" * (-len(state) % 4))
        payload = json.loads(AESGCM(_key(settings)).decrypt(raw[:12], raw[12:], AAD))
        age = int(time.time()) - payload["t"]
        callback_hash = base64.urlsafe_b64encode(hashlib.sha256(_callback(redirect_uri).encode()).digest()).decode().rstrip("=")
        if not 0 <= age <= 600 or payload["h"] != callback_hash:
            raise ValueError("Invalid state binding")
    except Exception as exc:
        raise ValueError("OAuth state is invalid or expired; restart authorization") from exc
    result = _post("/oauth2/token", {"grant_type": "authorization_code", "client_id": payload["c"],
        "redirect_uri": redirect_uri, "code": code, "code_verifier": payload["v"], "resource": RESOURCE})
    return _credentials(result, payload["c"])


def refresh(credentials):
    if credentials.get("region") != REGION or not credentials.get("refresh_token") or not credentials.get("client_id"):
        raise ValueError("OAuth connection cannot be refreshed; reconnect this regional provider")
    result = _post("/oauth2/token", {"grant_type": "refresh_token", "client_id": credentials["client_id"],
        "refresh_token": credentials["refresh_token"], "resource": RESOURCE})
    return _credentials(result, credentials["client_id"], credentials.get("refresh_token"))


def _credentials(result, client_id, previous_refresh=None):
    access = result.get("access_token")
    refresh_token = result.get("refresh_token") or previous_refresh
    expires = result.get("expires_in")
    if not isinstance(access, str) or not access or not isinstance(refresh_token, str) or not refresh_token or \
            isinstance(expires, bool) or not isinstance(expires, (int, float)) or not 0 < expires <= 86400:
        raise ValueError("OAuth response lacks valid access/refresh tokens or expiry")
    return {"access_token": access, "refresh_token": refresh_token, "client_id": client_id,
            "region": REGION}, int(time.time() + expires)
