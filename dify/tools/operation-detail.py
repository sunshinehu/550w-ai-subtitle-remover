from dify_plugin import Tool
from tools.region import account_region
from tools.api import http_json, oauth_target, require_token


class OperationDetailTool(Tool):
    def _invoke(self, tool_parameters):
        try:
            root, headers = oauth_target(self.runtime.credentials)
            operation = require_token(tool_parameters.get("operationId"), "operationId")
            if len(operation) > 64:
                raise ValueError("operationId must be at most 64 characters")
            yield self.create_json_message(http_json("get", root + "/operations/" + operation, headers=headers, region=account_region(self.runtime.credentials, required=True)))
        except ValueError as exc:
            yield self.create_json_message({"code": -200, "message": str(exc)})
