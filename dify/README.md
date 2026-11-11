# 550W Watermark & Text Eraser for Dify

Remove image watermarks, erase subtitles or visual watermarks from uploaded local videos, and resolve platform watermarks from supported video share links. This native Dify tool provider connects to the [550W Open API](https://eraser.550wai.com/api/) and accepts Dify-selected files; it does not require the standalone Skill or its CLI.

Source: https://github.com/sunshinehu/550w-ai-subtitle-remover · Support: support@550wai.com

## Configure

Select **Account region** in the provider credentials, then enter your own user number and API key. The API key is a secret field. Region is independent of the Dify interface language.

| Account region | API key management | Purchase credits |
|---|---|---|
| China (`cn`) | https://qzm.550wai.cn/api-keys | https://qzm.550wai.cn/purchase?tab=speed |
| Global (`global`) | https://eraser.550wai.com/api/ | https://eraser.550wai.com/purchase/ |

Both use the existing shared 550W backend. No new endpoint, credentials, permission or purchase is required to upgrade an existing Global connection. Legacy API Key connections without a region retain Global behavior.

This provider supports OAuth and API Key authentication in the same plugin. Existing user-number/API-key credentials remain valid. Account and purchase links stay regional regardless of the Dify interface language.

### OAuth setup

Administrators configure one unique random `oauth_state_secret` of at least 32 characters in Dify's OAuth Client settings; use the same value across workers of that installation and never publish it. It encrypts short-lived PKCE state, is not a 550W API key or client secret, and is never returned as a user credential. Public OAuth clients are dynamically registered against the existing 550W OAuth service. Dify's actual HTTPS callback is used unchanged; no guessed or shared callback URL is needed. Administrators select **Account region** in the OAuth Client settings before starting a new authorization. Users then select OAuth and authorize their own account on the corresponding regional consent page. Dify exposes this choice in administrator client settings, not as a user-specific region picker. To create a connection for the other region, the administrator changes this setting before starting that authorization, keeping the state encryption secret unchanged. The encrypted authorization state captures the selected region; subsequent settings changes cannot switch an in-flight authorization, a saved connection, token refresh or task lookup to the other region. Saved CN and Global credentials are routed independently; actual multi-credential selection depends on the Dify host. Do not change a saved token's region by editing its text. Dify stores tokens and invokes token refresh automatically. Reconnect after revocation or an expired refresh token; do not fall back silently to another account's API Key.

OAuth operations use the shared 550W OAuth + HTTP media API with S256 PKCE, not Bearer authentication against legacy `/open` endpoints. Dify's own browser/session callback-context checks remain required; encrypted state supplements them rather than replacing them. Older or customized Dify versions must retain these checks. The plugin does not promise Cloud-wide preconfigured OAuth: each workspace administrator may need to configure the OAuth Client settings until Dify offers a system client configuration.

## Tools

- **Estimate processing credits** requests a read-only OAuth quote for image, video or share processing. Use real video width, height and rounded-up seconds. Missing metadata is returned as needs_input, never a zero-cost quote. Check service availability, submission permission and canSubmit, then obtain user fee confirmation before submitting. API Key workflows get an explicit regional API pricing-page fallback without changing accounts.

- **Remove image watermark** accepts a user-selected PNG, JPEG or WebP image (up to 50 MB), uploads it to 550W and returns the task/result. **Check image task** follows a pending image task.
- **Submit local video** accepts a user-selected MP4/MOV video (up to the 550W service's 1 GiB limit). The adapter streams the Dify file URL to a bounded temporary file before forwarding it, rather than loading the video into plugin memory. Dify's own configured upload limit and the plugin host's free temporary disk space may be lower. The plugin uses the returned video metadata and submits a full-frame erasure task; all four user-supplied rectangle coordinates can narrow the area. A stable idempotency key is required.
- **Check credits** reads the shared account balance without creating a task.
- **Remove short-video watermark** takes a public share link copied inside TikTok or another supported app. A successful result costs one credit. Platform coverage depends on the service response.
- **Submit subtitle-removal task** takes a direct MP4/MOV URL and the video's actual width, height, and duration. It submits a billable full-frame task. Use a stable idempotency key for retries; without one, a repeat may create another billable task.
- **Check subtitle task** reads a submitted task's status and result.
- **Check OAuth operation** recovers an OAuth submission using its operation ID, including pending share-link results. API Key workflows continue using task lookup. OAuth image/video submissions return an asynchronous receipt, not necessarily the completed media. Query its task ID with the corresponding task lookup tool; for shares, query the operation ID. Keep the same operation ID when recovering an uncertain submission instead of creating another paid task.

Do not feed a social share page to the subtitle-task tool; use a direct video URL for that operation. Dify must provide an absolute HTTP(S) file URL reachable by its plugin runtime (`FILES_URL`/`INTERNAL_FILES_URL` on self-hosted Dify). Test a file larger than 50 MB and monitor temporary-disk use before claiming larger-video support on a particular Dify installation. An upload response or a submitted task is not proof that processing has completed; check the returned status before presenting a result.

See [privacy information](PRIVACY.md) and the [service terms](https://eraser.550wai.com/terms/). Processing costs and limits are described on the API page. Dify workflows should check the returned `code` before using any result URL.

OAuth submission transport failures return `code=-201`, `status=unknown`, the original
`operationId` (including an automatically generated ID), and
`nextAction=CHECK_ORIGINAL_OPERATION`. This is not an accepted or failed task receipt.
Use **Check OAuth operation** on the same regional account; do not generate a new ID,
automatically retry, or treat a not-found response as permission to submit again.
API Key workflows retain their existing task lookup behavior.

## Consolidation and migration from the China listing

Version 3.2.0 consolidates regional support under the existing `sunshinehu/ai-subtitle-remover` identity. Native translated labels follow Dify's UI language; account region never follows language. The nine existing tool identifiers and parameters remain unchanged for existing Global workflows.

The old `sunshinehu/ai-subtitle-remover-cn` listing has a different provider identity and will not be silently replaced. Keep its existing workflows until you explicitly install the consolidated plugin, create a China connection, replace those workflow nodes, and verify read-only balance/task lookup on the same account. OAuth is reconnected through Dify; do not copy tokens between provider identities. Keep original operation/task IDs when recovering work. No paid submission or automatic account fallback is required for migration. Listing deprecation is coordinated with the Marketplace maintainers after review; this package does not delete the old listing.

China share-link support includes Douyin, Kuaishou, Bilibili and Weibo; Global includes TikTok and X. Actual availability and costs are determined by the service response. This release does not claim newly completed Dify Cloud/CE OAuth or paid-media host acceptance; schema and offline verification are documented separately for review.

## Account and credits

Use Share in TikTok, X or another supported app or platform website to copy the video/content share link. If downloading a resolved video fails or times out, return the resolved video URL for browser download, not the original platform share link.

[Manage API keys](https://eraser.550wai.com/api/) · [Purchase credits](https://eraser.550wai.com/purchase/)
