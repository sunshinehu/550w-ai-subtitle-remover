import { validate } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { localize, resolveLocale } from "../i18n";

export async function taskDetail(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const validationError = validate("taskDetail", params);
  if (validationError) return validationError;

  const requestParams: Record<string, string> = { taskId: params.taskId };
  if (params.subUserId != null && String(params.subUserId).trim() !== "") requestParams.subUserId = String(params.subUserId).trim();
  const apiResponse = await client.post("/open/taskDetail", requestParams, TIMEOUT_CONFIG.query);

  if (apiResponse.code !== ErrorCode.SUCCESS) {
    return mapApiError(apiResponse, params.locale, params.region);
  }

  const { taskId, status, width, height, duration, cost, createTime, updateTime, resultUrl, failReason, failCode, refundStatus } = apiResponse;

  const response: SkillResponse = {
    code: ErrorCode.SUCCESS,
    message: localize(params.locale, "查询成功", "Task retrieved"),
    taskId, status, width, height, duration, cost, createTime, updateTime,
    ...(failCode != null && { failCode }),
    ...(refundStatus != null && { refundStatus }),
  };

  switch (status) {
    case "success": response.resultUrl = resultUrl; break;
    case "failed":
      response.message = localize(params.locale, `任务处理失败：${failReason || "未知原因"}`, "Task processing failed");
      if (resolveLocale(params.locale) === "zh" && failReason) response.failReason = failReason;
      break;
    case "waiting":
    case "processing":
      response.message = localize(params.locale, `任务${status === "waiting" ? "等待中" : "处理中"}，建议 30 秒后再次查询`, `Task is ${status}; check again in about 30 seconds`);
      break;
  }

  return response;
}
