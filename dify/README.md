# 550W AI Media Tools for Dify

This Dify tool plugin connects to the [550W Open API](https://eraser.550wai.com/api/) for video subtitle removal and short-video watermark removal. It is an adapter for the global `ai-subtitle-remover` Skill; it does not replace the standalone Skill or its CLI.

## Configure

Get your user number and API key from the [global API page](https://eraser.550wai.com/api/), then enter both in the Dify tool provider settings. The API key is a secret field. Users of the China platform can obtain the same credentials from the [China API key page](https://qzm.550wai.cn/api-keys).

## Tools

- **Check credits** reads the shared account balance without creating a task.
- **Remove short-video watermark** takes a public share link copied inside TikTok or another supported app. A successful result costs one credit. Platform coverage depends on the service response.
- **Submit subtitle-removal task** takes a direct MP4/MOV URL and the video's actual width, height, and duration. It submits a billable full-frame task. Use a stable idempotency key for retries; without one, a repeat may create another billable task.
- **Check subtitle task** reads a submitted task's status and result.

The service supports more operations through the [standalone Skill](https://github.com/sunshinehu/550w-ai-subtitle-remover), including local media upload and image watermark removal. This Dify package intentionally exposes only the four operations listed above. Do not feed a social share page to the subtitle-task tool; use a direct video URL for that operation.

See [privacy information](PRIVACY.md) and the [service terms](https://eraser.550wai.com/terms/). Processing costs and limits are described on the API page. Dify workflows should check the returned `code` before using any result URL.
