// Links Manu shares (TikTok, YouTube, Instagram reels…). Only public oEmbed
// data (caption/title and author) is read, and only when Manu taps «Sacar la
// info». Instagram needs a developer token, so reels go through a screenshot.
const URL_RE = /https?:\/\/[^\s<>"']+/i;

export function detectLink(text) {
  const m = String(text ?? "").match(URL_RE);
  if (!m) return null;
  let url;
  try { url = new URL(m[0].replace(/[),.;!?»]+$/, "")); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const provider = /(^|\.)tiktok\.com$/.test(host) ? "tiktok"
    : /(^|\.)(youtube\.com|youtu\.be)$/.test(host) ? "youtube"
    : /(^|\.)instagram\.com$/.test(host) ? "instagram"
    : "web";
  return { url: url.href, provider, rest: String(text).replace(m[0], "").trim() };
}

export const PROVIDER_NAME = { tiktok: "TikTok", youtube: "YouTube", instagram: "Instagram", web: "la web" };

// Public oEmbed endpoints with CORS (checked 2026-09-29: TikTok «*», YouTube echoes the origin).
export function oembedUrl({ url, provider }) {
  if (provider === "tiktok") return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  if (provider === "youtube") return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  return null;
}

export function parseOembed(json) {
  const clean = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : null);
  const title = clean(json?.title, 1200);
  return title ? { title, author: clean(json?.author_name, 120) } : null;
}

export async function linkInfo(link, fetchImpl = fetch) {
  const endpoint = oembedUrl(link);
  if (!endpoint) return null;
  const res = await fetchImpl(endpoint);
  if (!res.ok) throw new Error(`${PROVIDER_NAME[link.provider]} no ha dado la información (${res.status})`);
  return parseOembed(await res.json());
}
