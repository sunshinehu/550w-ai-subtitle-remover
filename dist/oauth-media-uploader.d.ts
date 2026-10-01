export type McpMediaType = "image" | "video";
export type McpRegion = "cn" | "global";
export interface PreparedMediaUpload {
    confirmProcessing?: boolean;
    filePath: string;
    mediaType: McpMediaType;
    region: McpRegion;
    uploadUrl: string;
    uploadTicket: string;
    operationId?: string;
    sync?: boolean;
    timeoutMs?: number;
}
export declare function validatePreparedUpload(input: PreparedMediaUpload): URL;
/** Metadata for prepare_media_upload; actual upload re-opens and revalidates the file. */
export declare function inspectLocalMedia(filePath: string, mediaType: McpMediaType): {
    fileSize: number;
    fileName: string;
};
/** Uploads a user-selected local file using a one-use MCP ticket; never needs an OAuth token. */
export declare function uploadPreparedMedia(input: PreparedMediaUpload): Promise<Record<string, unknown>>;
