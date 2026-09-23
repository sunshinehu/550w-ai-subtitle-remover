# 550W AI Subtitle & Watermark Remover

Global edition of the 550W AI media Skill, version 2.0.0. It removes hardcoded subtitles from videos, watermarks from short-video share links (including TikTok where supported), and watermarks or unwanted text from images. It can also check task status, history, and credits.

This repository contains the installable global distribution. The Skill entry point is [`SKILL.md`](SKILL.md); see [`references/agent-compatibility.md`](references/agent-compatibility.md) for host-specific setup and [`references/api-contract.md`](references/api-contract.md) for API behavior.

## Setup

Get a User ID and API Key for the same account from [Eraser API](https://eraser.550wai.com/api/). Set `SUBTITLE_REMOVER_USER_NO` and `SUBTITLE_REMOVER_API_KEY` in your agent's secure connector or environment settings. The global package defaults to English. No region selector is required.

This Skill sends selected media or public share links to the 550W Open API for processing. Review the [privacy policy](https://eraser.550wai.com/privacy/) and [terms](https://eraser.550wai.com/terms/) before use. Processing may consume credits; the Skill explains the unit before a billed batch.

## Install

Clone this repository into your agent's Skills directory under the name `ai-subtitle-remover`, or use the [ClawHub listing](https://clawhub.ai/sunshinehu/skills/550w-ai-subtitle-remover). Node.js is required. Run `npm install --omit=dev` in the Skill directory if your host does not install dependencies automatically.

The Chinese domestic edition is distributed separately through SkillHub.cn. Do not use domestic account credentials with this global edition.
