from dify_plugin import Tool
from tools.api import http_json, oauth_target
from tools.region import REGION


class EstimateMediaCostTool(Tool):
    def _invoke(self, tool_parameters):
        try:
            if "access_token" not in self.runtime.credentials:
                yield self.create_json_message({
                    "code": 422, "status": "unsupported_auth_mode",
                    "nextAction": "CHECK_REGIONAL_API_PRICING",
                    "automaticRetryAllowed": False,
                    "fallbackUrl": "https://eraser.550wai.com/api/" if REGION == "global" else "https://qzm.550wai.cn/api/",
                    "message": "This quote tool requires OAuth. Check regional API pricing for API Key workflows; no quote was produced and no processing was submitted. Do not switch accounts automatically.",
                })
                return
            root, headers = oauth_target(self.runtime.credentials)
            media_type = tool_parameters.get("mediaType")
            if media_type not in ("image", "video", "share"):
                raise ValueError("Choose image, video or share")
            params = {"mediaType": media_type}
            for key in ("width", "height", "durationSeconds", "fileSizeBytes"):
                value = tool_parameters.get(key)
                if value is None or value == "":
                    continue
                if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0 or not float(value).is_integer():
                    raise ValueError(f"{key} must be a positive whole number from actual media metadata")
                if key == "durationSeconds" and value > 600:
                    raise ValueError("Video duration must not exceed 600 seconds")
                params[key] = int(value)
            yield self.create_json_message(http_json("post", root + "/quote", headers=headers, json=params))
        except ValueError as exc:
            yield self.create_json_message({"code": -200, "message": str(exc), "automaticRetryAllowed": False})
