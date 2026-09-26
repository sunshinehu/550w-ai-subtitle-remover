---
name: 550w-ai-subtitle-watermark-removal
description: Guide users through 550W AI's remote MCP to remove hardcoded video subtitles, retrieve supported public video links without watermarks, or erase image watermarks and text. Use when the user requests one of these media workflows.
---

# 550W AI Subtitle & Watermark Removal

Use this workflow only for media the user owns or is authorized to process. This Skill provides instructions; the actual processing is performed by 550W AI's remote MCP server.

If the MCP server is not connected, ask the user to add the Streamable HTTP endpoint `https://www.550wai.cn/mcp/global`. The first connection opens the 550W website for email sign-in and consent. Do not request a user number, API key, sub-key, password, or OAuth token. If the client cannot connect to remote OAuth MCP servers, explain the limitation and point to <https://eraser.550wai.com/agent/>. Never imply that a task ran when it did not.

## Workflow

1. Identify whether the request is for hardcoded subtitles, a supported public video-sharing link, or image watermark/text removal. Before upload or paid submission, tell the user that the media or link will be sent to 550W AI and that processing uses account credits. Reading credits and task status does not consume credits.
2. Use `query_credits` to check the balance. For subtitle removal, obtain the video's actual width, height, and duration, then call `estimate_subtitle_cost`; do not invent media properties. For a local file, use `prepare_media_upload` and follow the returned upload instructions. Submit with `submit_subtitle_task` and a stable 8–128 character `idempotencyKey`. On a timeout, check the task and retry with the same inputs and key to avoid duplicate billing.
3. For a supported public video-sharing link, use `remove_video_watermark` with a stable 8–64 character `operationId`. Reuse that ID on retries. Supported sources and the final price are determined by the service response; do not promise support for an unverified platform.
4. For image watermark or text removal, use `prepare_media_upload` for each image and follow its returned upload instructions. Provide a stable 8–64 character `operationId` for the operation, then use `get_image_watermark_task` to check the result. Process multiple images separately unless the tool explicitly supports a batch.
5. For subtitle jobs, use `get_subtitle_task` or `list_subtitle_tasks` to report progress. Before `delete_subtitle_task`, confirm the exact task with the user. Deletion does not imply a credit refund. While processing, provide the task ID and a way to check it later.

If credits are insufficient, direct the user to <https://eraser.550wai.com/purchase/>; do not purchase credits on their behalf. Account connections can be reviewed at <https://eraser.550wai.com/mcp-connect/>. If a tool is unavailable, consent fails, or the client cannot upload media, describe the actual blocker without fabricating a result.
