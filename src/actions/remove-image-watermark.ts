import { validate } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { imageTaskResult } from "../image-task-result";

export async function removeImageWatermark(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const validationError = validate("removeImageWatermark", params);
  if (validationError) return validationError;

  const file = params.file;
  const requestParams: Record<string, string> = {
    sync: String(params.sync ?? true),
  };
  if (params.operationId != null && String(params.operationId).trim() !== "") {
    requestParams.operationId = String(params.operationId).trim();
  }
  const response = await client.upload(
    "/open/removeImageWatermark",
    requestParams,
    { name: file.name, data: file.data ?? file },
    TIMEOUT_CONFIG.imageWatermark
  );
  return response.code === ErrorCode.SUCCESS
    ? imageTaskResult(response, params.locale)
    : mapApiError(response, params.locale, params.region, true);
}
