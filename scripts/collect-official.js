#!/usr/bin/env node
"use strict";

// Find each place's own homepage, Naver/Daum blog or cafe, or Instagram.
// A page is accepted only when the business name and a specific address or phone
// are both on that page. Aggregators, map listings, and review posts are skipped.
// Images are downloaded here and stored as 480x270 webp. The build does not fetch them.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const POSTER_DIR = path.join(ROOT, "posters", "places");
const SOURCES_PATH = path.join(POSTER_DIR, "SOURCES.json");
const UNMATCHED_PATH = path.join(ROOT, "data", "unmatched-official-ids.txt");
const NOTES_PATH = path.join(ROOT, "data", "official-match-notes.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const BLOCKED_HOSTS = [
  "gocamping.or.kr",
  "visitkorea.or.kr",
  "map.naver.com",
  "place.naver.com",
  "map.kakao.com",
  "place.map.kakao.com",
  "m.map.kakao.com",
  "airbnb.com",
  "airbnb.co.kr",
  "booking.com",
  "agoda.com",
  "hotels.com",
  "yanolja.com",
  "goodchoice.kr",
  "yeogi.com",
  "dailyhotel.com",
  "wehome.me",
  "mangoplate.com",
  "siksinhot.com",
  "diningcode.com",
  "catchtable.co.kr",
  "tripadvisor.com",
  "tripadvisor.co.kr",
  "wikipedia.org",
  "namu.wiki",
  "google.com",
  "google.co.kr",
  "youtube.com",
  "youtu.be",
  "balzaguk.com",
  "polomap.com",
  "mamama.kr",
  "ddnayo.com",
  "pensionpang.com",
  "stayfolio.com",
  "coolstay.co.kr",
  "koreacharts.com",
  "infocs.co.kr",
  "booking.naver.com",
  "foodsafetykorea.go.kr",
  "localdata.go.kr",
  "data.go.kr",
  "tabling.co.kr",
  "poing.co.kr",
  "myrealtrip.com",
  "creatrip.com",
  "waug.com",
  "tripbtoz.com",
  "expedia.co.kr",
  "hotelscombined.com",
  "ban-life.com",
  "terms.naver.com",
  "korearank.com",
  "store114.net",
  "114-service.co.kr",
  "114.co.kr",
  "114.it.kr",
  "coloazee.com",
  "codethetrack.com",
  "doopedia.co.kr",
  "100.daum.net",
  "yakfact.kr",
  "daangn.com",
  "daengnyango.com",
  "open-maru.com",
  "purpleo.kr",
  "purpleo.co.kr",
  "maruvet.com",
  "hospitalk.net",
  "vet24.kr",
  "kimgoon.kr",
  "breadly.kr",
  "open-web-platform.com",
  "grandculture.net",
  "bizw.kr",
  "ktourmap.com",
  "hanlyu-map.com",
  "wizztour.com",
  "mynuripet.com",
  "triple.guide",
  "yeogilife.com",
  "talk.naver.com",
  "platform-info.com",
  "visitseoul.net",
  "roadtriplab.com",
  "benefitcenter.kr",
  "meongnyangroad.com",
  "petbi.kr",
  "petnolja.co.kr",
  "datacafe.kr",
  "animalcure.co.kr",
  "d9suk.com",
];

function loadPlaces() {
  const dir = path.join(ROOT, "data");
  const places = [];
  for (const name of fs.readdirSync(dir).filter((item) => /^places_part\d+\.json$/.test(item)).sort()) {
    let text = fs.readFileSync(path.join(dir, name), "utf8").trim();
    if (!text.startsWith("[") && !text.startsWith("{")) text = Buffer.from(text, "base64").toString("utf8");
    const parsed = JSON.parse(text);
    places.push(...(Array.isArray(parsed) ? parsed : parsed.places));
  }
  return places;
}

function compact(value) {
  return String(value || "").toLowerCase().replace(/[^0-9a-z\uac00-\ud7a3]/g, "");
}

function cleanUrl(raw) {
  const match = String(raw || "").match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return "";
  try {
    const url = new URL(match[0].replace(/[),.;]+$/g, ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    return url.href;
  } catch (_) {
    return "";
  }
}

function hostOf(raw) {
  try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); }
  catch (_) { return ""; }
}

function blockedHost(raw) {
  const host = hostOf(raw);
  if (!host) return true;
  return BLOCKED_HOSTS.some((item) => host === item || host.endsWith("." + item));
}

