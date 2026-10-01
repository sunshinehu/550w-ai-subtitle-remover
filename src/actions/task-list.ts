import { normalizePageParams } from "../validator";
import { ApiClient } from "../api-client";
import { mapApiError } from "../error-handler";
import { SkillResponse, TIMEOUT_CONFIG, ErrorCode } from "../types";
import { localize, resolveLocale } from "../i18n";

export async function taskList(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const { page, size } = normalizePageParams(params);

  const requestParams: Record<string, string> = { page: String(page), size: String(size) };
  if (params.subUserId != null && String(params.subUserId).trim() !== "") requestParams.subUserId = String(params.subUserId).trim();
  const apiResponse = await client.post(
    "/open/taskList",
    requestParams,
    TIMEOUT_CONFIG.query
  );

  if (apiResponse.code !== ErrorCode.SUCCESS) {
    return mapApiError(apiResponse, params.locale, params.region);
  }

  return {
    code: ErrorCode.SUCCESS,
    message: localize(params.locale, "查询成功", "Tasks retrieved"),
    total: apiResponse.total,
    page,
    size,
    list: (apiResponse.list || []).map((item: Record<string, any>) => {
      const publicItem = { ...item };
      delete publicItem.x1;
      delete publicItem.y1;
      delete publicItem.x2;
      delete publicItem.y2;
      delete publicItem.mode;
      if (resolveLocale(params.locale) === "en") delete publicItem.failReason;
      return publicItem;
    }),
  };
}
