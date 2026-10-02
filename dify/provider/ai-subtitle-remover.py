from typing import Any

from dify_plugin import ToolProvider
from dify_plugin.errors.tool import ToolProviderCredentialValidationError
from dify_plugin.errors.tool import ToolProviderOAuthError
from dify_plugin.entities.oauth import ToolOAuthCredentials
from tools import oauth
from tools.region import API_KEY_URL

from tools.api import call_api


class AiSubtitleRemoverProvider(ToolProvider):
    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        if not credentials.get("userNo") or not credentials.get("apiKey"):
            raise ToolProviderCredentialValidationError(
                f"User number and API key are required. Get them at {API_KEY_URL}"
            )
        try:
            result = call_api(credentials, "/open/queryCredits", {}, timeout=15)
            if result.get("code") != 200:
                raise ValueError(result.get("message") or "Credential validation failed")
        except Exception as exc:
            raise ToolProviderCredentialValidationError(str(exc)) from exc

    def _oauth_get_authorization_url(self, redirect_uri, system_credentials):
        try:
            return oauth.authorization_url(redirect_uri, system_credentials)
        except ValueError as exc:
            raise ToolProviderOAuthError(str(exc)) from exc

    def _oauth_get_credentials(self, redirect_uri, system_credentials, request):
        try:
            credentials, expires = oauth.exchange(redirect_uri, system_credentials, request)
            return ToolOAuthCredentials(credentials=credentials, expires_at=expires)
        except ValueError as exc:
            raise ToolProviderOAuthError(str(exc)) from exc

    def _oauth_refresh_credentials(self, redirect_uri, system_credentials, credentials):
        try:
            refreshed, expires = oauth.refresh(credentials)
            return ToolOAuthCredentials(credentials=refreshed, expires_at=expires)
        except ValueError as exc:
            raise ToolProviderOAuthError(str(exc)) from exc