function copiesCatalogId(place, raw) {
  const id = String(place && place.id || "");
  const href = String(raw || "");
  if (/^(tour|gocamp)-\d{5,}$/.test(id) && href.includes(id.split("-").pop())) return true;
  const numeric = id.match(/(\d{10,})/);
  return Boolean(numeric && href.includes(numeric[1]));
}

function presenceKey(raw) {
  const host = hostOf(raw);
  if (host.endsWith("blog.naver.com")) return "blog:" + naverBlogId(raw);
  if (host.endsWith("cafe.naver.com")) return "cafe:" + naverCafeId(raw);
  if (host.endsWith("instagram.com")) {
    try {
      const user = new URL(raw).pathname.split("/").filter(Boolean)[0] || "";
      return "ig:" + user;
    } catch (_) { return host; }
  }
  return host;
}

function directoryPath(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host.endsWith(".go.kr") || host.endsWith(".or.kr") || host.endsWith("blog.naver.com") || host.endsWith("cafe.naver.com") || host.endsWith("instagram.com") || host.endsWith("cafe.daum.net") || host.endsWith("modoo.at")) return false;
    const pathAndQuery = url.pathname + url.search;
    if (/\/places\/|\/place\/|place-detail|contents\.html|\/bizes\/|\/restaurants\/|view\.php|\/attractions\/|\/camp\/info\/read|\/store\/view|\/shop\/view|tour_detail|detail\.(?:php|asp)|\/detail\/\d|\/map\/detail\//i.test(pathAndQuery)) return true;
    if (/\/animal-hospital\/|\/hospital_detail\/|\/hospitals\/|\/local-profile\/|\/bakeries\/|\/dogdaycare\/view\/|spotDetails|\/toc\/GC|\/playzone\/|\/datas\/|\/hotels\/[0-9a-f-]{8,}/i.test(pathAndQuery)) return true;
    if (/\/hospital\/(?:h\/)?\d+/i.test(url.pathname)) return true;
    if (/\/(?:business|article|brand|food)\/\d+/i.test(url.pathname)) return true;
    if (/\/biz\/[A-Za-z]{2}\d{6,}/i.test(url.pathname)) return true;
    if (/\/travel\/(?:\d+|food\/)/i.test(url.pathname)) return true;
    if (/\/view\/\d+/i.test(url.pathname)) return true;
    if (/[?&](?:id|idx|no|seq|contentId)=\d+/i.test(url.search) && /view|store|detail|place|info|shop|read|spot/i.test(url.pathname)) return true;
    return false;
  } catch (_) {
    return true;
  }
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function addressParts(addr) {
  const text = String(addr || "");
  const road = (text.match(/([가-힣A-Za-z0-9]{2,}(?:대로|로|길))/) || [])[1] || "";
  const numbers = [...text.matchAll(/\d+(?:-\d+)?/g)].map((item) => item[0]);
  const streetNo = numbers.length ? numbers[numbers.length - 1] : "";
  const locality = (text.match(/([가-힣]{2,}(?:동|읍|면|리|가))/) || [])[1] || "";
  return { road, streetNo, locality };
}

function nameHit(name, text) {
  const page = compact(text);
  const full = compact(name);
  if (full.length >= 2 && page.includes(full)) return { ok: true, how: "full" };
  const base = compact(String(name).replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " "));
  if (base.length >= 2 && page.includes(base)) return { ok: true, how: "base" };
  const tokens = String(name).replace(/\([^)]*\)/g, " ").split(/[\s/·,]+/).map(compact).filter((token) => token.length >= 4);
  if (tokens.length && tokens.every((token) => page.includes(token))) return { ok: true, how: "tokens" };
  if (tokens[0] && page.includes(tokens[0])) return { ok: true, how: "brand", risk: "partial-name" };
  return { ok: false, how: "" };
}

function addressHit(place, text) {
  const digits = phoneDigits(text);
  const phone = phoneDigits(place.tel);
  if (phone.length >= 9 && digits.includes(phone)) return { ok: true, how: "phone" };
  const parts = addressParts(place.addr);
  const page = compact(text);
  const roadOk = parts.road && page.includes(compact(parts.road));
  const numberOk = parts.streetNo && (text.includes(parts.streetNo) || digits.includes(parts.streetNo.replace("-", "")));
  const localOk = parts.locality && page.includes(compact(parts.locality));
  if (roadOk && numberOk) return { ok: true, how: "road+number" };
  if (!parts.road && localOk && numberOk) return { ok: true, how: "locality+number" };
  return { ok: false, how: "" };
}

