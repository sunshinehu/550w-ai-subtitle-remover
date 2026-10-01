#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const oauth_media_uploader_1 = require("./oauth-media-uploader");
const server = new mcp_js_1.McpServer({ name: "550w-local-media-upload", version: "3.1.0" });
const mediaType = zod_1.z.enum(["image", "video"]);
const filePath = zod_1.z.string().min(1).describe("Absolute path of a local file selected by the user.");
server.registerTool("inspect_local_media", {
    description: "Read a selected local image/video file's size for the remote 550W prepare_media_upload tool. No file is uploaded by this call.",
    inputSchema: { filePath, mediaType },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, ({ filePath, mediaType }) => {
    try {
        const result = (0, oauth_media_uploader_1.inspectLocalMedia)(filePath, mediaType);
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    catch {
        return { isError: true, content: [{ type: "text", text: "The selected local file is unavailable or invalid." }] };
    }
});
server.registerTool("upload_prepared_media", {
    description: "Upload a user-selected local image/video to 550W using the short-lived URL and ticket returned by remote prepare_media_upload. Requires the user's agreement to send the file. Does not need an OAuth token. Image uploads can create a billed task; reuse the same operationId for uncertain outcomes.",
    inputSchema: {
        filePath, mediaType,
        confirmProcessing: zod_1.z.literal(true).describe('Set true only after the user approves this file transmission and possible processing charge.'),
        region: zod_1.z.literal("global"),
        uploadUrl: zod_1.z.string().url(),
        uploadTicket: zod_1.z.string().min(1),
        operationId: zod_1.z.string().optional(),
        sync: zod_1.z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async (params) => {
    try {
        const result = await (0, oauth_media_uploader_1.uploadPreparedMedia)(params);
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    catch {
        return { isError: true, content: [{ type: "text", text: "Local upload failed or its outcome is unknown. Do not create a new operation ID; verify the task before retrying." }] };
    }
});
server.connect(new stdio_js_1.StdioServerTransport()).catch(() => process.exitCode = 1);
//# sourceMappingURL=oauth-upload-mcp-server.js.map