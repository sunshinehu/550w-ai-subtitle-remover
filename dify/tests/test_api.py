import pathlib
import sys
import unittest
import requests
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tools.api import call_api, call_upload, require_token, require_url, _read_json_response, http_json
from unittest.mock import MagicMock


class SelectedFile:
    def __init__(self, filename: str, blob: bytes, url: str | None = None):
        self.filename = filename
        self.blob = blob
        self.size = len(blob)
        self.url = url


class ApiTests(unittest.TestCase):
    def test_auth_failures_keep_reconnection_action_without_purchase_guidance(self):
        for status, action in [(401, "RECONNECT_SAME_ACCOUNT"), (403, "REAUTHORIZE_REQUIRED_SCOPES")]:
            with self.subTest(status=status):
                response = MagicMock()
                response.status_code = status
                response.raise_for_status.side_effect = AssertionError("Must preserve auth outcome")
                result = _read_json_response(response)
                self.assertEqual(result["code"], status)
                self.assertEqual(result["nextAction"], action)
                self.assertFalse(result["automaticRetryAllowed"])
                self.assertNotIn("purchaseUrl", result)
                self.assertNotIn("purchaseRecoveryUrl", result)
                response.iter_content.assert_not_called()
                response.__exit__.assert_called_once()

    def test_unsupported_share_explains_regional_platforms_without_purchase(self):
        import json
        for region, expected in [("cn", "Douyin"), ("global", "TikTok")]:
            response = MagicMock()
            response.status_code = 400
            response.headers = {"Content-Type": "application/json"}
            response.iter_content.return_value = [json.dumps({"code":400,"errorCode":"SHARE_URL_UNSUPPORTED"}).encode()]
            with patch("tools.api.REGION", region):
                result = _read_json_response(response)
            self.assertIn(expected, result["message"])
            self.assertEqual(result["nextAction"], "PROVIDE_SUPPORTED_SHARE_LINK")
            self.assertFalse(result["automaticRetryAllowed"])
            self.assertNotIn("purchaseUrl", result)

    def test_structured_business_errors_preserve_recovery_without_retry(self):
        import json
        for status in (400, 402, 409, 422, 429):
            response = MagicMock()
            response.status_code = status
            response.headers = {"Content-Type": "application/json"}
            payload = {"code": status, "errorCode": "INSUFFICIENT_CREDITS",
                       "purchaseRecoveryUrl": "https://eraser.550wai.com/purchase/?source=agent&agent=dify",
                       "accountLabel": "****0000", "canSubmit": False}
            response.iter_content.return_value = [json.dumps(payload).encode()]
            result = _read_json_response(response)
            self.assertEqual(result["purchaseRecoveryUrl"], payload["purchaseRecoveryUrl"])
            self.assertFalse(result["automaticRetryAllowed"])
            response.raise_for_status.assert_not_called()

    @patch("tools.api.requests.post", side_effect=requests.Timeout("private transport detail"))
    def test_oauth_submission_timeout_preserves_generated_operation(self, post):
        with patch("tools.api.uuid.uuid4") as generated:
            generated.return_value.hex = "generated-operation-123"
            result = call_api({"access_token": "token", "region": "global"},
                              "/open/removeVideoWatermark", {"videoUrl": "https://example.com/share"})
        self.assertEqual(result["operationId"], post.call_args.kwargs["json"]["operationId"])
        self.assertEqual(result["operationId"], "generated-operation-123")
        self.assertEqual(result["status"], "unknown")
        self.assertEqual(result["nextAction"], "CHECK_ORIGINAL_OPERATION")
        self.assertFalse(result["automaticRetryAllowed"])
        self.assertNotIn("private transport detail", str(result))
        self.assertNotIn("purchaseUrl", result)
        post.assert_called_once()

    @patch("tools.api.requests.post", side_effect=requests.ConnectionError("lost response"))
    def test_oauth_upload_timeout_preserves_supplied_operation(self, post):
        result = call_upload({"access_token": "token", "region": "global"},
                             "/open/removeImageWatermark", SelectedFile("picture.png", b"image"),
                             {"operationId": "existing-operation-123"})
        self.assertEqual(result["operationId"], "existing-operation-123")
        self.assertEqual(result["code"], -201)
        self.assertFalse(result["automaticRetryAllowed"])
        post.assert_called_once()
        self.assertTrue(post.call_args.kwargs["data"].fields["file"][1].closed)

    @patch("tools.api.requests.post", side_effect=requests.Timeout("timeout"))
    def test_oauth_submission_timeout_keeps_caller_id_without_retry(self, post):
        result = call_api({"access_token": "token", "region": "global"},
                          "/open/submitTask", {"videoUrl": "https://example.com/video.mp4",
                                                "idempotencyKey": "caller-operation-123"})
        self.assertEqual(result["operationId"], "caller-operation-123")
        self.assertEqual(result["operationId"], post.call_args.kwargs["json"]["operationId"])
        self.assertFalse(result["automaticRetryAllowed"])
        post.assert_called_once()

    @patch("tools.api.requests.post")
    def test_oauth_auth_rejection_is_not_mislabeled_as_unknown_submission(self, post):
        post.return_value.status_code = 401
        result = call_api({"access_token": "token", "region": "global"},
                          "/open/removeVideoWatermark", {"videoUrl": "https://example.com/share"})
        self.assertEqual(result["code"], 401)
        self.assertEqual(result["nextAction"], "RECONNECT_SAME_ACCOUNT")
        self.assertNotIn("operationId", result)
        post.assert_called_once()

    @patch("tools.api.requests.get", side_effect=requests.Timeout("read failed"))
    def test_read_timeout_does_not_claim_unknown_submission(self, get):
        with self.assertRaisesRegex(ValueError, "check the existing operation"):
            http_json("get", "https://www.550wai.cn/media-api/global/v1/account")
        get.assert_called_once()

    def test_extracts_share_link(self):
        self.assertEqual(require_url("Watch https://www.tiktok.com/@user/video/123！"),
                         "https://www.tiktok.com/@user/video/123")

    def test_rejects_credential_in_media_url(self):
        with self.assertRaises(ValueError):
            require_url("https://name:password@example.com/video.mp4")

    def test_rejects_unsafe_token(self):
        with self.assertRaises(ValueError):
            require_token("a&apiKey=leak", "operationId")

    @patch("tools.api.requests.post")
    def test_credential_fields_go_only_to_fixed_api_host(self, post):
        post.return_value.headers = {"Content-Type": "application/json"}
        post.return_value.status_code = 200
        post.return_value.iter_content.return_value = [b'{"code":200,"credits":1}']
        post.return_value.__enter__.return_value = post.return_value
        call_api({"userNo": "user", "apiKey": "secret"}, "/open/queryCredits", {})
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://www.550wai.cn/open/queryCredits")
        self.assertEqual(kwargs["data"], {"userNo": "user", "apiKey": "secret"})
        self.assertFalse(kwargs["allow_redirects"])

    def test_rejects_unlisted_endpoint(self):
        with self.assertRaises(ValueError):
            call_api({"userNo": "user", "apiKey": "secret"}, "https://elsewhere.example", {})

    @patch("tools.api.requests.post")
    def test_image_upload_uses_fixed_host_and_multipart(self, post):
        post.return_value.headers = {"Content-Type": "application/json"}
        post.return_value.status_code = 200
        post.return_value.iter_content.return_value = [b'{"code":200,"taskId":"image-task"}']
        post.return_value.__enter__.return_value = post.return_value
        result = call_upload({"userNo": "user", "apiKey": "secret"},
                             "/open/removeImageWatermark", SelectedFile("picture.png", b"image"),
                             {"operationId": "stable-id", "sync": "true"})
        self.assertEqual(result["taskId"], "image-task")
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://www.550wai.cn/open/removeImageWatermark")
        self.assertEqual(kwargs["data"].fields["operationId"], "stable-id")
        self.assertEqual(kwargs["data"].fields["file"][0], "picture.png")
        self.assertTrue(kwargs["headers"]["Content-Type"].startswith("multipart/form-data; boundary="))
        self.assertFalse(kwargs["allow_redirects"])

    @patch("tools.api.requests.post")
    @patch("tools.api.requests.get")
    def test_video_upload_streams_dify_url_without_reading_blob(self, get, post):
        selected = SelectedFile("clip.mp4", b"unused", "https://dify.example/file/clip")
        selected.size = 5
        del selected.blob
        get.return_value.status_code = 200
        get.return_value.iter_content.return_value = [b"video"]
        get.return_value.__enter__.return_value = get.return_value
        post.return_value.headers = {"Content-Type": "application/json"}
        post.return_value.status_code = 200
        post.return_value.iter_content.return_value = [b'{"code":200,"videoUrl":"https://www.550wai.cn/v.mp4"}']
        post.return_value.__enter__.return_value = post.return_value
        result = call_upload({"userNo": "user", "apiKey": "secret"}, "/open/uploadVideo", selected)
        self.assertEqual(result["code"], 200)
        get.assert_called_once_with("https://dify.example/file/clip", timeout=(10, 120),
                                    allow_redirects=False, stream=True)
        self.assertEqual(post.call_args.args[0], "https://www.550wai.cn/open/uploadVideo")
        self.assertEqual(post.call_args.kwargs["data"].fields["file"][0], "clip.mp4")

    @patch("tools.api.requests.get")
    def test_video_upload_rejects_incomplete_dify_download(self, get):
        selected = SelectedFile("clip.mp4", b"unused", "https://dify.example/file/clip")
        selected.size = 6
        get.return_value.status_code = 200
        get.return_value.iter_content.return_value = [b"video"]
        get.return_value.__enter__.return_value = get.return_value
        with self.assertRaisesRegex(ValueError, "incomplete"):
            call_upload({"userNo": "user", "apiKey": "secret"}, "/open/uploadVideo", selected)

    @patch("tools.api.requests.post")
    @patch("tools.api.requests.get")
    def test_video_larger_than_old_50_mib_cap_uses_bounded_spool(self, get, post):
        selected = SelectedFile("clip.mov", b"", "https://dify.example/file/large")
        selected.size = 51 * 1024 * 1024
        chunk = b"x" * (1024 * 1024)
        get.return_value.status_code = 200
        get.return_value.iter_content.return_value = (chunk for _ in range(51))
        get.return_value.__enter__.return_value = get.return_value
        post.return_value.headers = {"Content-Type": "application/json"}
        post.return_value.status_code = 200
        post.return_value.iter_content.return_value = [b'{"code":200}']
        post.return_value.__enter__.return_value = post.return_value
        self.assertEqual(call_upload({"userNo": "user", "apiKey": "secret"},
                                     "/open/uploadVideo", selected)["code"], 200)
        self.assertEqual(post.call_args.kwargs["data"].fields["file"][0], "clip.mov")

    def test_upload_rejects_wrong_type_and_host(self):
        creds = {"userNo": "user", "apiKey": "secret"}
        with self.assertRaises(ValueError):
            call_upload(creds, "https://example.com/steal", SelectedFile("image.png", b"x"))
        with self.assertRaises(ValueError):
            call_upload(creds, "/open/uploadVideo", SelectedFile("image.png", b"x"))
        with self.assertRaises(ValueError):
            call_upload(creds, "/open/removeImageWatermark", SelectedFile("image.png", b""))


if __name__ == "__main__":
    unittest.main()
