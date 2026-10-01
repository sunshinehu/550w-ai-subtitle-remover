import https from "node:https";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { ApiResponse, Credential, BASE_URL, TIMEOUT_CONFIG } from "./types";
import { localize } from "./i18n";

export class ApiClient {
  private credential: Credential;
  private baseUrl: string;
  private locale?: unknown;

  constructor(credential: Credential, locale?: unknown) {
    this.credential = credential;
    this.baseUrl = BASE_URL;
    this.locale = locale;
  }

  async post(
    endpoint: string,
    params: Record<string, string>,
    timeout: number
  ): Promise<ApiResponse> {
    try {
      const body = new URLSearchParams({
        userNo: this.credential.userNo,
        apiKey: this.credential.apiKey,
        ...params,
      });

      return this.parseResponse(await this.request(endpoint, body.toString(), {
        "Content-Type": "application/x-www-form-urlencoded",
      }, timeout));
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async upload(
    endpoint: string,
    params: Record<string, string>,
    file: { name: string; data: any },
    timeout: number,
    fieldName = "file"
  ): Promise<ApiResponse> {
    try {
      const boundary = `550w-${randomBytes(16).toString("hex")}`;
      const fields = { userNo: this.credential.userNo, apiKey: this.credential.apiKey, ...params };
      const part = (name: string, value: string) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${this.safeHeader(name)}"\r\n\r\n${value}\r\n`;
      const chunks = Object.entries(fields).map(([name, value]) => part(name, value));
      chunks.push(`--${boundary}\r\nContent-Disposition: form-data; name="${this.safeHeader(fieldName)}"; filename="${this.safeHeader(file.name)}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
      const body = Readable.from((async function* () {
        for (const chunk of chunks) yield chunk;
        if (Buffer.isBuffer(file.data)) yield file.data;
        else for await (const chunk of file.data) yield chunk;
        yield `\r\n--${boundary}--\r\n`;
      })());
      return this.parseResponse(await this.request(endpoint, body, {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      }, timeout));
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  private safeHeader(value: string): string {
    return value.replace(/[\r\n"\\]/g, "_");
  }

  private request(endpoint: string, body: string | Readable, headers: Record<string, string>, timeout: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      if (url.origin !== new URL(this.baseUrl).origin) {
        reject(new Error("Invalid API endpoint"));
        return;
      }
      const request = https.request(url, { method: "POST", headers }, (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) {
            request.destroy(new Error("API response too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          clearTimeout(timer);
          if ((response.statusCode ?? 0) >= 300 && (response.statusCode ?? 0) < 400) {
            reject(new Error("API redirects are not allowed"));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
        response.on("error", reject);
      });
      const timer = setTimeout(() => {
        const error = Object.assign(new Error("Request timed out"), { code: "ETIMEDOUT" });
        request.destroy(error);
      }, timeout);
      request.on("error", (error) => {
        clearTimeout(timer);
        if (body instanceof Readable) body.destroy();
        reject(error);
      });
      if (body instanceof Readable) {
        body.on("error", (error) => request.destroy(error));
        body.pipe(request);
      } else request.end(body);
    });
  }

  private parseResponse(data: any): ApiResponse {
    if (data == null || typeof data.code === "undefined") {
      return { code: -500, message: localize(this.locale, "响应格式异常", "The service returned an invalid response") };
    }
    return data as ApiResponse;
  }

  private handleError(error: any): ApiResponse {
    const responseData = error?.response?.data;
    if (responseData != null && typeof responseData.code !== "undefined") {
      return this.parseResponse(responseData);
    }
    if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
      return { code: -500, message: localize(this.locale, "请求超时，请检查网络连接后重试", "The request timed out; check your connection and try again") };
    }
    return { code: -500, message: localize(this.locale, "网络请求失败，请检查网络连接后重试", "Network request failed; check your connection and try again") };
  }
}

export { TIMEOUT_CONFIG };
