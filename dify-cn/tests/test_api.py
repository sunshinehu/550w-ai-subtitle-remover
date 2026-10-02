import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tools.api import call_api, call_upload, require_token, require_url


class SelectedFile:
    def __init__(self, filename: str, blob: bytes, url: str | None = None):
        self.filename = filename
        self.blob = blob
        self.size = len(blob)
        self.url = url


class ApiTests(unittest.TestCase):
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