function visibleText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ");
}

function pageTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function reviewTitle(title) {
  return /후기|리뷰|내돈내산|방문기|솔직/.test(String(title || ""));
}

function siteLabel(raw) {
  const host = hostOf(raw);
  if (host.endsWith("blog.naver.com")) return "네이버 블로그";
  if (host.endsWith("cafe.naver.com")) return "네이버 카페";
  if (host === "cafe.daum.net" || host.endsWith(".cafe.daum.net")) return "다음 카페";
  if (host.endsWith("instagram.com")) return "Instagram";
  if (host.endsWith("facebook.com")) return "Facebook";
  if (host.endsWith("modoo.at")) return host;
  return host;
}

function canonicalPage(raw) {
  const url = new URL(raw);
  url.hash = "";
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "igsh", "fbclid", "gclid"]) url.searchParams.delete(key);
  const host = url.hostname.replace(/^www\./, "");
  if (host.endsWith("blog.naver.com")) {
    const id = naverBlogId(url.href);
    if (id) return "https://blog.naver.com/" + id;
  }
  if (host.endsWith("cafe.naver.com")) {
    const id = naverCafeId(url.href);
    if (id) return "https://cafe.naver.com/" + id;
  }
  if (host.endsWith("instagram.com")) {
    const user = url.pathname.split("/").filter(Boolean)[0] || "";
    if (user && !["p", "reel", "reels", "stories", "explore", "accounts"].includes(user)) return "https://www.instagram.com/" + user + "/";
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) url.pathname = url.pathname.replace(/\/+$/, "/");
  return url.href;
}

function naverBlogId(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (!host.endsWith("blog.naver.com")) return "";
    const fromQuery = url.searchParams.get("blogId");
    if (fromQuery) return fromQuery;
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) return "";
    if (parts[0] === "PostView.naver" || parts[0] === "PostList.naver") return url.searchParams.get("blogId") || "";
    return parts[0];
  } catch (_) {
    return "";
  }
}

function naverCafeId(raw) {
  try {
    const url = new URL(raw);
    if (!url.hostname.replace(/^www\./, "").endsWith("cafe.naver.com")) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] && !parts[0].includes(".") ? parts[0] : "";
  } catch (_) {
    return "";
  }
}

function absoluteUrl(value, base) {
  try { return new URL(value, base).href; }
  catch (_) { return ""; }
}

