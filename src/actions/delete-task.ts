import { validate } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { localize } from "../i18n";

export async function deleteTask(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  // Keep the destructive gate at the execution boundary as well as in the MCP schema.
  if (params.confirmDeletion !== true) {
    return { code: ErrorCode.INVALID_PARAMS, message: localize(params.locale,
      "删除前须由用户确认任务 ID、媒体清理及不退积分，并传入 confirmDeletion=true",
      "Confirm the task ID, media cleanup, and no credit refund with the user before passing confirmDeletion=true") };
  }
  const validationError = validate("deleteTask", params);
  if (validationError) return validationError;
  const requestParams: Record<string, string> = { taskId: params.taskId.trim() };
  if (params.subUserId != null && String(params.subUserId).trim() !== "") {
    requestParams.subUserId = String(params.subUserId).trim();
  }
  const response = await client.post("/open/deleteTask", requestParams, TIMEOUT_CONFIG.query);
  return response.code === ErrorCode.SUCCESS
    ? { ...response, message: localize(params.locale, "任务已删除，相关媒体将异步清理；已扣积分不会退还", "Task deleted. Related media will be cleaned up asynchronously; charged credits are not refunded.") }
    : mapApiError(response, params.locale, params.region, true);
}
