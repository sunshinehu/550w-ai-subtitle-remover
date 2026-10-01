import { validate } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { imageTaskResult } from "../image-task-result";

export async function imageWatermarkTaskDetail(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const validationError = validate("imageWatermarkTaskDetail", params);
  if (validationError) return validationError;
  const response = await client.post(
    "/open/imageWatermarkTaskDetail",
    { taskId: params.taskId },
    TIMEOUT_CONFIG.query
  );
  if (response.code !== ErrorCode.SUCCESS) return mapApiError(response, params.locale, params.region);
  return imageTaskResult(response, params.locale);
}
