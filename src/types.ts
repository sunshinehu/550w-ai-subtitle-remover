// ============================================================
// ai-subtitle-remover Skill - 核心类型与接口定义
// ============================================================

// ======================== Action 类型 ========================

export type ActionType =
  | "configureCredentials"
  | "uploadVideo"
  | "submitTask"
  | "taskDetail"
  | "taskList"
  | "deleteTask"
  | "queryCredits"
  | "removeVideoWatermark"
  | "removeImageWatermark"
  | "imageWatermarkTaskDetail"
  | "workflow";

// ======================== 请求/响应 ========================

export interface SkillRequest {
  action: ActionType;
  params: Record<string, any>;
}

export interface SkillResponse {
  code: number;
  message: string;
  [key: string]: any;
}

// ======================== 凭证 ========================

export interface Credential {
  userNo: string;
  apiKey: string;
}

// ======================== 任务状态 ========================

export type TaskStatus = "waiting" | "processing" | "success" | "failed";

// ======================== 错误码 ========================

export enum ErrorCode {
  SUCCESS = 200,
  AUTH_FAILED = -100,
  INVALID_PARAMS = -200,
  BUSINESS_REJECTED = -300,
  ACCOUNT_TEMPORARILY_BLOCKED = -401,
  ACCOUNT_PERMANENTLY_BLOCKED = -402,
  SERVER_ERROR = -500,
  UNSUPPORTED_VIDEO = -600,
}

// ======================== 校验规则 ========================

export interface ValidationRule {
  field: string;
  type: "string" | "number" | "file";
  required: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any, allParams: Record<string, any>) => string | null;
}

// ======================== Action Params ========================

export interface UploadVideoParams {
  file: { name: string; size: number; data: Buffer | any };
}

export interface SubmitTaskParams {
  videoUrl: string;
  width: number;
  height: number;
  duration: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  fileName?: string;
  coverUrl?: string;
  callbackUrl?: string;
  removeAudio?: boolean;
  idempotencyKey?: string;
  subUserId?: string;
}

export interface ConfigureCredentialsParams {
  userNo: string;
  apiKey: string;
}

export interface RemoveVideoWatermarkParams {
  videoUrl: string;
  operationId?: string;
}

export interface RemoveImageWatermarkParams {
  file: { name: string; size: number; data: Buffer | any };
  sync?: boolean;
  operationId?: string;
}

export interface ImageWatermarkTaskDetailParams {
  taskId: string;
}

export interface TaskDetailParams {
  taskId: string;
  subUserId?: string;
}

export interface TaskListParams {
  page?: number;
  size?: number;
  subUserId?: string;
}

export interface DeleteTaskParams {
  taskId: string;
  subUserId?: string;
  confirmDeletion: true;
}

export interface QueryCreditsParams {}

export interface EstimateCreditsParams {
  width: number;
  height: number;
  duration: number;
}

// ======================== Action Results ========================

export interface UploadVideoResult {
  videoUrl: string;
  coverUrl: string;
  width: number;
  height: number;
  duration: number;
}

export interface SubmitTaskResult {
  taskId: string;
  status: "waiting";
}

export interface TaskDetailResult {
  taskId: string;
  status: TaskStatus;
  width: number;
  height: number;
  duration: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mode: string;
  cost: number;
  createTime: number;
  updateTime: number;
  resultUrl?: string;
  failReason?: string;
  failCode?: string;
  refundStatus?: number;
}

export interface TaskListItem {
  taskId: string;
  status: TaskStatus;
  fileName?: string;
  coverUrl?: string;
  width: number;
  height: number;
  duration: number;
  cost: number;
  mode: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  createTime: number;
  updateTime: number;
  expiredTime?: number;
  resultUrl?: string;
}

export interface TaskListResult {
  total: number;
  page: number;
  size: number;
  list: TaskListItem[];
}

export interface QueryCreditsResult {
  userNo: string;
  credits: number;
}

export interface EstimateCreditsResult {
  estimatedCost: number;
  resolution: "720p_or_below" | "above_720p";
}

// ======================== Workflow ========================

export interface WorkflowResult {
  code: number;
  message: string;
  taskId?: string;
  resultUrl?: string;
  failReason?: string;
  timedOut?: boolean;
}

export interface WorkflowConfig {
  pollInterval: number;
  maxPollCount: number;
  maxConsecutiveFailures: number;
}

// ======================== ApiClient ========================

export interface ApiClientConfig {
  baseUrl: string;
  uploadTimeout: number;
  submitTimeout: number;
  queryTimeout: number;
}

export interface ApiResponse {
  code: number;
  message: string;
  [key: string]: any;
}

// ======================== 常量配置 ========================

export const TIMEOUT_CONFIG = {
  upload: 180_000,
  submit: 150_000,
  query: 10_000,
  videoWatermark: 45_000,
  imageWatermark: 180_000,
} as const;

export const MAX_FILE_SIZE = 1_073_741_824;
export const MAX_URL_LENGTH = 2048;
export const MAX_DURATION = 600;
export const MAX_DIMENSION = 10000;
export const MAX_TASK_ID_LENGTH = 64;
export const MAX_CREDENTIAL_LENGTH = 128;
export const MAX_IMAGE_FILE_SIZE = 52_428_800;
export const POLL_INTERVAL = 30_000;
export const MAX_POLL_COUNT = 20;
export const MAX_CONSECUTIVE_FAILURES = 3;
export const RESOLUTION_720P_THRESHOLD = 921_600;
export const RATE_720P_OR_BELOW = 1.3;
export const RATE_ABOVE_720P = 1.6;
export const BASE_URL = "https://www.550wai.cn";
export const CREDENTIAL_APPLY_URL_ZH = "https://qzm.550wai.cn/api-keys";
export const CREDENTIAL_APPLY_URL_EN = "https://eraser.550wai.com/api/";
// Backward-compatible alias for callers that expect the original constant.
export const CREDENTIAL_APPLY_URL = CREDENTIAL_APPLY_URL_ZH;
export const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov"] as const;
export const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".bmp", ".webp", ".avif", ".tif", ".tiff", ".svg"] as const;
