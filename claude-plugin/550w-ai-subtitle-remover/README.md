# 550W AI Media Tools — Agent plugin adapter

This directory contains only plugin wrappers for the global `ai-subtitle-remover` Skill. The build script copies the tested compact CLI, `SKILL.md`, and references into `skills/ai-subtitle-remover/`; it does not change the existing domestic or global Skill ZIP names or version.

Claude Code can run the bundled Node.js CLI locally. A browser-only agent cannot run this local CLI; do not advertise browser/Cowork execution until the separately developed remote MCP integration is available and tested.

The OpenAI package is a Skills-only candidate. Do not submit it as a working ChatGPT media tool until its actual sandbox execution, credential setup, and review tests pass. Once the production remote MCP is ready, prefer a combined Skill + remote MCP submission.

Users obtain their own User ID and API Key at <https://eraser.550wai.com/api/>. Selected media or public links are sent to the 550W Open API. The package contains no credentials.
