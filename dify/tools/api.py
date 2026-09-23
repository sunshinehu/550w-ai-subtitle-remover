"""Small, bounded client for the shared 550W Open API."""

import json
import re
from typing import Any
from urllib.parse import urlparse

import requests

BASE_URL = "https://www.550wai.cn"
ALLOWED_ENDPOINTS = frozenset({
    "/open/queryCredits", "/open/removeVideoWatermark", "/open/submitTask", "/open/taskDetail",
})
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


def require_url(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("Provide one HTTP(S) media URL (maximum 2048 characters).")
    match = re.search(r"https?://[^\s]+", value.strip(), re.IGNORECASE)
    candidate = match.group(0).rstrip("，。；;！!）)】]") if match else value.strip()
    parsed = urlparse(candidate)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("Provide a valid public HTTP(S) media URL.")
    return candidate


def require_token(value: Any, label: str) -> str:
    if not isinstance(value, str) or not TOKEN_PATTERN.fullmatch(value.strip()):
        raise ValueError(f"{label} must be 8–128 letters, digits, dots, underscores, colons or hyphens.")
    return value.strip()


def call_api(credentials: dict[str, Any], endpoint: str, params: dict[str, Any], timeout: int = 30) -> dict[str, Any]:
    if endpoint not in ALLOWED_ENDPOINTS:
        raise ValueError("Unsupported API endpoint")
    user_no = credentials.get("userNo")
    api_key = credentials.get("apiKey")
    if not user_no or not api_key:
        raise ValueError("Configure your user number and API key at https://eraser.550wai.com/api/")
    try:
        response = requests.post(
            BASE_URL + endpoint,
            data={"userNo": user_no, "apiKey": api_key, **params},
            timeout=(10, timeout), allow_redirects=False, stream=True,
        )
        with response:
            if 300 <= response.status_code < 400:
                raise ValueError("API redirects are not allowed")
            response.raise_for_status()
            if not response.headers.get("Content-Type", "").lower().startswith("application/json"):
                raise ValueError("The service returned a non-JSON response")
            chunks = []
            total = 0
            for chunk in response.iter_content(chunk_size=65536):
                total += len(chunk)
                if total > 2 * 1024 * 1024:
                    raise ValueError("The service response is too large")
                chunks.append(chunk)
            result = json.loads(b"".join(chunks))
        if not isinstance(result, dict) or not isinstance(result.get("code"), int):
            raise ValueError("The service returned an invalid response")
        return result
    except requests.RequestException as exc:
        raise ValueError("550W API request failed; check connectivity and task state before retrying a paid action") from exc
