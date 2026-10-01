import { SkillRequest, SkillResponse, ErrorCode, TIMEOUT_CONFIG } from "./types";
import { CredentialManager } from "./credential-manager";
import { ApiClient } from "./api-client";
import { uploadVideo } from "./actions/upload-video";
import { submitTask } from "./actions/submit-task";
import { taskDetail } from "./actions/task-detail";
import { taskList } from "./actions/task-list";
import { queryCredits } from "./actions/query-credits";
import { executeWorkflow } from "./workflow-engine";
import { removeVideoWatermark } from "./actions/remove-video-watermark";
import { removeImageWatermark } from "./actions/remove-image-watermark";
import { imageWatermarkTaskDetail } from "./actions/image-watermark-task-detail";
import { deleteTask } from "./actions/delete-task";
import { validateCredential } from "./validator";
import { mapApiError } from "./error-handler";
import { localize } from "./i18n";

export async function invoke(request: SkillRequest): Promise<SkillResponse> {
  const credentialManager = new CredentialManager();

  if (request.action === "configureCredentials") {
    const params = request.params || {};
    const validationError = validateCredential(params.userNo, params.apiKey, params.locale);
    if (validationError) return validationError;
    try {
      const candidate = { userNo: params.userNo.trim(), apiKey: params.apiKey.trim() };
      const verification = await new ApiClient(candidate, params.locale).post("/open/queryCredits", {}, TIMEOUT_CONFIG.query);
      if (verification.code !== ErrorCode.SUCCESS) return mapApiError(verification, params.locale, params.region);
      credentialManager.set(candidate);
      return { code: ErrorCode.SUCCESS, message: localize(params.locale, "凭证验证并配置成功", "Credentials verified and saved"), userNo: verification.userNo };
    } catch {
      return { code: ErrorCode.SERVER_ERROR, message: localize(params.locale, "凭证保存失败，请检查配置目录写入权限", "Could not save credentials; check access to the configuration directory") };
    }
  }

  if (!credentialManager.isConfigured()) {
    return credentialManager.getGuideMessage(request.params?.locale, request.params?.region);
  }

  const validActions = ["uploadVideo", "submitTask", "taskDetail", "taskList", "deleteTask", "queryCredits", "removeVideoWatermark", "removeImageWatermark", "imageWatermarkTaskDetail", "workflow"];
  if (!validActions.includes(request.action)) {
    return { code: ErrorCode.INVALID_PARAMS, message: localize(request.params?.locale, `不支持的 action：${request.action}`, `Unsupported action: ${request.action}`) };
  }

  const credential = credentialManager.get()!;
  const client = new ApiClient(credential, request.params?.locale);

  switch (request.action) {
    case "uploadVideo": return uploadVideo(request.params, client);
    case "submitTask": return submitTask(request.params, client);
    case "taskDetail": return taskDetail(request.params, client);
    case "taskList": return taskList(request.params, client);
    case "deleteTask": return deleteTask(request.params, client);
    case "queryCredits": return queryCredits(request.params, client);
    case "removeVideoWatermark": return removeVideoWatermark(request.params, client);
    case "removeImageWatermark": return removeImageWatermark(request.params, client);
    case "imageWatermarkTaskDetail": return imageWatermarkTaskDetail(request.params, client);
    case "workflow": return executeWorkflow(request.params, client);
    default: return { code: ErrorCode.INVALID_PARAMS, message: localize(request.params?.locale, `不支持的 action：${request.action}`, `Unsupported action: ${request.action}`) };
  }
}
