import { validate } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { localize } from "../i18n";

export async function removeVideoWatermark(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const rawInput = typeof params.videoUrl === "string" ? params.videoUrl.trim() : "";
  const extractedUrl = rawInput.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[，。；;！!）)】\]]+$/, "") || rawInput;
  const normalizedParams = { ...params, videoUrl: extractedUrl };
  const validationError = validate("removeVideoWatermark", normalizedParams);
  if (validationError) return validationError;

  const response = await client.post(
    "/open/removeVideoWatermark",
    { videoUrl: extractedUrl, ...(params.operationId ? { operationId: params.operationId.trim() } : {}) },
    TIMEOUT_CONFIG.videoWatermark
  );
  return response.code === ErrorCode.SUCCESS
    ? { ...response, message: localize(params.locale, "视频链接已解析；Skill 未下载视频文件", "Video link resolved; the Skill has not downloaded the file") }
    : mapApiError(response, params.locale, params.region, true);
}
