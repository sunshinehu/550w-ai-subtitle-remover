import { validate, estimateCredits } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { localize } from "../i18n";

export async function queryCredits(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const apiResponse = await client.post("/open/queryCredits", {}, TIMEOUT_CONFIG.query);

  if (apiResponse.code !== ErrorCode.SUCCESS) {
    return mapApiError(apiResponse, params.locale, params.region);
  }

  const result: SkillResponse = {
    code: ErrorCode.SUCCESS,
    message: localize(params.locale, "查询成功", "Credits retrieved"),
    userNo: apiResponse.userNo,
    credits: apiResponse.credits,
  };

  if (params.width !== undefined || params.height !== undefined || params.duration !== undefined) {
    const estimateError = validate("estimateCredits", params);
    if (estimateError) return estimateError;
    result.estimation = estimateCredits(params.width, params.height, params.duration);
  }

  return result;
}
