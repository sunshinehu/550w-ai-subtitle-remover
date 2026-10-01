#!/usr/bin/env node
import { invoke } from "./dispatcher";
import { SkillRequest } from "./types";
import { localize } from "./i18n";
import { openSelectedLocalMedia } from "./local-media";
import { requireProcessingApproval } from './processing-approval';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

function attachLocalFile(request: SkillRequest): SkillRequest {
  const params = { ...(request.params || {}) };
  const filePath = typeof params.filePath === "string" ? params.filePath : null;
  if (!filePath) return { ...request, params };

  const kind = request.action === "removeImageWatermark" ? "image" : "video";
  params.file = openSelectedLocalMedia(filePath, kind);
  delete params.filePath;
  return { ...request, params };
}

async function main(): Promise<void> {
  let locale: unknown;
  try {
    const input = (await readStdin()).trim();
    if (!input) throw new Error(localize(locale, "请通过标准输入提供 JSON 请求", "Provide a JSON request on standard input"));
    const parsed = JSON.parse(input) as SkillRequest;
    locale = parsed.params?.locale;
    const approvalError = requireProcessingApproval(parsed.action, parsed.params);
    if (approvalError) {
      process.stdout.write(`${JSON.stringify(approvalError)}\n`);
      process.exitCode = 1;
      return;
    }
    const request = attachLocalFile(parsed);
    const result = await invoke(request);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.code !== 200) process.exitCode = 1;
  } catch {
    process.stdout.write(`${JSON.stringify({ code: -200, message: localize(locale, "请求无效或无法读取本地文件", "The request is invalid or the local file could not be read") })}\n`);
    process.exitCode = 1;
  }
}

void main();
