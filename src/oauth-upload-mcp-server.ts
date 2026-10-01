#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { inspectLocalMedia, uploadPreparedMedia } from "./oauth-media-uploader";

const server = new McpServer({ name: "550w-local-media-upload", version: "3.1.0" });
const mediaType = z.enum(["image", "video"]);
const filePath = z.string().min(1).describe("Absolute path of a local file selected by the user.");

server.registerTool("inspect_local_media", {
  description: "Read a selected local image/video file's size for the remote 550W prepare_media_upload tool. No file is uploaded by this call.",
  inputSchema: { filePath, mediaType },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, ({ filePath, mediaType }) => {
  try {
    const result = inspectLocalMedia(filePath, mediaType);
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  } catch {
    return { isError: true, content: [{ type: "text", text: "The selected local file is unavailable or invalid." }] };
  }
});

server.registerTool("upload_prepared_media", {
  description: "Upload a user-selected local image/video to 550W using the short-lived URL and ticket returned by remote prepare_media_upload. Requires the user's agreement to send the file. Does not need an OAuth token. Image uploads can create a billed task; reuse the same operationId for uncertain outcomes.",
  inputSchema: {
    filePath, mediaType,
    confirmProcessing: z.literal(true).describe('Set true only after the user approves this file transmission and possible processing charge.'),
    region: z.literal("global"),
    uploadUrl: z.string().url(),
    uploadTicket: z.string().min(1),
    operationId: z.string().optional(),
    sync: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async params => {
  try {
    const result = await uploadPreparedMedia(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  } catch {
    return { isError: true, content: [{ type: "text", text: "Local upload failed or its outcome is unknown. Do not create a new operation ID; verify the task before retrying." }] };
  }
});

server.connect(new StdioServerTransport()).catch(() => process.exitCode = 1);
