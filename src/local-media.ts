import * as fs from "fs";
import * as path from "path";
import {
  MAX_FILE_SIZE,
  MAX_IMAGE_FILE_SIZE,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
} from "./types";

type LocalMediaKind = "video" | "image";

export function openSelectedLocalMedia(filePath: string, kind: LocalMediaKind) {
  const absolutePath = path.resolve(filePath);
  const stat = fs.lstatSync(absolutePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("filePath must point directly to a regular file, not a symbolic link");
  }

  const extension = path.extname(absolutePath).toLowerCase();
  const extensions = kind === "video" ? SUPPORTED_VIDEO_EXTENSIONS : SUPPORTED_IMAGE_EXTENSIONS;
  const maxSize = kind === "video" ? MAX_FILE_SIZE : MAX_IMAGE_FILE_SIZE;
  if (!extensions.includes(extension as never)) throw new Error(`Unsupported ${kind} file extension`);
  if (stat.size > maxSize) throw new Error(`${kind} file exceeds the size limit`);

  return {
    name: path.basename(absolutePath),
    size: stat.size,
    data: fs.createReadStream(absolutePath),
  };
}
