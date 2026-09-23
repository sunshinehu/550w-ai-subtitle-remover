---
name: ai-subtitle-remover
description: Remove hardcoded subtitles from user-selected videos, watermarks from TikTok and other supported short-video share links, or watermarks and unwanted text from selected images using the 550W Open API. Also check tasks and credits.
---

# 550W AI subtitle and watermark remover

This compact global edition uses a bundled Node.js CLI (Node 18+), defaults to English, and needs no MCP setup. Resolve the path to this Skill directory before running `node <skill-dir>/dist/550w-skill.cjs`. Send one complete JSON request on standard input, close the input stream, and parse the single JSON response. For example, `{"action":"queryCredits","params":{}}` checks the balance. Do not claim this edition registers MCP tools.

## Account and data

- If credentials are missing, direct the user to <https://eraser.550wai.com/api/> or its supported localized `/{locale}/api/` page. Obtain the User ID and API Key from the same account. Configure `SUBTITLE_REMOVER_USER_NO` and `SUBTITLE_REMOVER_API_KEY` in the host environment, or use the `configureCredentials` CLI action. Never show a complete key.
- Before the first media operation, explain that the selected file or public link is sent to the shared 550W Open API. Use only media the user selected or named. See <https://eraser.550wai.com/privacy/> and <https://eraser.550wai.com/terms/>.

## Actions

- `workflow`: remove hardcoded subtitles from a local MP4/MOV video or public direct video-file URL. The CLI derives metadata for local files. A remote file needs `ffprobe` unless actual width, height, and duration are all supplied. `removeAudio` is optional only when expressly requested; there are no erase coordinates.
- `removeVideoWatermark`: ask the user to copy the video share link inside TikTok or another supported app and provide it. A share message containing one link also works; do not download the video first.
- `removeImageWatermark`: remove a watermark or unwanted text from a selected local image; process multiple images serially.
- `taskDetail`, `imageWatermarkTaskDetail`, `taskList`, `queryCredits`: inspect task status, history, and credits. Keep a returned task ID for later lookup if processing continues or polling times out.
- `deleteTask`: delete one owned subtitle task only after explaining that cleanup is scheduled and credits are not refunded, then getting confirmation.

Use an absolute `params.filePath` for a local file. Ask one necessary question if the input or intended billed operation is unclear. Subtitle work is billed by duration and resolution; share-link watermark removal costs one credit per successful result, and image removal costs 10 credits per successful image. State the unit before a batch. A timeout does not prove submission failed: check the existing task before considering another billed submission. Reuse a subtitle `idempotencyKey` only with identical inputs; report the service's `refundStatus` without assuming a refund.

Read [API contract](references/api-contract.md) for parameter limits, statuses, billing, and errors. Read [agent compatibility](references/agent-compatibility.md) for this compact edition's runtime boundary.
