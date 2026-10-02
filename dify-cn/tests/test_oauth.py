import hashlib
import base64
import importlib
import pathlib
import sys
import unittest
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from tools import oauth
from tools.api import call_api, call_upload

SETTINGS = {"oauth_state_secret": "test-only-" + "a" * 40}
CALLBACK = "https://dify.example/console/api/oauth/plugin/550w/tool/callback"
CREDENTIALS = {"access_token": "limited-test-token", "region": "global"}


class OAuthTests(unittest.TestCase):
    def authorize(self):
        with patch("tools.oauth._post", return_value={"client_id": "public-client"}):
            return parse_qs(urlparse(oauth.authorization_url(CALLBACK, SETTINGS)).query)

    @patch("tools.oauth._post")
    def test_registration_pkce_callback_and_token_exchange(self, post):
        post.side_effect = [{"client_id": "public-client"},
                            {"access_token": "access", "refresh_token": "refresh", "expires_in": 900}]
        params = parse_qs(urlparse(oauth.authorization_url(CALLBACK, SETTINGS)).query)
        self.assertEqual(params["code_challenge_method"], ["S256"])
        self.assertLessEqual(len(params["state"][0]), 500)
        self.assertEqual(post.call_args.args[1]["token_endpoint_auth_method"], "none")
        result, expiry = oauth.exchange(CALLBACK, SETTINGS, SimpleNamespace(args={"code": "code", "state": params["state"][0]}))
        verifier = post.call_args.args[1]["code_verifier"]
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        self.assertEqual(params["code_challenge"], [challenge])
        self.assertEqual(result["region"], "global")
        self.assertNotIn("oauth_state_secret", result)
        self.assertNotIn("code_verifier", result)

    def test_tampered_expired_wrong_callback_or_instance_state_rejected(self):
        state = self.authorize()["state"][0]
        cases = [(CALLBACK + "/wrong", SETTINGS, state),
                 (CALLBACK, {"oauth_state_secret": "different-secret-" + "b" * 40}, state),
                 (CALLBACK, SETTINGS, "invalid" + state)]
        for callback, settings, altered in cases:
            with patch("tools.oauth._post") as post, self.assertRaises(ValueError):
                oauth.exchange(callback, settings, SimpleNamespace(args={"state": altered, "code": "code"}))
            post.assert_not_called()
        with patch("tools.oauth.time.time", return_value=10**12), self.assertRaises(ValueError):
            oauth.exchange(CALLBACK, SETTINGS, SimpleNamespace(args={"state": state, "code": "code"}))

    def test_secret_and_https_required_before_registration(self):
        for callback, settings in [("http://dify.example/callback", SETTINGS), (CALLBACK, {})]:
            with patch("tools.oauth._post") as post, self.assertRaises(ValueError):
                oauth.authorization_url(callback, settings)
            post.assert_not_called()

    @patch("tools.oauth._post")
    def test_refresh_rotates_refresh_token_and_preserves_client(self, post):
        post.return_value = {"access_token": "new-access", "refresh_token": "rotated", "expires_in": 900}
        result, _ = oauth.refresh({**CREDENTIALS, "client_id": "public-client", "refresh_token": "old"})
        self.assertEqual(result["refresh_token"], "rotated")
        self.assertEqual(result["client_id"], "public-client")
        self.assertEqual(post.call_args.args[1]["resource"], "https://www.550wai.cn/media-api/global")

    @patch("tools.api.http_json", return_value={"code": 200, "credits": 1})
    def test_oauth_account_never_uses_legacy_credentials(self, http):
        call_api({**CREDENTIALS, "apiKey": "legacy", "userNo": "legacy"}, "/open/queryCredits", {})
        self.assertEqual(http.call_args.args, ("get", "https://www.550wai.cn/media-api/global/v1/account"))
        self.assertEqual(http.call_args.kwargs["headers"], {"Authorization": "Bearer limited-test-token"})
        self.assertNotIn("data", http.call_args.kwargs)

    @patch("tools.api.http_json", return_value={"code": 200, "status": "accepted"})
    def test_oauth_share_returns_recoverable_operation(self, http):
        call_api(CREDENTIALS, "/open/removeVideoWatermark", {"videoUrl": "https://www.tiktok.com/@u/video/123", "operationId": "stable-id"})
        self.assertEqual(http.call_args.kwargs["json"]["operationId"], "stable-id")
        self.assertEqual(http.call_args.kwargs["json"]["mediaType"], "share")

    def test_cross_region_token_is_not_silently_fallen_back(self):
        with patch("tools.api.requests.post") as post, self.assertRaises(ValueError):
            call_api({"access_token": "token", "region": "cn", "apiKey": "key", "userNo": "user"}, "/open/queryCredits", {})
        post.assert_not_called()

    @patch("tools.api.requests.post")
    def test_oauth_image_upload_has_bearer_no_api_key(self, post):
        post.return_value.headers = {"Content-Type": "application/json"}
        post.return_value.status_code = 200
        post.return_value.iter_content.return_value = [b'{"code":200,"status":"accepted","taskId":"image-task"}']
        post.return_value.__enter__.return_value = post.return_value
        call_upload(CREDENTIALS, "/open/removeImageWatermark", SimpleNamespace(filename="test.png", size=5, blob=b"image"), {"operationId": "stable-id", "sync": "true"})
        self.assertEqual(post.call_args.args[0], "https://www.550wai.cn/media-api/global/v1/media")
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer limited-test-token")
        fields = post.call_args.kwargs["data"].fields
        self.assertNotIn("userNo", fields)
        self.assertNotIn("apiKey", fields)
        self.assertNotIn("sync", fields)
        self.assertEqual(fields["mediaType"], "image")
