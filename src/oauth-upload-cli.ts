#!/usr/bin/env node
import { inspectLocalMedia, uploadPreparedMedia, PreparedMediaUpload } from "./oauth-media-uploader";

async function main() {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error("Input too large");
    chunks.push(chunk);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (process.argv[2] === "inspect") {
    if (!input || typeof input.filePath !== "string") throw new Error("Invalid input");
    process.stdout.write(JSON.stringify(inspectLocalMedia(input.filePath, input.mediaType)) + "\n");
  } else if (process.argv[2] === "upload") {
    if (!input || typeof input.filePath !== "string" || (input.region !== "cn" && input.region !== "global")) throw new Error("Invalid input");
    process.stdout.write(JSON.stringify(await uploadPreparedMedia(input as PreparedMediaUpload)) + "\n");
  } else throw new Error("Expected inspect or upload");
}

main().catch(() => {
  // Do not print tickets, user paths, or raw server errors.
  process.stderr.write("Local file inspection or upload failed; verify the task before retrying.\n");
  process.exitCode = 1;
});
