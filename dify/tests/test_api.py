import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tools.api import call_api, require_token, require_url


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


if __name__ == "__main__":
    unittest.main()
