import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  Credential,
  SkillResponse,
  ErrorCode,
  MAX_CREDENTIAL_LENGTH,
} from "./types";
import { credentialApplyUrl, globalPolicyUrl, localize, resolveServiceRegion } from "./i18n";

export class CredentialManager {
  private readonly storagePath: string;
  private readonly legacyStoragePath: string;

  constructor(storagePath?: string) {
    const configRoot = process.env.XDG_CONFIG_HOME?.trim()
      || (process.platform === "win32" ? process.env.APPDATA?.trim() : null)
      || path.join(os.homedir(), ".config");
    this.storagePath = storagePath ?? path.join(configRoot, "550w-ai", "credentials.json");
    this.legacyStoragePath = path.resolve(__dirname, "../.credentials.json");
  }

  get(): Credential | null {
    // 优先从环境变量读取
    const envUserNo = process.env.SUBTITLE_REMOVER_USER_NO?.trim();
    const envApiKey = process.env.SUBTITLE_REMOVER_API_KEY?.trim();
    if (
      envUserNo &&
      envApiKey &&
      envUserNo.length >= 1 &&
      envUserNo.length <= MAX_CREDENTIAL_LENGTH &&
      envApiKey.length >= 1 &&
      envApiKey.length <= MAX_CREDENTIAL_LENGTH
    ) {
      return { userNo: envUserNo, apiKey: envApiKey };
    }

    // 其次从用户配置目录读取；最后只读兼容旧版本 Skill 目录内的凭证。
    return this.readFile(this.storagePath)
      ?? (this.storagePath !== this.legacyStoragePath ? this.readFile(this.legacyStoragePath) : null);
  }

  private readFile(target: string): Credential | null {
    try {
      const content = fs.readFileSync(target, "utf-8");
      const data = JSON.parse(content);
      if (
        typeof data.userNo === "string" &&
        typeof data.apiKey === "string" &&
        data.userNo.trim().length >= 1 &&
        data.userNo.trim().length <= MAX_CREDENTIAL_LENGTH &&
        data.apiKey.trim().length >= 1 &&
        data.apiKey.trim().length <= MAX_CREDENTIAL_LENGTH
      ) {
        return { userNo: data.userNo.trim(), apiKey: data.apiKey.trim() };
      }
      return null;
    } catch {
      return null;
    }
  }

  set(credential: Credential): void {
    const userNo = credential.userNo?.trim() ?? "";
    const apiKey = credential.apiKey?.trim() ?? "";

    if (userNo.length < 1 || userNo.length > MAX_CREDENTIAL_LENGTH) {
      throw new Error(
        `userNo 长度必须在 1-${MAX_CREDENTIAL_LENGTH} 之间，当前长度: ${userNo.length}`
      );
    }
    if (apiKey.length < 1 || apiKey.length > MAX_CREDENTIAL_LENGTH) {
      throw new Error(
        `apiKey 长度必须在 1-${MAX_CREDENTIAL_LENGTH} 之间，当前长度: ${apiKey.length}`
      );
    }

    const stored = { userNo, apiKey, updatedAt: Date.now() };
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    fs.writeFileSync(this.storagePath, JSON.stringify(stored, null, 2), { encoding: "utf-8", mode: 0o600 });
    fs.chmodSync(this.storagePath, 0o600);
  }

  isConfigured(): boolean {
    return this.get() !== null;
  }

  getGuideMessage(locale?: string, region?: string): SkillResponse {
    const applyUrl = credentialApplyUrl(locale, region);
    return {
      code: ErrorCode.AUTH_FAILED,
      message: localize(locale,
        `尚未配置凭证。请前往 ${applyUrl} 获取用户 ID 和 API Key，然后在连接器设置中完成配置。`,
        `Credentials are not configured. Get your user ID and API key at ${applyUrl}, then add them in the connector settings.`),
      credentialSetup: {
        required: ["userNo", "apiKey"],
        url: applyUrl,
        urls: { zh: applyUrl, en: applyUrl },
        ...(resolveServiceRegion(region, locale) === "global" && {
          privacyUrl: globalPolicyUrl("privacy", locale),
          termsUrl: globalPolicyUrl("terms", locale),
        }),
      },
    };
  }
}
