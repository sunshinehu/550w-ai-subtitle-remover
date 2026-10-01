import { execFile } from "child_process";
import { promises as dns } from "dns";
import { isIP } from "net";

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

function isBlockedAddress(address: string): boolean {
  const value = address.toLowerCase();
  if (value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("ff") || /^fe[89ab]/.test(value)) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped || (isIP(value) === 4 ? value : null);
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19 || b === 51))
    || (a === 203 && b === 0);
}

export function assertSafeVideoUrlSyntax(videoUrl: string): URL {
  const parsed = new URL(videoUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash || videoUrl.includes('\\')) {
    throw new Error("Only unauthenticated public HTTP(S) video URLs are allowed");
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Local and private video URLs are not allowed");
  }
  if (isIP(hostname) && isBlockedAddress(hostname)) {
    throw new Error("The video URL must resolve only to public network addresses");
  }
  return parsed;
}

export async function assertPublicVideoUrl(videoUrl: string): Promise<void> {
  const parsed = assertSafeVideoUrlSyntax(videoUrl);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("The video URL must resolve only to public network addresses");
  }
}

/**
 * 使用本机 ffprobe 获取远程视频的真实元信息。不得伪造默认宽高和时长：这些字段既参与
 * 服务端快速拒绝，也可能在远程媒体暂时无法探测时成为兜底依据。
 */
export async function probeVideoUrl(
  videoUrl: string
): Promise<VideoMetadata> {
  await assertPublicVideoUrl(videoUrl);
  const ffprobe = process.env.FFPROBE_PATH?.trim() || "ffprobe";
  const args = [
    "-v", "error",
    "-protocol_whitelist", "http,https,tcp,tls",
    // A redirect target has not passed the public-address check above.
    "-max_redirects", "0",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    videoUrl,
  ];

  return new Promise((resolve, reject) => {
    execFile(ffprobe, args, { timeout: 20_000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(new Error(`无法预检远程视频，请确认链接可访问且已安装 ffprobe：${error.message}`));
        return;
      }
      try {
        const payload = JSON.parse(stdout);
        const stream = payload?.streams?.[0];
        const width = Number(stream?.width);
        const height = Number(stream?.height);
        const duration = Math.ceil(Number(payload?.format?.duration));
        if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(duration)
            || width <= 0 || height <= 0 || duration <= 0) {
          throw new Error("未读取到有效的视频宽高或时长");
        }
        resolve({ width, height, duration });
      } catch (parseError: any) {
        reject(new Error(`远程视频预检结果无效：${parseError?.message || "未知错误"}`));
      }
    });
  });
}
