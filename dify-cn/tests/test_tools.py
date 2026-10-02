import importlib.util
import pathlib
import sys
import types
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def load_tool(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), ROOT / "tools" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ToolTests(unittest.TestCase):
    def new_tool(self, cls):
        tool = object.__new__(cls)
        tool.runtime = types.SimpleNamespace(credentials={"userNo": "user", "apiKey": "secret"})
        tool.create_json_message = lambda result: result
        return tool

    def test_image_tool_uploads_selected_file_with_stable_id(self):
        module = load_tool("remove-image-watermark")
        tool = self.new_tool(module.RemoveImageWatermarkTool)
        selected = object()
        with patch.object(module, "call_upload", return_value={"code": 200, "taskId": "image-1"}) as upload:
            result = list(tool._invoke({"file": selected, "operationId": "image-operation-1"}))[0]
        self.assertEqual(result["taskId"], "image-1")
        self.assertEqual(upload.call_args.args[1:3], ("/open/removeImageWatermark", selected))
        self.assertEqual(upload.call_args.args[3]["operationId"], "image-operation-1")

    def test_video_tool_uploads_then_submits_with_server_metadata(self):
        module = load_tool("submit-local-video")
        tool = self.new_tool(module.SubmitLocalVideoTool)
        selected = object()
        uploaded = {"code": 200, "videoUrl": "https://www.550wai.cn/v.mp4",
                    "width": 1920, "height": 1080, "duration": 30, "coverUrl": "https://www.550wai.cn/c.jpg"}
        with patch.object(module, "call_upload", return_value=uploaded) as upload, \
                patch.object(module, "call_api", return_value={"code": 200, "taskId": "video-1"}) as submit:
            result = list(tool._invoke({"file": selected, "idempotencyKey": "video-operation-1"}))[0]
        self.assertEqual(result["taskId"], "video-1")
        self.assertEqual(upload.call_args.args[1:3], ("/open/uploadVideo", selected))
        params = submit.call_args.args[2]
        self.assertEqual((params["width"], params["height"], params["duration"]), (1920, 1080, 30))
        self.assertEqual((params["x1"], params["y1"], params["x2"], params["y2"]), (0, 0, 0, 0))
        self.assertEqual(params["idempotencyKey"], "video-operation-1")

    def test_video_tool_rejects_partial_rectangle_before_submit(self):
        module = load_tool("submit-local-video")
        tool = self.new_tool(module.SubmitLocalVideoTool)
        uploaded = {"code": 200, "videoUrl": "https://www.550wai.cn/v.mp4",
                    "width": 1920, "height": 1080, "duration": 30}
        with patch.object(module, "call_upload", return_value=uploaded) as upload, \
                patch.object(module, "call_api") as submit:
            result = list(tool._invoke({"file": object(), "idempotencyKey": "video-operation-1", "x1": 3}))[0]
        self.assertEqual(result["code"], -200)
        upload.assert_not_called()
        submit.assert_not_called()

    def test_video_tool_rejects_fractional_rectangle_before_upload(self):
        module = load_tool("submit-local-video")
        tool = self.new_tool(module.SubmitLocalVideoTool)
        with patch.object(module, "call_upload") as upload, \
                patch.object(module, "call_api") as submit:
            result = list(tool._invoke({"file": object(), "idempotencyKey": "video-operation-1",
                                        "x1": 1.5, "y1": 2, "x2": 30, "y2": 40}))[0]
        self.assertEqual(result["code"], -200)
        upload.assert_not_called()
        submit.assert_not_called()

    def test_oauth_video_upload_submits_once_without_legacy_api(self):
        module = load_tool("submit-local-video")
        tool = self.new_tool(module.SubmitLocalVideoTool)
        tool.runtime.credentials = {"access_token": "token", "region": "global"}
        with patch.object(module, "call_upload", return_value={"code": 200, "status": "accepted", "taskId": "video-1"}) as upload, patch.object(module, "call_api") as submit:
            result = list(tool._invoke({"file": object(), "idempotencyKey": "video-operation-1"}))[0]
        self.assertEqual(result["taskId"], "video-1")
        self.assertEqual(upload.call_args.args[3], {"operationId": "video-operation-1"})
        submit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
