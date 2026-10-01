import { validate } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { localize } from "../i18n";

export async function uploadVideo(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const validationError = validate("uploadVideo", params);
  if (validationError) return validationError;

  const file = params.file;
  const apiResponse = await client.upload(
    "/open/uploadVideo",
    {},
    { name: file.name, data: file.data ?? file },
    TIMEOUT_CONFIG.upload
  );

  if (apiResponse.code === ErrorCode.SUCCESS) {
    return {
      code: ErrorCode.SUCCESS,
      message: localize(params.locale, "上传成功", "Upload completed"),
      videoUrl: apiResponse.videoUrl,
      coverUrl: apiResponse.coverUrl,
      width: apiResponse.width,
      height: apiResponse.height,
      duration: apiResponse.duration,
    };
  }

  return mapApiError(apiResponse, params.locale, params.region);
}