function imageCandidates(html, pageUrl) {
  const found = [];
  const push = (value) => {
    const href = absoluteUrl(String(value || "").replace(/&amp;/g, "&"), pageUrl);
    if (!href || !/^https?:\/\//i.test(href)) return;
    if (/sprite|favicon|emoji|blank\.|pixel|1x1|spacer|logo_naver|icon_/i.test(href)) return;
    found.push(href);
  };
  const meta = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  for (const tag of meta) {
    if (!/og:image|twitter:image/i.test(tag)) continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i);
    if (content) push(content[1]);
  }
  for (const match of String(html || "").matchAll(/https?:\/\/static\.wixstatic\.com\/media\/[^"'\\\s>]+/g)) push(match[0]);
  for (const match of String(html || "").matchAll(/https?:\/\/[^"'\\\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s>]*)?/gi)) push(match[0]);
  const unique = [];
  const seen = new Set();
  for (const href of found) {
    if (seen.has(href)) continue;
    seen.add(href);
    unique.push(href);
  }
  unique.sort((a, b) => scoreImage(b) - scoreImage(a));
  return unique.slice(0, 8);
}

function scoreImage(href) {
  let score = 0;
  const width = href.match(/[/_]w_(\d{2,4})/i) || href.match(/[?&]type=w(\d{2,4})/i);
  const frame = href.match(/type=f(\d{2,4})/i);
  const pixels = width ? Number(width[1]) : frame ? Number(frame[1]) : 0;
  if (pixels) score += Math.min(pixels, 1600) / 80;
  if (pixels && pixels < 320) score -= 8;
  if (/\.(?:jpe?g|webp)(?:$|\?)/i.test(href)) score += 3;
  if (/profile|logo|icon|avatar|favicon/i.test(href)) score -= 6;
  if (/blogpfthumb/i.test(href)) score -= 4;
  if (/\.gif(?:$|\?)/i.test(href)) score -= 2;
  return score;
}

function upgradeImage(href) {
  if (/blogpfthumb|postfiles|blogfiles|blogthumb/i.test(href)) {
    if (/[?&]type=/.test(href)) return href.replace(/([?&]type=)[^&]+/i, "$1w800");
    return href + (href.includes("?") ? "&" : "?") + "type=w800";
  }
  return href;
}

function decodeBuffer(buffer, contentType) {
  const header = String(contentType || "");
  let charset = (header.match(/charset=([^;]+)/i) || [])[1] || "";
  if (!charset) {
    const sniff = buffer.slice(0, 2500).toString("latin1").match(/charset=["']?([\w:-]+)/i);
    charset = sniff ? sniff[1] : "utf-8";
  }
  charset = charset.trim().toLowerCase().replace(/['"]/g, "");
  if (charset.includes("euc-kr") || charset.includes("ksc5601") || charset.includes("cp949") || charset.includes("ms949")) {
    try { return new TextDecoder("euc-kr").decode(buffer); }
    catch (_) { return buffer.toString("utf8"); }
  }
  return buffer.toString("utf8");
}

async function fetchBuffer(url, { referer, bytes = 1500000, timeout = 12000 } = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
    headers: {
      "user-agent": UA,
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.4",
      accept: "*/*",
      ...(referer ? { referer } : {}),
    },
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const reader = response.body && response.body.getReader ? response.body.getReader() : null;
  const chunks = [];
  let total = 0;
  if (reader) {
    while (total < bytes) {
      const step = await reader.read();
      if (step.done) break;
      chunks.push(Buffer.from(step.value));
      total += step.value.length;
    }
    try { reader.cancel(); } catch (_) { /* already closed */ }
  } else {
    const all = Buffer.from(await response.arrayBuffer());
    chunks.push(all.subarray(0, bytes));
  }
  return { url: response.url || url, status: response.status, contentType: response.headers.get("content-type") || "", buffer: Buffer.concat(chunks) };
}

async function fetchText(url) {
  const result = await fetchBuffer(url, { bytes: 1200000, timeout: 14000 });
  const finalHost = hostOf(result.url);
  if (/accounts\/login|captcha|nidlogin/i.test(result.url)) throw new Error("로그인 벽");
  return {
    url: result.url,
    html: decodeBuffer(result.buffer, result.contentType),
    contentType: result.contentType,
  };
}

async function fetchBlogContext(raw) {
  const blogId = naverBlogId(raw);
  if (!blogId) return null;
  let channel = "";
  let postUrl = "";
  try {
    const rss = await fetchText("https://rss.blog.naver.com/" + blogId + ".xml");
    const channelMatch = rss.html.match(/<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    channel = channelMatch ? channelMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    const item = rss.html.match(/<item>[\s\S]*?<link>(?:<!\[CDATA\[)?(https?:\/\/blog\.naver\.com\/[^\]<\s]+)/i);
    postUrl = item ? item[1].replace(/\]\]>.*/, "").trim() : "";
  } catch (_) { /* RSS is optional */ }
  const mobileHome = "https://m.blog.naver.com/" + blogId;
  const pages = [mobileHome];
  if (postUrl) {
    const logNo = (postUrl.match(/\/(\d{6,})/) || [])[1];
    if (logNo) pages.push("https://m.blog.naver.com/" + blogId + "/" + logNo);
  }
  let html = "";
  let title = channel;
  for (const page of pages) {
    try {
      const doc = await fetchText(page);
      html += "\n" + doc.html;
      title = title || pageTitle(doc.html);
    } catch (_) { /* try the next page */ }
  }
  if (!html) return null;
  return { html, title: channel || title, channel, blogId };
}

function decide(place, doc, { fromSeed, channelTitle }) {
  const title = channelTitle || pageTitle(doc.html) || doc.title || "";
  const text = title + "\n" + visibleText(doc.html);
  const finalUrl = doc.finalUrl || doc.url;
  if (!finalUrl || blockedHost(finalUrl)) return { ok: false, reason: "차단된 사이트" };
  if (directoryPath(finalUrl) || copiesCatalogId(place, finalUrl)) return { ok: false, reason: "디렉터리·복제 페이지" };
  if (/instagram\.com\/accounts\/login/i.test(finalUrl)) return { ok: false, reason: "인스타그램 로그인" };
  const named = nameHit(place.name, fromSeed ? text : title + "\n" + (channelTitle || ""));
  const namedBody = named.ok ? named : nameHit(place.name, text);
  const name = fromSeed ? namedBody : named.ok ? named : { ok: false };
  if (!fromSeed && !named.ok) return { ok: false, reason: "제목에 상호 없음" };
  if (!name.ok) return { ok: false, reason: "상호 불일치" };
  const address = addressHit(place, text);
  if (!address.ok) return { ok: false, reason: "주소·전화 불일치" };
  const blogId = naverBlogId(finalUrl);
  if (blogId) {
    const channel = channelTitle || "";
    const channelOk = channel && nameHit(place.name, channel).ok;
    const postedOnSomeoneElse = /\/\d{6,}(?:$|\?)/.test(String(doc.originalUrl || doc.url || "")) && !channelOk;
    if (postedOnSomeoneElse) return { ok: false, reason: "다른 블로그의 글" };
    if (!channelOk && !(fromSeed && name.ok)) return { ok: false, reason: "블로그 이름이 상호와 다름" };
    if (!fromSeed && reviewTitle(pageTitle(doc.html)) && !reviewTitle(channel)) return { ok: false, reason: "후기 글" };
  } else if (reviewTitle(title) && !fromSeed) {
    return { ok: false, reason: "후기 페이지" };
  }
  const risks = [];
  if (name.risk === "partial-name" && !fromSeed && /blog\.naver|cafe\.naver|instagram\.com|tistory\.com|cafe\.daum/.test(hostOf(finalUrl))) {
    return { ok: false, reason: "상호 일부만 일치" };
  }
  if (name.risk) risks.push(name.risk);
  if (hostOf(finalUrl).endsWith(".go.kr") || hostOf(finalUrl).endsWith(".or.kr")) risks.push("public-body");
  if (/instagram\.com|facebook\.com|modoo\.at|creatorlink\.net|campingt\.me/.test(hostOf(finalUrl))) risks.push("platform");
  if (blogId || naverCafeId(finalUrl) || hostOf(finalUrl).includes("cafe.daum.net")) risks.push("blog");
  if (compact(place.name).length <= 2) risks.push("short-name");
  return {
    ok: true,
    url: canonicalPage(finalUrl),
    how: name.how + "+" + address.how,
    risk: risks.join(","),
    html: doc.html,
  };
}

function probeDimensions(file) {
  try {
    const output = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file], { encoding: "utf8" }).trim();
    const [width, height] = output.split("x").map(Number);
    if (!width || !height) return null;
    return { width, height };
  } catch (_) {
    return null;
  }
}

async function savePoster(placeId, imageUrl, referer) {
  const upgraded = upgradeImage(imageUrl);
  const downloaded = await fetchBuffer(upgraded, { referer, bytes: 8000000, timeout: 20000 });
  const type = downloaded.contentType;
  const head = downloaded.buffer.slice(0, 16).toString("hex");
  const looksImage = /image\//i.test(type) || head.startsWith("ffd8") || head.startsWith("89504e47") || head.startsWith("47494638") || downloaded.buffer.slice(0, 12).toString("ascii").includes("RIFF");
  if (!looksImage) throw new Error("이미지 아님");
  const tmp = path.join(POSTER_DIR, "." + placeId + ".src");
  fs.writeFileSync(tmp, downloaded.buffer);
  const size = probeDimensions(tmp);
  if (size && (size.width < 180 || size.height < 180)) {
    fs.rmSync(tmp, { force: true });
    throw new Error("이미지 너무 작음 " + size.width + "x" + size.height);
  }
  const destination = path.join(POSTER_DIR, placeId + ".webp");
  execFileSync("ffmpeg", [
    "-y", "-i", tmp,
    "-vf", "scale=480:270:force_original_aspect_ratio=increase,crop=480:270",
    "-frames:v", "1",
    "-c:v", "libwebp",
    "-quality", "72",
    destination,
  ], { stdio: "ignore" });
  fs.rmSync(tmp, { force: true });
  const posterSize = probeDimensions(destination);
  if (!posterSize || posterSize.width !== 480 || posterSize.height !== 270) throw new Error("webp 크기");
  return { file: destination, source: downloaded.url || upgraded };
}

async function attachImage(place, decision) {
  const candidates = imageCandidates(decision.html, decision.url);
  let lastError = "";
  for (const candidate of candidates) {
    try {
      const saved = await savePoster(place.id, candidate, decision.url);
      return { image: saved.source, poster: "posters/places/" + place.id + ".webp" };
    } catch (error) {
      lastError = error.message;
    }
  }
  return { image: "", poster: "", imageError: lastError };
}

function searchQuery(place) {
  const tokens = String(place.addr || "").split(/\s+/).filter((token) => /(시|군|구|읍|면)$/.test(token) && !/특별|광역|자치/.test(token));
  const region = tokens[tokens.length - 1] || tokens[0] || "";
  const name = String(place.name || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return (name + " " + region).trim();
}

async function searchWeb(query) {
  const url = "https://search.naver.com/search.naver?where=web&query=" + encodeURIComponent(query);
  const doc = await fetchText(url);
  if (/자동입력 방지|captcha/i.test(doc.html) && doc.html.length < 80000) throw new Error("검색 제한");
  const links = [];
  const seen = new Set();
  for (const match of doc.html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].replace(/&amp;/g, "&");
    const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (seen.has(href)) continue;
    seen.add(href);
    if (blockedHost(href) || directoryPath(href)) continue;
    if (/pstatic\.net|nid\.naver|help\.naver|dict\.naver|terms\.naver|kin\.naver|news\.naver|keep\.naver|shopping\.naver|map\.naver|place\.naver|academic\.naver|land\.naver/i.test(href)) continue;
    if (reviewTitle(label)) continue;
    links.push(href);
    if (links.length >= 6) break;
  }
  return links;
}

function pool(limit) {
  let active = 0;
  const queue = [];
  function next() {
    if (!queue.length || active >= limit) return;
    const job = queue.shift();
    active += 1;
    job.fn().then(job.resolve, job.reject).finally(() => {
      active -= 1;
      next();
    });
  }
  return function run(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

async function consider(place, url, fromSeed, channelTitle, html) {
  if (!url || blockedHost(url)) return null;
  let docHtml = html || "";
  let finalUrl = url;
  let channel = channelTitle || "";
  const blogId = naverBlogId(url);
  if (blogId) {
    const blog = await fetchBlogContext(url);
    if (!blog) return null;
    docHtml = blog.html;
    channel = blog.channel || channel;
    finalUrl = "https://blog.naver.com/" + blog.blogId;
  } else if (!docHtml) {
    const doc = await fetchText(url);
    docHtml = doc.html;
    finalUrl = doc.url;
  }
  const decision = decide(place, { html: docHtml, url: finalUrl, finalUrl, originalUrl: url, title: channel }, { fromSeed, channelTitle: channel });
  if (!decision.ok) return { ok: false, reason: decision.reason, url };
  return decision;
}

async function matchPlace(place) {
  const seed = cleanUrl(place.homepage);
  if (seed && !blockedHost(seed)) {
    try {
      const found = await consider(place, seed, true, "", "");
      if (found && found.ok) return found;
    } catch (_) { /* 등록된 주소가 열리지 않으면 검색으로 넘어간다 */ }
  }
  let links = [];
  let searchError = "";
  const query = searchQuery(place);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      links = await searchWeb(query);
      searchError = "";
      break;
    } catch (error) {
      searchError = error.message;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  if (searchError) return { ok: false, reason: searchError };
  for (const link of links) {
    try {
      const found = await consider(place, link, false, "", "");
      if (found && found.ok) return found;
    } catch (_) { /* next candidate */ }
  }
  return { ok: false, reason: "검색에서 확인 못함" };
}

function selfCheck() {
  const place = { name: "가영당", addr: "충청북도 청주시 청원구 오창읍 미래지로 71-54", tel: "" };
  const html = "<title>가영당</title><p>오창읍 미래지로 71-54</p>";
  const ok = decide(place, { html, url: "https://www.gayoungdang.com/", finalUrl: "https://www.gayoungdang.com/" }, { fromSeed: true, channelTitle: "" });
  if (!ok.ok) throw new Error("공식 홈페이지를 놓쳤습니다");
  const weak = decide(place, { html: "<title>가영당</title><p>청주시</p>", url: "https://www.gayoungdang.com/", finalUrl: "https://www.gayoungdang.com/" }, { fromSeed: true, channelTitle: "" });
  if (weak.ok) throw new Error("도시명만으로 통과하면 안 됩니다");
  const phonePlace = { name: "데이원동물의료센터", addr: "서울특별시 강남구 테헤란로 1", tel: "02-1234-5678" };
  const phoneOk = decide(phonePlace, { html: "<title>데이원동물의료센터</title> 전화 02-1234-5678", url: "https://24dayone.com/", finalUrl: "https://24dayone.com/" }, { fromSeed: true, channelTitle: "" });
  if (!phoneOk.ok || !phoneOk.how.includes("phone")) throw new Error("전화 일치");
  const review = decide(place, { html: "<title>가영당 방문 후기</title> 미래지로 71-54", url: "https://blog.naver.com/someone/123", finalUrl: "https://blog.naver.com/someone/123" }, { fromSeed: false, channelTitle: "심심이 일기" });
  if (review.ok) throw new Error("다른 사람 블로그 후기");
  const ownBlog = decide(place, { html: "<title>가영당 소식</title> 미래지로 71-54", url: "https://blog.naver.com/gayoung", finalUrl: "https://blog.naver.com/gayoung" }, { fromSeed: true, channelTitle: "가영당" });
  if (!ownBlog.ok) throw new Error("업체 블로그");
  if (!blockedHost("https://map.naver.com/p/entry/place/1")) throw new Error("네이버 플레이스 차단");
  if (!blockedHost("https://www.gocamping.or.kr/bsite/camp/info/read.do?c_no=1")) throw new Error("고캠핑 차단");
  if (blockedHost("https://blog.naver.com/namo_on")) throw new Error("네이버 블로그는 후보");
  if (canonicalPage("https://blog.naver.com/namo_on/123?utm_source=x") !== "https://blog.naver.com/namo_on") throw new Error("블로그 주소 정리");
  const mirrorPlace = { ...place, id: "tour-2707444" };
  const mirror = decide(mirrorPlace, { html, url: "https://info.koreacharts.com/tour/2707444/contents.html", finalUrl: "https://info.koreacharts.com/tour/2707444/contents.html" }, { fromSeed: false, channelTitle: "" });
  if (mirror.ok) throw new Error("관광 복제 페이지");
  if (!blockedHost("https://booking.naver.com/booking/3/bizes/1")) throw new Error("네이버 예약 차단");
  if (!blockedHost("https://www.daangn.com/kr/local-profile/sample")) throw new Error("당근 지역 프로필 차단");
  if (!blockedHost("https://yakfact.kr/animal-hospital/seoul/1")) throw new Error("동물병원 디렉터리 차단");
  if (!directoryPath("https://open-maru.com/business/39058")) throw new Error("업체 디렉터리 경로");
  const hospital = { id: "h24-301000001020210001", name: "에스디동물영상센터", addr: "서울특별시 중구 세종대로 110", tel: "02-1111-2222" };
  const catalogPage = decide(hospital, { html: "<title>에스디동물영상센터</title><p>세종대로 110 02-1111-2222</p>", url: "https://example-directory.test/animal-hospital/301000001020210001", finalUrl: "https://example-directory.test/animal-hospital/301000001020210001" }, { fromSeed: true, channelTitle: "" });
  if (catalogPage.ok) throw new Error("등록번호가 들어간 복제 페이지");
  console.log("[petmap] official matcher self-check ok");
}

function writeOutputs(records, unmatched, notes) {
  fs.mkdirSync(POSTER_DIR, { recursive: true });
  const sources = {};
  for (const record of records) {
    sources[record.id] = {
      url: record.url,
      image: record.image || "",
      site: record.site,
      poster: record.poster || "",
    };
  }
  fs.writeFileSync(SOURCES_PATH, JSON.stringify(sources, null, 2) + "\n", "utf8");
  fs.writeFileSync(UNMATCHED_PATH, unmatched.join("\n") + (unmatched.length ? "\n" : ""), "utf8");
  fs.writeFileSync(NOTES_PATH, JSON.stringify({ matched: notes.length, unmatched: unmatched.length, notes }, null, 2) + "\n", "utf8");
}

async function main() {
  if (process.argv.includes("--self-check")) {
    selfCheck();
    return;
  }
  const idArg = process.argv.find((arg) => arg.startsWith("--ids="));
  const only = idArg ? new Set(idArg.slice(6).split(",").filter(Boolean)) : null;
  const progressPath = "/tmp/petmap-official-progress.jsonl";
  const resume = process.argv.includes("--resume");
  const doneIds = new Set();
  const records = [];
  const unmatched = [];
  const notes = [];
  if (resume && fs.existsSync(progressPath)) {
    const keptLines = [];
    let dropped = 0;
    for (const line of fs.readFileSync(progressPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      if (row.url && (blockedHost(row.url) || directoryPath(row.url) || copiesCatalogId({ id: row.id }, row.url))) {
        dropped += 1;
        if (row.poster) fs.rmSync(path.join(ROOT, row.poster), { force: true });
        continue;
      }
      keptLines.push(line);
      doneIds.add(row.id);
      if (row.ok === false) unmatched.push(row.id);
      else records.push(row);
    }
    if (dropped) {
      fs.writeFileSync(progressPath, keptLines.length ? keptLines.join("\n") + "\n" : "");
      console.log("[petmap] dropped " + dropped + " directory matches for another search");
    }
  } else if (!only) fs.writeFileSync(progressPath, "");
  const places = loadPlaces().filter((place) => (!only || only.has(place.id)) && !doneIds.has(place.id));
  fs.mkdirSync(POSTER_DIR, { recursive: true });
  const run = pool(Number(process.env.OFFICIAL_CONCURRENCY || 5));
  let done = doneIds.size;
  await Promise.all(places.map((place) => run(async () => {
    let result = { ok: false, reason: "" };
    try { result = await matchPlace(place); }
    catch (error) { result = { ok: false, reason: error.message }; }
    let note;
    if (result && result.ok) {
      let image = { image: "", poster: "", imageError: "" };
      try { image = await attachImage(place, result); }
      catch (error) { image.imageError = error.message; }
      note = {
        id: place.id,
        url: result.url,
        site: siteLabel(result.url),
        image: image.image || "",
        poster: image.poster || "",
        how: result.how,
        risk: [result.risk, image.imageError ? "no-image" : ""].filter(Boolean).join(","),
        name: place.name,
      };
      records.push(note);
    } else {
      unmatched.push(place.id);
      note = { id: place.id, name: place.name, ok: false, reason: (result && (result.reason || result.error)) || "불일치" };
    }
    notes.push(note);
    done += 1;
    if (!only) fs.appendFileSync(progressPath, JSON.stringify(note) + "\n");
    const total = places.length + doneIds.size;
    if (done % 25 === 0 || done === total) {
      console.log("[petmap] official " + done + "/" + total + " matched " + records.length + " unmatched " + unmatched.length);
    }
  })));
  const groups = new Map();
  for (const record of records) {
    const key = presenceKey(record.url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const kept = [];
  for (const record of records) {
    const key = presenceKey(record.url);
    const group = groups.get(key) || [];
    const social = key.startsWith("blog:") || key.startsWith("cafe:") || key.startsWith("ig:");
    const distinctUrls = new Set(group.map((item) => item.url));
    const listing = group.some((item) => directoryPath(item.url) || copiesCatalogId({ id: item.id }, item.url));
    if (!social && group.length >= 4 && (distinctUrls.size > 1 || listing)) {
      unmatched.push(record.id);
      if (record.poster) fs.rmSync(path.join(ROOT, record.poster), { force: true });
      notes.push({ id: record.id, name: record.name, ok: false, reason: "같은 사이트가 여러 업체를 가리킴 " + key });
      continue;
    }
    if (group.length > 1) record.risk = [record.risk, "shared-domain"].filter(Boolean).join(",");
    kept.push(record);
  }
  records.length = 0;
  records.push(...kept);
  records.sort((a, b) => a.id.localeCompare(b.id));
  unmatched.sort();
  if (!only) writeOutputs(records, unmatched, notes.filter((note) => note.ok !== false || note.risk));
  else {
    console.log(JSON.stringify({ records, unmatched, notes }, null, 2));
    return;
  }
  const risky = records.filter((record) => record.risk);
  console.log("[petmap] matched " + records.length + " unmatched " + unmatched.length + " risky " + risky.length + " with-image " + records.filter((record) => record.poster).length);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[petmap] " + error.stack);
    process.exitCode = 1;
  });
}

module.exports = { decide, blockedHost, canonicalPage, nameHit, addressHit, selfCheck };
