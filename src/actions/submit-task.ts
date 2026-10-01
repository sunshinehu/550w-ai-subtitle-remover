import { validate } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { localize } from "../i18n";

export async function submitTask(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const validationError = validate("submitTask", params);
  if (validationError) return validationError;

  const requestParams: Record<string, string> = {
    videoUrl: params.videoUrl,
    width: String(params.width),
    height: String(params.height),
    duration: String(params.duration),
    // Default to full-frame; a complete validated rectangle is an explicit override.
    x1: String(params.x1 ?? 0),
    y1: String(params.y1 ?? 0),
    x2: String(params.x2 ?? 0),
    y2: String(params.y2 ?? 0),
  };

  if (params.fileName != null && params.fileName !== "") requestParams.fileName = String(params.fileName);
  if (params.coverUrl != null && params.coverUrl !== "") requestParams.coverUrl = String(params.coverUrl);
  if (params.callbackUrl != null && params.callbackUrl !== "") requestParams.callbackUrl = String(params.callbackUrl);
  if (params.removeAudio != null) requestParams.removeAudio = String(params.removeAudio);
  if (params.idempotencyKey != null && String(params.idempotencyKey).trim() !== "") requestParams.idempotencyKey = String(params.idempotencyKey).trim();
  if (params.subUserId != null && String(params.subUserId).trim() !== "") requestParams.subUserId = String(params.subUserId).trim();

  const apiResponse = await client.post("/open/submitTask", requestParams, TIMEOUT_CONFIG.submit);

  if (apiResponse.code === ErrorCode.SUCCESS) {
    return {
      code: ErrorCode.SUCCESS,
      message: localize(params.locale, "任务提交成功", "Task submitted"),
      taskId: apiResponse.taskId,
      status: "waiting",
      notice: params.idempotencyKey
        ? localize(params.locale, "相同幂等键和提交参数可安全重放并返回原任务", "The same idempotency key and submission parameters can be replayed safely to return the original task")
        : localize(params.locale, "注意：未提供幂等键时，相同 videoUrl 重复提交会被视为独立任务并独立计费", "Without an idempotency key, submitting the same videoUrl again creates a separate task and may be billed separately"),
    };
  }

  return mapApiError(apiResponse, params.locale, params.region, true);
}
