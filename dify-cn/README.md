# 550W AI Subtitle & Watermark Remover for Dify (China)

Remove image watermarks, erase subtitles or visual watermarks from uploaded local videos, and resolve platform watermarks from supported video share links. This native Dify tool provider connects to the [550W Open API](https://qzm.550wai.cn/api-keys) and accepts Dify-selected files; it does not require the standalone Skill or its CLI.

Source: https://github.com/sunshinehu/550w-ai-subtitle-remover · Support: support@550wai.com

## Configure

Get your user number and API key from the [China API key management page](https://qzm.550wai.cn/api-keys), then enter both in the Dify tool provider settings. The API key is a secret field.

This provider supports OAuth and API Key authentication in the same plugin. Existing user-number/API-key credentials remain valid. Account and purchase links stay regional regardless of the Dify interface language.

### OAuth setup

Administrators configure one unique random `oauth_state_secret` of at least 32 characters in Dify's OAuth Client settings; use the same value across workers of that installation and never publish it. It encrypts short-lived PKCE state, is not a 550W API key or client secret, and is never returned as a user credential. Public OAuth clients are dynamically registered against the existing 550W OAuth service. Dify's actual HTTPS callback is used unchanged; no guessed or shared callback URL is needed. Users then select OAuth and authorize their own account on the corresponding regional consent page. Dify stores tokens and invokes token refresh automatically. Reconnect after revocation or an expired refresh token; do not fall back silently to another account's API Key.

OAuth operations use the shared 550W OAuth + HTTP media API with S256 PKCE, not Bearer authentication against legacy `/open` endpoints. Dify's own browser/session callback-context checks remain required; encrypted state supplements them rather than replacing them. Older or customized Dify versions must retain these checks. The plugin does not promise Cloud-wide preconfigured OAuth: each workspace administrator may need to configure the OAuth Client settings until Dify offers a system client configuration.

## Tools

- **Remove image watermark** accepts a user-selected PNG, JPEG or WebP image (up to 50 MB), uploads it to 550W and returns the task/result. **Check image task** follows a pending image task.
- **Submit local video** accepts a user-selected MP4/MOV video (up to the 550W service's 1 GiB limit). The adapter streams the Dify file URL to a bounded temporary file before forwarding it, rather than loading the video into plugin memory. Dify's own configured upload limit and the plugin host's free temporary disk space may be lower. The plugin uses the returned video metadata and submits a full-frame erasure task; all four user-supplied rectangle coordinates can narrow the area. A stable idempotency key is required.
- **Check credits** reads the shared account balance without creating a task.
- **Remove short-video watermark** takes a public share link copied inside Douyin, Kuaishou, Bilibili, Weibo or another supported app. A successful result costs one credit. Platform coverage depends on the service response.
- **Submit subtitle-removal task** takes a direct MP4/MOV URL and the video's actual width, height, and duration. It submits a billable full-frame task. Use a stable idempotency key for retries; without one, a repeat may create another billable task.
- **Check subtitle task** reads a submitted task's status and result.
- **Check OAuth operation** recovers an OAuth submission using its operation ID, including pending share-link results. API Key workflows continue using task lookup. OAuth image/video submissions return an asynchronous receipt, not necessarily the completed media. Query its task ID with the corresponding task lookup tool; for shares, query the operation ID. Keep the same operation ID when recovering an uncertain submission instead of creating another paid task.

Do not feed a social share page to the subtitle-task tool; use a direct video URL for that operation. Dify must provide an absolute HTTP(S) file URL reachable by its plugin runtime (`FILES_URL`/`INTERNAL_FILES_URL` on self-hosted Dify). Test a file larger than 50 MB and monitor temporary-disk use before claiming larger-video support on a particular Dify installation. An upload response or a submitted task is not proof that processing has completed; check the returned status before presenting a result.

See [privacy information](PRIVACY.md) and the [service terms](https://eraser.550wai.com/terms/). Processing costs and limits are described on the API page. Dify workflows should check the returned `code` before using any result URL.

## China account and credits

[Chinese instructions](README.zh_Hans.md).

[Manage API keys](https://qzm.550wai.cn/api-keys) · [Purchase credits](https://qzm.550wai.cn/purchase?tab=speed)
