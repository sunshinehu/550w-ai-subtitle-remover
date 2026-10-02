"""Small, bounded client for the shared 550W Open API."""
from __future__ import annotations

import json
import os
import re
import tempfile
import uuid
from typing import Any
from urllib.parse import urlparse

import requests
from requests_toolbelt.multipart.encoder import MultipartEncoder
from tools.region import REGION, API_KEY_URL

BASE_URL = "https://www.550wai.cn"
ALLOWED_ENDPOINTS = frozenset({
    "/open/queryCredits", "/open/removeVideoWatermark", "/open/submitTask", "/open/taskDetail",
    "/open/imageWatermarkTaskDetail",
})
UPLOAD_ENDPOINTS = frozenset({"/open/uploadVideo", "/open/removeImageWatermark"})
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
    if "access_token" in credentials:
        root, headers = oauth_target(credentials)
        if endpoint == "/open/queryCredits":
            return http_json("get", root + "/account", headers=headers, timeout=timeout)
        if endpoint in ("/open/taskDetail", "/open/imageWatermarkTaskDetail"):
            task = require_token(params.get("taskId"), "taskId")
            kind = "image" if endpoint == "/open/imageWatermarkTaskDetail" else "video"
            return http_json("get", root + f"/tasks/{kind}/{task}", headers=headers, timeout=timeout)
        operation = params.get("operationId") or params.get("idempotencyKey") or uuid.uuid4().hex
        require_token(operation, "operationId")
        if len(operation) > 64:
            raise ValueError("OAuth operationId must be at most 64 characters")
        return http_json("post", root + "/media", headers=headers, json={
            "operationId": operation, "mediaType": "share" if endpoint == "/open/removeVideoWatermark" else "video",
            "sourceUrl": require_url(params.get("videoUrl")),
        }, timeout=timeout)
    user_no = credentials.get("userNo")
    api_key = credentials.get("apiKey")
    if not user_no or not api_key:
        raise ValueError(f"Connect with OAuth or configure your user number and API key at {API_KEY_URL}")
    try:
        response = requests.post(
            BASE_URL + endpoint,
            data={"userNo": user_no, "apiKey": api_key, **params},
            timeout=(10, timeout), allow_redirects=False, stream=True,
        )
        return _read_json_response(response)
    except requests.RequestException as exc:
        raise ValueError("550W API request failed; check connectivity and task state before retrying a paid action") from exc


