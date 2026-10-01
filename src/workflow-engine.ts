declare function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): any;

import { uploadVideo } from "./actions/upload-video";
import { submitTask } from "./actions/submit-task";
import { taskDetail } from "./actions/task-detail";
import { assertPublicVideoUrl, probeVideoUrl } from "./video-probe";
import { ApiClient } from "./api-client";
import { SkillResponse, ErrorCode, POLL_INTERVAL, MAX_POLL_COUNT, MAX_CONSECUTIVE_FAILURES } from "./types";
import { validate } from "./validator";
import { localize, resolveLocale } from "./i18n";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWorkflow(
  params: Record<string, any>,
  client: ApiClient
): Promise<SkillResponse> {
  const inputError = validate("workflow", params);
  if (inputError) return inputError;
  let submitParams: Record<string, any>;

  if (params.file) {
    const uploadResult = await uploadVideo({ file: params.file, locale: params.locale }, client);
    if (uploadResult.code !== ErrorCode.SUCCESS) return uploadResult;

    submitParams = {
      videoUrl: uploadResult.videoUrl,
      coverUrl: uploadResult.coverUrl,
      width: uploadResult.width,
      height: uploadResult.height,
      duration: uploadResult.duration,
      ...(params.fileName != null && { fileName: params.fileName }),
      ...(params.callbackUrl != null && { callbackUrl: params.callbackUrl }),
      ...(params.removeAudio != null && { removeAudio: params.removeAudio }),
      ...(params.x1 != null && { x1: params.x1, y1: params.y1, x2: params.x2, y2: params.y2 }),
      ...(params.idempotencyKey != null && { idempotencyKey: params.idempotencyKey }),
      ...(params.subUserId != null && { subUserId: params.subUserId }),
      locale: params.locale,
    };
  } else {
    submitParams = { ...params };
    delete submitParams.file;

    delete submitParams.mode;

    try {
      if (params.width != null && params.height != null && params.duration != null) {
        await assertPublicVideoUrl(submitParams.videoUrl);
        submitParams.width = params.width;
        submitParams.height = params.height;
        submitParams.duration = params.duration;
      } else {
        const metadata = await probeVideoUrl(submitParams.videoUrl);
        submitParams.width = metadata.width;
        submitParams.height = metadata.height;
        submitParams.duration = metadata.duration;
      }
    } catch (error: any) {
      return { code: ErrorCode.INVALID_PARAMS, message: localize(params.locale, "无法读取远程视频信息。请确认链接可直接访问且视频格式受支持。", "Could not inspect the remote video. Make sure the URL is directly accessible and the video format is supported.") };
    }
  }

  const submitResult = await submitTask(submitParams, client);
  if (submitResult.code !== ErrorCode.SUCCESS) return submitResult;

  const taskId = submitResult.taskId as string;
  let consecutiveFailures = 0;

  for (let pollCount = 0; pollCount < MAX_POLL_COUNT; pollCount++) {
    await delay(POLL_INTERVAL);
    const detailResult = await taskDetail({ taskId, subUserId: params.subUserId, locale: params.locale, region: params.region }, client);

    if (detailResult.code !== ErrorCode.SUCCESS) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        return { code: ErrorCode.SERVER_ERROR, message: localize(params.locale, `连续 ${MAX_CONSECUTIVE_FAILURES} 次查询任务状态失败。请稍后使用任务编号查询最终状态。`, `Task status checks failed ${MAX_CONSECUTIVE_FAILURES} times. Use the task ID to check the final status later.`), taskId };
      }
      continue;
    }

    consecutiveFailures = 0;
    const status = detailResult.status as string;

    if (status === "success") {
      return { code: ErrorCode.SUCCESS, message: localize(params.locale, "视频擦除任务处理完成", "Video erasing completed"), taskId, resultUrl: detailResult.resultUrl };
    }
    if (status === "failed") {
      return {
        code: ErrorCode.BUSINESS_REJECTED,
        message: localize(params.locale,
          `任务处理失败：${detailResult.failReason || "未知原因"}${detailResult.refundStatus === 1 ? "。已退款" : ""}。`,
          `Task processing failed${detailResult.refundStatus === 1 ? "; deducted credits were refunded" : ""}.`),
        taskId,
        ...(detailResult.failCode != null && { failCode: detailResult.failCode }),
        ...(detailResult.refundStatus != null && { refundStatus: detailResult.refundStatus }),
        ...(resolveLocale(params.locale) === "zh" && detailResult.failReason ? { failReason: detailResult.failReason } : {}),
      };
    }
  }

  return { code: ErrorCode.SERVER_ERROR, message: localize(params.locale, `任务在 ${MAX_POLL_COUNT * POLL_INTERVAL / 1000 / 60} 分钟内未完成。请稍后使用任务编号查询最终状态。`, `The task did not finish within ${MAX_POLL_COUNT * POLL_INTERVAL / 1000 / 60} minutes. Use the task ID to check the final status later.`), taskId, timedOut: true };
}
