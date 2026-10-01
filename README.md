# 550W Watermark & Text Eraser

Global media Skill, version 3.1.1. Remove text and watermarks from images, hard subtitles and visual watermarks from local MP4/MOV videos, and platform watermarks from supported TikTok and X share links. Video processing defaults to the full frame, with an optional explicit pixel rectangle. Use Share → Copy link in the platform app or website. If downloading fails after successful resolution, return the resolved video URL for browser download.

This repository contains the installable global distribution. The Skill entry point is [`SKILL.md`](SKILL.md); see [`references/agent-compatibility.md`](references/agent-compatibility.md) for host-specific setup and [`references/api-contract.md`](references/api-contract.md) for API behavior.

Historical `dify/` and `claude-plugin/` adapters are retained, not certified as updated 3.1.1 adapters by this release. The historical `skills/550w-ai-mcp-subtitle-watermark-removal` installation path remains available.

## Setup

Prefer OAuth MCP when the host supports it: connect `https://www.550wai.cn/mcp/global` in the host's MCP settings and complete website sign-in and consent. Installing the Skill alone does not register MCP. Manage authorization at [Connections](https://eraser.550wai.com/mcp-connect/).

API Key is an independent user-selected fallback. Get a user number and key from [Eraser API](https://eraser.550wai.com/api/) and configure `SUBTITLE_REMOVER_USER_NO` and `SUBTITLE_REMOVER_API_KEY` securely. Explicitly select `params.region="global"` in API Key CLI requests. Never silently switch accounts or access routes after an error.

Both routes include file upload where the host permits local file access and Node.js 18+. OAuth uses the bundled ticket-based upload helper. Cloud agents cannot read local computer paths. If file access is unavailable, use [the web app](https://eraser.550wai.com/); a share link is not a substitute for a local video. Process only authorized media.

This Skill sends selected media or public share links to the 550W Open API for processing. Review the [privacy policy](https://eraser.550wai.com/privacy/) and [terms](https://eraser.550wai.com/terms/) before use. Processing may consume credits; the Skill explains the unit before a billed batch.

## Install

Clone this repository into your agent's Skills directory under the name `ai-subtitle-remover`, or use the [ClawHub listing](https://clawhub.ai/sunshinehu/skills/550w-ai-subtitle-remover). Node.js is required. Run `npm install --omit=dev` in the Skill directory if your host does not install dependencies automatically.

The Chinese domestic edition is a separate release attachment with Chinese instructions and domestic account links. Choose the matching region; language alone never changes the API region.

## Source build

This repository includes TypeScript product runtime source and prebuilt installable files. Run `npm ci`, `npm test`, `npm run bundle`, and `npm run verify`. No private server checkout is required. The test command covers the upload helper; host acceptance remains a separate check.

License: MIT. No account credentials or private business-server source are included.