def call_upload(credentials: dict[str, Any], endpoint: str, uploaded: Any,
                params: dict[str, Any] | None = None, timeout: int = 120) -> dict[str, Any]:
    """Upload a Dify-selected file only to the fixed 550W Open API host."""
    if endpoint not in UPLOAD_ENDPOINTS:
        raise ValueError("Unsupported upload endpoint")
    user_no, api_key = credentials.get("userNo"), credentials.get("apiKey")
    oauth = "access_token" in credentials
    if oauth:
        root, headers = oauth_target(credentials)
    elif not user_no or not api_key:
        raise ValueError(f"Connect with OAuth or configure your user number and API key at {API_KEY_URL}")
    filename = os.path.basename(str(getattr(uploaded, "filename", "")))
    image = endpoint == "/open/removeImageWatermark"
    allowed = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"} if image else {".mp4": "video/mp4", ".mov": "video/quicktime"}
    mime = allowed.get(os.path.splitext(filename)[1].lower())
    if not mime:
        raise ValueError("Select a PNG/JPEG/WebP image" if image else "Select an MP4/MOV video")
    # Images follow the service's 50 MiB limit; videos use a bounded disk spool.
    max_size = (50 if image else 1024) * 1024 * 1024
    declared_size = getattr(uploaded, "size", None)
    if isinstance(declared_size, (int, float)) and declared_size > max_size:
        raise ValueError("Selected file exceeds the upload limit")
    try:
        with tempfile.TemporaryFile() as staged:
            if image:
                try:
                    data = uploaded.blob
                except Exception as exc:
                    raise ValueError("Dify could not read the selected file; check its file access configuration") from exc
                if not isinstance(data, bytes) or not 0 < len(data) <= max_size:
                    raise ValueError("Selected file is empty or exceeds the upload limit")
                staged.write(data)
            else:
                source = getattr(uploaded, "url", None)
                parsed = urlparse(source) if isinstance(source, str) else None
                if not parsed or parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username or parsed.password or parsed.fragment:
                    raise ValueError("Dify did not provide a usable file URL; configure FILES_URL/INTERNAL_FILES_URL")
                try:
                    with requests.get(source, timeout=(10, timeout), allow_redirects=False, stream=True) as download:
                        if 300 <= download.status_code < 400:
                            raise ValueError("Dify file redirects are not allowed")
                        download.raise_for_status()
                        total = 0
                        for chunk in download.iter_content(chunk_size=1024 * 1024):
                            total += len(chunk)
                            if total > max_size:
                                raise ValueError("Selected file exceeds the upload limit")
                            staged.write(chunk)
                        if total == 0 or isinstance(declared_size, int) and declared_size > 0 and total != declared_size:
                            raise ValueError("Dify file download was empty or incomplete")
                except requests.RequestException as exc:
                    raise ValueError("Could not read the selected Dify file; check its file URL and access settings") from exc
            staged.seek(0)
            fields = {key: str(value) for key, value in (params or {}).items()}
            if oauth:
                operation = fields.pop("idempotencyKey", None) or fields.get("operationId") or uuid.uuid4().hex
                require_token(operation, "operationId")
                if len(operation) > 64:
                    raise ValueError("OAuth operationId must be at most 64 characters")
                fields.pop("sync", None)
                fields.update({"operationId": operation, "mediaType": "image" if image else "video"})
            else:
                fields.update({"userNo": str(user_no), "apiKey": str(api_key)})
                headers = {}
            form = MultipartEncoder(fields={**fields, "file": (filename, staged, mime)})
            response = requests.post(root + "/media" if oauth else BASE_URL + endpoint,
                data=form, headers={**headers, "Content-Type": form.content_type}, timeout=(10, timeout),
                allow_redirects=False, stream=True)
            return _read_json_response(response)
    except requests.RequestException as exc:
        raise ValueError("550W upload failed; check the existing task before retrying") from exc
    except OSError as exc:
        raise ValueError("Temporary storage is unavailable or full; retry on a host with enough free disk space") from exc


def _read_json_response(response: requests.Response) -> dict[str, Any]:
    with response:
        if 300 <= response.status_code < 400:
            raise ValueError("API redirects are not allowed")
        response.raise_for_status()
        if not response.headers.get("Content-Type", "").lower().startswith("application/json"):
            raise ValueError("The service returned a non-JSON response")
        chunks, total = [], 0
        for chunk in response.iter_content(chunk_size=65536):
            total += len(chunk)
            if total > 2 * 1024 * 1024:
                raise ValueError("The service response is too large")
            chunks.append(chunk)
        result = json.loads(b"".join(chunks))
    if not isinstance(result, dict) or not isinstance(result.get("code"), int):
        raise ValueError("The service returned an invalid response")
    return result


def oauth_target(credentials):
    token = credentials.get("access_token")
    if credentials.get("region") != REGION or not isinstance(token, str) or not token or "\r" in token or "\n" in token:
        raise ValueError("Reconnect OAuth to this regional provider")
    return f"{BASE_URL}/media-api/{REGION}/v1", {"Authorization": "Bearer " + token}


def http_json(method, url, *, timeout=30, **kwargs):
    try:
        response = getattr(requests, method)(url, timeout=(10, timeout), allow_redirects=False, stream=True, **kwargs)
        return _read_json_response(response)
    except requests.RequestException as exc:
        raise ValueError("550W HTTP request failed; reconnect if authorization expired, and check the existing operation before retrying") from exc
