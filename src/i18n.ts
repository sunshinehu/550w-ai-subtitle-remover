import * as fs from "fs";
import * as path from "path";

export type SupportedLocale = "zh" | "en";
export type ServiceRegion = "domestic" | "global";

type Distribution = { region: ServiceRegion; locale: string };
let distribution: Distribution | null | undefined;

function packagedDistribution(): Distribution | null {
  if (distribution !== undefined) return distribution;
  try {
    const value = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../distribution.json"), "utf8"));
    distribution = (value.region === "domestic" || value.region === "global") && typeof value.locale === "string"
      ? { region: value.region, locale: value.locale }
      : null;
  } catch {
    distribution = null;
  }
  return distribution;
}

const GLOBAL_API_LOCALES = new Set([
  "zh-Hans", "zh-Hant", "ja", "ko", "es", "es-MX", "fr", "fr-CA", "de", "pt-BR", "pt-PT", "it",
  "ru", "ar", "he", "id", "ms", "nl", "pl", "th", "tr", "uk", "vi", "hi",
]);

const GLOBAL_LOCALE_ALIASES: Record<string, string> = {
  "es-419": "es-MX",
  pt: "pt-BR",
};

export function resolveLocale(value?: unknown): SupportedLocale {
  const packaged = packagedDistribution();
  if (packaged?.region === "domestic") return "zh";
  const language = String(value || packaged?.locale || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || "").toLowerCase();
  return language.startsWith("zh") || language.includes("zh_") || language.includes("zh-") ? "zh" : "en";
}

export function localize(locale: unknown, zh: string, en: string): string {
  return resolveLocale(locale) === "zh" ? zh : en;
}

export function resolveGlobalApiLocale(value?: unknown): string {
  const raw = String(value || "").trim().replace(/_/g, "-").replace(/\..*$/, "");
  if (!raw) return "en";
  const normalized = raw.toLowerCase();
  if (["zh", "zh-cn", "zh-sg", "zh-hans"].includes(normalized)) return "zh-Hans";
  if (["zh-tw", "zh-hk", "zh-mo", "zh-hant"].includes(normalized)) return "zh-Hant";
  const exact = [...GLOBAL_API_LOCALES].find((item) => item.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const alias = Object.entries(GLOBAL_LOCALE_ALIASES).find(([key]) => key.toLowerCase() === raw.toLowerCase())?.[1];
  if (alias) return alias;
  const primary = raw.split("-")[0].toLowerCase();
  return [...GLOBAL_API_LOCALES].find((item) => item.toLowerCase() === primary) || "en";
}

export function resolveServiceRegion(value?: unknown, locale?: unknown): ServiceRegion {
  const packaged = packagedDistribution();
  if (packaged) return packaged.region;
  const configured = String(value || process.env.SUBTITLE_REMOVER_REGION || "").trim().toLowerCase();
  if (configured === "domestic" || configured === "cn" || configured === "china") return "domestic";
  if (configured === "global" || configured === "overseas" || configured === "international") return "global";
  return resolveLocale(locale) === "zh" ? "domestic" : "global";
}

export function credentialApplyUrl(locale?: unknown, region?: unknown): string {
  if (resolveServiceRegion(region, locale) === "domestic") return "https://qzm.550wai.cn/api-keys";
  const globalLocale = resolveGlobalApiLocale(locale);
  return globalLocale === "en" ? "https://eraser.550wai.com/api/" : `https://eraser.550wai.com/${globalLocale}/api/`;
}

export function creditPurchaseUrl(locale?: unknown, region?: unknown): string {
  if (resolveServiceRegion(region, locale) === "domestic") return "https://qzm.550wai.cn/purchase?tab=speed";
  const globalLocale = resolveGlobalApiLocale(locale);
  return globalLocale === "en" ? "https://eraser.550wai.com/purchase/" : `https://eraser.550wai.com/${globalLocale}/purchase/`;
}

export function globalPolicyUrl(page: "privacy" | "terms", locale?: unknown): string {
  const globalLocale = resolveGlobalApiLocale(locale);
  return globalLocale === "en" ? `https://eraser.550wai.com/${page}/` : `https://eraser.550wai.com/${globalLocale}/${page}/`;
}
