#!/usr/bin/env node
"use strict";

// Package-free static page builder for petmap.kr.
// Run: node build.js [--out=dist] [--sri]
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");
const tourapi = require("./tourapi");

const ROOT = __dirname;
const DOMAIN = process.env.SITE_DOMAIN || "www.petmap.kr";
const BASE_URL = "https://" + DOMAIN;
const args = process.argv.slice(2);
const outArg = args.find((arg) => arg.startsWith("--out="));
const OUT = path.resolve(ROOT, outArg ? outArg.slice(6) : "dist");
const USE_SRI = args.includes("--sri");
const CATEGORIES = {
  stay: { label: "애견 숙박", color: "#E4572E", image: "stay.png" },
  food: { label: "동반 음식점·카페", color: "#96762F", image: "food.png" },
  park: { label: "놀이터·산책", color: "#5F7161", image: "park.png" },
  hospital: { label: "24시 동물병원", color: "#C62F3B", image: "hospital.png" },
};
const DEFAULT_TITLE = "댕냥이와 함께 — 반려동물 동반 전국 지도";
const DEFAULT_DESCRIPTION = "서울부터 제주까지 전국의 애견 숙박, 동반 음식점·카페, 반려견 공원과 산책로, 24시간 동물병원 정보를 모은 지도예요. 방문 전 해당 업체에 확인하세요.";
const DEFAULT_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const REPORT_EMAIL = process.env.REPORT_EMAIL || "";

function log(message) { console.log("[petmap] " + message); }
function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function safeJson(value) { return JSON.stringify(value).replace(/</g, "\\u003c"); }
function todayDate() { return DEFAULT_DATE; }
function normalizeData(text, sourceName) {
  let decoded = text.trim();
  if (!decoded.startsWith("[") && !decoded.startsWith("{")) {
    try { decoded = Buffer.from(decoded, "base64").toString("utf8"); }
    catch (error) { throw new Error(sourceName + ": base64 디코딩 실패 (" + error.message + ")"); }
  }
  return JSON.parse(decoded);
}
function regionOf(address) {
  return String(address || "").trim().split(/\s+/)[0] || "전국";
}
function displayValue(value) {
  const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  if (!text || text === "확인 중" || text === "정보 없음" || /정보 없음$/.test(text) || text.includes("확인 중")) return "";
  return text;
}
function descriptionFor(place, category) {
  const overview = place.tour && displayValue(place.tour.overview);
  if (overview) {
    let result = (place.name + " · " + overview).replace(/\s+/g, " ");
    if (Array.from(result).length > 120) result = Array.from(result).slice(0, 119).join("") + "…";
    return result;
  }
  const pieces = [place.name, category.label];
  const addr = displayValue(place.addr);
  const hours = displayValue(place.hours);
  if (addr) pieces.push(addr);
  if (place.category === "hospital" && hours) pieces.push("진료시간 " + hours);
  let result = pieces.join(" · ").replace(/\s+/g, " ");
  if (Array.from(result).length > 120) result = Array.from(result).slice(0, 119).join("") + "…";
  return result;
}
function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}
function makeMeta({ title, description, url, image, alt, type }) {
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="댕냥이와 함께">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escapeHtml(alt)}">`,
    `<meta property="og:locale" content="ko_KR">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ].join("\n    ");
}
function phoneHref(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 9 ? "tel:" + digits : "";
}
function jsonLdFor(place) {
  const data = {
    "@context": "https://schema.org",
    "@type": place.category === "hospital" ? "VeterinaryCare" : "Place",
    name: place.name,
    description: descriptionFor(place, CATEGORIES[place.category]),
    address: { "@type": "PostalAddress", streetAddress: place.addr || "", addressCountry: "KR" },
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
  };
  if (place.tel) data.telephone = place.tel;
  if (place.homepage) data.url = place.homepage;
  if (place.hours) data.additionalProperty = { "@type": "PropertyValue", name: "진료시간", value: place.hours };
  if (place.tour && tourapi.isSizedImage(place.tour.image)) data.image = place.tour.image.url;
  return safeJson(data);
}
function reportLink() {
  if (!REPORT_EMAIL) return "";
  const subject = encodeURIComponent("댕냥이와 함께 장소 정보 수정 제안");
  return `<p class="pd-report"><a href="mailto:${escapeHtml(REPORT_EMAIL)}?subject=${subject}">정보가 다르면 알려주세요</a></p>`;
}
function makePlacePage(place, css, updatedAt, thin) {
  const cat = CATEGORIES[place.category];
  const region = regionOf(place.addr);
  const title = `${place.name} — ${region} 반려동물 동반 · 댕냥이와 함께`;
  const description = descriptionFor(place, cat);
  const url = `${BASE_URL}/place/${encodeURIComponent(place.id)}.html`;
  const image = `${BASE_URL}/og/${cat.image}`;
  const tel = phoneHref(place.tel);
  const isHospital = place.category === "hospital";
  const officialUrl = place.homepage || "";
  const mapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;
  const search = tourapi.mapLinks(place);
  const detail = place.tour || null;
  const overview = detail ? displayValue(detail.overview) : "";
  const photo = detail && tourapi.isSizedImage(detail.image) ? detail.image : null;
  const petRules = detail && Array.isArray(detail.petRules) ? detail.petRules.filter((rule) => displayValue(rule.value)) : [];
  const address = displayValue(place.addr);
  const phone = displayValue(place.tel);
  const hours = displayValue(place.hours);
  const source = displayValue(sourceFor(place));
  const rows = [
    address ? `<div class="pd-row"><dt>주소</dt><dd>${escapeHtml(address)}</dd></div>` : "",
    phone ? `<div class="pd-row"><dt>전화</dt><dd><a href="${escapeHtml(tel || ("tel:" + String(phone).replace(/[^\d+]/g, "")))}">${escapeHtml(phone)}</a></dd></div>` : "",
    hours ? `<div class="pd-row"><dt>${isHospital ? "진료시간" : "운영시간"}</dt><dd>${escapeHtml(hours)}</dd></div>` : "",
  ].filter(Boolean).join("\n");
  const actions = [
    tel ? `<a class="call-btn${isHospital ? " call-btn--emg" : ""}" href="${escapeHtml(tel)}">${isHospital ? "지금 전화하기" : "전화 걸기"}</a>` : "",
    `<a class="site-btn" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">길찾기</a>`,
    officialUrl ? `<a class="site-btn" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener">${place.source === "gocamping" ? "고캠핑 상세 보기" : "공식 사이트"}</a>` : "",
  ].filter(Boolean).join("\n");
  const mapSearch = [
    `<a class="site-btn" href="${escapeHtml(search.kakao)}" target="_blank" rel="noopener">카카오맵에서 보기</a>`,
    `<a class="site-btn" href="${escapeHtml(search.naver)}" target="_blank" rel="noopener">네이버 지도에서 보기</a>`,
  ].join("\n");
  const photoHtml = photo
    ? `<figure class="pd-figure"><img src="${escapeHtml(photo.url)}" width="${Math.round(Number(photo.width))}" height="${Math.round(Number(photo.height))}" alt="${escapeHtml(photo.alt || place.name)}" loading="lazy" decoding="async"><figcaption class="pd-caption">${escapeHtml(tourapi.imageCaption(photo))}</figcaption></figure>`
    : `<div class="pd-photo" aria-hidden="true"><svg class="pd-photo-paw" width="84" height="84" viewBox="0 0 24 24"><path d="M12 13.2c2.9 0 5.6 2.3 5.6 4.7 0 1.5-1.1 2.5-2.7 2.5-1 0-1.8-.4-2.9-.4s-1.9.4-2.9.4c-1.6 0-2.7-1-2.7-2.5 0-2.4 2.7-4.7 5.6-4.7ZM6.2 8.1c1 .3 1.5 1.7 1.1 3-.4 1.4-1.5 2.2-2.5 1.9-1-.3-1.5-1.7-1.1-3 .4-1.3 1.5-2.2 2.5-1.9Zm11.6 0c1-.3 2.1.6 2.5 1.9.4 1.3-.1 2.7-1.1 3-1 .3-2.1-.5-2.5-1.9-.4-1.3.1-2.7 1.1-3ZM9.3 3.6c1.1.1 1.9 1.4 1.8 2.9-.1 1.4-1 2.6-2.1 2.5C7.9 8.9 7.1 7.6 7.2 6.2c.1-1.5 1-2.7 2.1-2.6Zm5.4 0c1.1-.1 2 1.1 2.1 2.6.1 1.4-.7 2.7-1.8 2.8-1.1.1-2-1.1-2.1-2.5-.1-1.5.7-2.8 1.8-2.9Z"/></svg><span class="pd-photo-cap">${escapeHtml(cat.label)}</span></div>`;
  const overviewHtml = overview ? `<p class="pd-overview">${escapeHtml(overview)}</p>` : "";
  const petHtml = petRules.length
    ? `<h2 class="pd-sec-title">반려동물 동반 조건</h2><div class="pd-card pd-pet"><dl style="margin:0">${petRules.map((rule) => `<div class="pd-row"><dt>${escapeHtml(rule.label)}</dt><dd>${escapeHtml(rule.value)}</dd></div>`).join("")}</dl></div><p class="pd-caption">동반 조건은 한국관광공사 TourAPI 반려동물 동반여행 정보(detailPetTour2)입니다. 방문 전 업체에 다시 확인하세요.</p>`
    : "";
  const warning = isHospital
    ? `<p class="pd-warn"><strong>야간·응급 진료 가능 여부는 방문 전 전화로 확인하세요.</strong></p>`
    : `<p class="pd-warn">공공데이터에 등록된 정보 기준이라 실제 운영 현황과 다를 수 있어요. 방문 전 반려동물 동반 가능 여부를 해당 업체에 확인하세요.</p>`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  ${thin ? '<meta name="robots" content="noindex, follow">' : ""}
  ${makeMeta({ title, description, url, image, alt: place.name, type: "place" })}
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="/place/place.css">
  <script type="application/ld+json">${jsonLdFor(place)}</script>
</head>
<body class="place-doc">
  <header class="site-bar">
    <a class="brand" href="/">
      <span class="paw" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24"><path d="M12 13.2c2.9 0 5.6 2.3 5.6 4.7 0 1.5-1.1 2.5-2.7 2.5-1 0-1.8-.4-2.9-.4s-1.9.4-2.9.4c-1.6 0-2.7-1-2.7-2.5 0-2.4 2.7-4.7 5.6-4.7ZM6.2 8.1c1 .3 1.5 1.7 1.1 3-.4 1.4-1.5 2.2-2.5 1.9-1-.3-1.5-1.7-1.1-3 .4-1.3 1.5-2.2 2.5-1.9Zm11.6 0c1-.3 2.1.6 2.5 1.9.4 1.3-.1 2.7-1.1 3-1 .3-2.1-.5-2.5-1.9-.4-1.3.1-2.7 1.1-3ZM9.3 3.6c1.1.1 1.9 1.4 1.8 2.9-.1 1.4-1 2.6-2.1 2.5C7.9 8.9 7.1 7.6 7.2 6.2c.1-1.5 1-2.7 2.1-2.6Zm5.4 0c1.1-.1 2 1.1 2.1 2.6.1 1.4-.7 2.7-1.8 2.8-1.1.1-2-1.1-2.1-2.5-.1-1.5.7-2.8 1.8-2.9Z"/></svg></span>
      <span>댕냥이와 함께</span>
    </a>
    <nav class="site-nav" aria-label="주요 메뉴">
      <a href="/">전국 지도</a>
      <a href="/guides/">여행 가이드</a>
      <a href="/about.html">소개</a>
    </nav>
  </header>
  <main class="page-detail" style="display:block;overflow:visible">
    <article class="pd-inner">
      ${photoHtml}
      <h1 class="pd-title">${escapeHtml(place.name)}</h1>
      <span class="badge"><span class="dot dot--${place.category}"></span>${escapeHtml(cat.label)}</span>
      ${overviewHtml}
      <div class="pd-card"><dl style="margin:0">${rows}</dl></div>
      ${petHtml}
      <div class="pd-actions">${actions}</div>
      <div class="pd-maps">${mapSearch}</div>
      ${warning}
      ${reportLink()}
      <p class="pd-source-date">데이터 기준일: ${escapeHtml(updatedAt)}</p>
      ${source ? `<p class="pd-source-note">${escapeHtml(source)}</p>` : ""}
      <p><a class="pd-back" href="/">← 목록으로 돌아가기</a></p>
    </article>
  </main>
  <footer class="site-footer">
    <nav class="trust-nav" aria-label="안내">
      <a href="/about.html">소개</a>
      <a href="/privacy.html">개인정보처리방침</a>
      <a href="/contact.html">문의</a>
      <a href="/terms.html">이용안내</a>
    </nav>
  </footer>
</body>
</html>`;
}
function sourceFor(place) {
  if (place.category === "hospital") return "maruvet·vet24 24시 동물병원 목록 등재 · 2026-10 확인";
  if (place.source === "kbizin") return "한국관광공사·한국문화정보원 공공데이터 · 애견동반 카페";
  if (place.source === "gocamping") return "고캠핑(gocamping.or.kr) · 반려견동반 캠핑장";
  return "한국관광공사 TourAPI · 반려동물 동반 여행 정보";
}
// Public-data card fields. Anything else with real prose can keep a place page indexed.
const PUBLIC_DATA_FIELDS = new Set(["id", "name", "category", "addr", "tel", "hours", "lat", "lng", "source", "homepage", "verified24h"]);
const EDITORIAL_MIN_CHARS = 180;
function editorialText(place) {
  const parts = [];
  for (const [key, value] of Object.entries(place)) {
    if (PUBLIC_DATA_FIELDS.has(key) || typeof value !== "string") continue;
    const text = value.replace(/\s+/g, " ").trim();
    if (text) parts.push(text);
  }
  return parts.join(" ");
}
// Thin: the page only repeats the public-data card (name, address, phone, hours, source).
// Hours are empty ("정보 없음") or the single token "24시간", and there is no original write-up.
// Those pages stay on the site for visitors, but are noindex and left out of the sitemap.
function isThinPlace(place) {
  if (tourapi.isRich(place.tour)) return false;
  return Array.from(editorialText(place)).length < EDITORIAL_MIN_CHARS;
}
function makeMainMeta(html) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : DEFAULT_TITLE;
  if (title !== DEFAULT_TITLE) throw new Error("메인 <title>이 고정 문구와 다릅니다: " + title);
  const desc = DEFAULT_DESCRIPTION;
  const tags = makeMeta({ title, description: desc, url: BASE_URL + "/", image: BASE_URL + "/og/default.png", alt: "댕냥이와 함께", type: "website" }).replace(/<title>[\s\S]*?<\/title>\n\s*/, "");
  html = html.replace(/\s*<meta name="description"[^>]*>/i, "").replace(/\s*<link rel="canonical"[^>]*>/i, "");
  html = html.replace(/\s*<meta (?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/gi, "");
  html = html.replace(titleMatch ? titleMatch[0] : "</head>", (match) => match + "\n    " + tags);
  html = html.replace(/<footer>([\s\S]*?)<\/footer>/i, (match) => {
    if (match.includes("dataUpdatedAt")) return match;
    return match.replace("</footer>", ' <span id="dataUpdatedAt">데이터 기준일: ' + todayDate() + "</span></footer>");
  });
  html = html.replace(/var state = \{ cats: \{ stay: true, food: true, park: true, hospital: false \}, q: "" \};/, 'var state = { cats: { stay: true, food: true, park: true, hospital: true }, q: "" };');
  html = html.replace('var REPORT_EMAIL = "__REPORT_EMAIL__";', "var REPORT_EMAIL = " + safeJson(REPORT_EMAIL) + ";");
  html = html.replace('mainLink.href = "#/place/" + encodeURIComponent(p.id);', 'mainLink.href = "/place/" + encodeURIComponent(p.id) + ".html";');
  html = html.replace('return \'<a class="near-card" href="#/place/\' + encodeURIComponent(q.id) + \'">\' +', 'return \'<a class="near-card" href="/place/\' + encodeURIComponent(q.id) + \'.html">\' +');
  html = html.replace('m.on("click", function () { window.location.hash = "#/place/" + encodeURIComponent(p.id); });', 'm.on("click", function () { window.location.href = "/place/" + encodeURIComponent(p.id) + ".html"; });');
  const sourceNote = "(rowValue(sourceLabel(p)) ? '<p class=\"pd-source-note\">' + esc(sourceLabel(p)) + \"</p>\" : \"\") +";
  if (!html.includes(sourceNote)) throw new Error("상세 페이지 출처 한 줄을 찾지 못했습니다.");
  if (REPORT_EMAIL && !html.includes("정보가 다르면 알려주세요")) {
    html = html.replace(sourceNote, sourceNote + "\n              (REPORT_EMAIL ? '<p class=\"pd-report\"><a href=\"mailto:' + esc(REPORT_EMAIL) + '?subject=댕냥이와%20함께%20장소%20정보%20수정%20제안\">정보가 다르면 알려주세요</a></p>' : \"\") +");
  }
  return html;
}
async function withSri(html) {
  const tagRegex = /<(script|link)\b[^>]*(?:src|href)="(https?:\/\/[^\"]+)"[^>]*>/gi;
  const matches = [...html.matchAll(tagRegex)];
  for (const match of matches) {
    const tag = match[0];
    const url = match[2];
    const isCss = /^<link\b/i.test(tag) && /rel="stylesheet"/i.test(tag);
    const isScript = /^<script\b/i.test(tag) && /src=/i.test(tag);
    if (!isCss && !isScript) continue;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const body = Buffer.from(await response.arrayBuffer());
      const integrity = "sha384-" + crypto.createHash("sha384").update(body).digest("base64");
      let updated = tag.replace(/\s+integrity="[^"]*"/i, "");
      updated = updated.slice(0, -1) + ` integrity="${integrity}" crossorigin="anonymous">`;
      html = html.replace(tag, updated);
    } catch (error) { console.warn("[petmap] SRI 경고: " + url + " 해시를 가져오지 못해 integrity 없이 진행합니다 (" + error.message + ")"); }
  }
  return html;
}
function svgThumbnail(label, color, isDefault) {
  const title = isDefault ? "댕냥이와 함께" : label;
  const subtitle = isDefault ? "반려동물 동반 전국 지도" : "반려동물과 함께하는 전국 장소 지도";
  const paw = '<g fill="' + color + '" opacity=".9"><ellipse cx="0" cy="20" rx="25" ry="18"/><ellipse cx="-25" cy="-5" rx="10" ry="14" transform="rotate(-24 -25 -5)"/><ellipse cx="-8" cy="-20" rx="10" ry="14" transform="rotate(-8 -8 -20)"/><ellipse cx="12" cy="-20" rx="10" ry="14" transform="rotate(8 12 -20)"/><ellipse cx="29" cy="-4" rx="10" ry="14" transform="rotate(24 29 -4)"/></g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#FAF9F6"/><circle cx="600" cy="217" r="84" fill="${color}" opacity=".10"/><g transform="translate(600 217) scale(1.55)">${paw}</g><text x="600" y="390" text-anchor="middle" fill="#1A1A1A" font-family="Pretendard, 'Noto Sans KR', sans-serif" font-size="66" font-weight="800">${escapeXml(title)}</text><text x="600" y="454" text-anchor="middle" fill="#55524C" font-family="Pretendard, 'Noto Sans KR', sans-serif" font-size="31" font-weight="500">${escapeXml(subtitle)}</text><rect x="500" y="510" width="200" height="6" rx="3" fill="${color}"/></svg>`;
}
function hexRgb(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
function rasterPng(color) {
  // Dependency-free fallback: PNG background, simple paw mark and category accent.
  // When SVG conversion is available, the normal path also rasterizes the title text.
  const width = 1200, height = 630, stride = width * 4;
  const pixels = Buffer.alloc((stride + 1) * height);
  const accent = hexRgb(color), bg = [250, 249, 246];
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    pixels[row] = 0;
    for (let x = 0; x < width; x++) {
      const offset = row + 1 + x * 4;
      pixels[offset] = bg[0]; pixels[offset + 1] = bg[1]; pixels[offset + 2] = bg[2]; pixels[offset + 3] = 255;
      const dx = x - 600, dy = y - 214;
      const pads = [[0, 15, 48, 34], [-49, -32, 17, 23], [-17, -60, 17, 24], [19, -60, 17, 24], [51, -31, 17, 23]];
      let inside = false;
      for (const [cx, cy, rx, ry] of pads) if (((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2 <= 1) { inside = true; break; }
      const inCircle = dx * dx + dy * dy < 115 * 115;
      const inAccent = y >= 520 && y < 526 && x >= 500 && x < 700;
      if (inCircle) { pixels[offset] = Math.round(bg[0] + (accent[0] - bg[0]) * .1); pixels[offset + 1] = Math.round(bg[1] + (accent[1] - bg[1]) * .1); pixels[offset + 2] = Math.round(bg[2] + (accent[2] - bg[2]) * .1); }
      if (inside || inAccent) { pixels[offset] = accent[0]; pixels[offset + 1] = accent[1]; pixels[offset + 2] = accent[2]; }
    }
  }
  function chunk(type, data) {
    const kind = Buffer.from(type), body = Buffer.concat([kind, data]), out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), 8 + data.length); return out;
  }
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", (() => { const b = Buffer.alloc(13); b.writeUInt32BE(width, 0); b.writeUInt32BE(height, 4); b[8] = 8; b[9] = 6; return b; })()), chunk("IDAT", zlib.deflateSync(pixels, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function generateOgImages() {
  const ogDir = path.join(OUT, "og");
  fs.mkdirSync(ogDir, { recursive: true });
  const converter = process.env.IMAGEMAGICK_BINARY || "convert";
  const outputs = { "default.png": ["댕냥이와 함께", "#E4572E", true] };
  for (const [key, cat] of Object.entries(CATEGORIES)) outputs[cat.image] = [cat.label, cat.color, false];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "petmap-og-"));
  try {
    for (const [filename, [label, color, isDefault]] of Object.entries(outputs)) {
      const destination = path.join(ogDir, filename);
      const source = path.join(tmp, filename.replace(/\.png$/, ".svg"));
      fs.writeFileSync(source, svgThumbnail(label, color, isDefault), "utf8");
      try { execFileSync(converter, [source, "-strip", destination], { stdio: "ignore" }); }
      catch (error) {
        if (fs.existsSync(destination) && fs.statSync(destination).size > 100) {
          console.warn("[petmap] 이미지 생성기를 사용할 수 없어 기존 PNG 유지: " + destination);
        } else {
          console.warn("[petmap] SVG 변환을 사용할 수 없어 글자 없는 PNG 발자국 디자인을 생성합니다. " + error.message.split("\n")[0]);
          fs.writeFileSync(destination, rasterPng(color));
        }
      }
      const signature = fs.readFileSync(destination).subarray(0, 8).toString("hex");
      if (signature !== "89504e470d0a1a0a") throw new Error("PNG 검증 실패: " + destination);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
function copyAssets() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const file of ["index.html", "places_park.json"]) {
    if (fs.existsSync(path.join(ROOT, file))) fs.copyFileSync(path.join(ROOT, file), path.join(OUT, file));
  }
  if (fs.existsSync(path.join(ROOT, "data"))) fs.cpSync(path.join(ROOT, "data"), path.join(OUT, "data"), { recursive: true });
  if (fs.existsSync(path.join(ROOT, "og"))) fs.cpSync(path.join(ROOT, "og"), path.join(OUT, "og"), { recursive: true });
}
function mainCss(html) {
  const blocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  if (!blocks.length) throw new Error("index.html에서 공통 스타일을 찾을 수 없습니다.");
  return blocks[blocks.length - 1][1];
}
function verifyOgFiles() {
  const missing = [];
  const htmlFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) htmlFiles.push(full);
    }
  }
  walk(OUT);
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    for (const match of html.matchAll(/<meta\s+property="og:image"\s+content="([^"]+)"/g)) {
      const url = new URL(match[1]);
      if (url.origin !== BASE_URL || !fs.existsSync(path.join(OUT, url.pathname.replace(/^\//, "")))) missing.push(file + " -> " + match[1]);
    }
  }
  if (missing.length) throw new Error("og:image 실제 파일 확인 실패:\n" + missing.slice(0, 20).join("\n"));
  log("OG 이미지 URL 검사 통과: " + htmlFiles.length + "개 HTML 페이지");
  return htmlFiles.length;
}
async function build() {
  const rawIndex = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const html = makeMainMeta(rawIndex);
  const css = mainCss(html);
  const inputDir = path.join(ROOT, "data");
  const partFiles = fs.readdirSync(inputDir).filter((name) => /^places_part\d+\.json$/.test(name)).sort();
  if (!partFiles.length) throw new Error("data/places_part*.json 파일을 찾지 못했습니다.");
  const places = [];
  const skipped = [];
  let updatedAt = "";
  for (const filename of partFiles) {
    try {
      const parsed = normalizeData(fs.readFileSync(path.join(inputDir, filename), "utf8"), filename);
      if (Array.isArray(parsed)) places.push(...parsed);
      else if (Array.isArray(parsed.places)) { places.push(...parsed.places); updatedAt ||= parsed.updatedAt || ""; }
      else throw new Error("장소 배열이 아닙니다.");
    } catch (error) { console.warn("[petmap] 데이터 파일 건너뜀: " + filename + " (" + error.message + ")"); }
  }
  for (const filename of ["places.json", "data/places.json"]) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(ROOT, filename), "utf8"));
      updatedAt ||= meta.updatedAt || "";
    } catch (_) { /* optional metadata file */ }
  }
  updatedAt = updatedAt || todayDate();
  const valid = [];
  const seen = new Set();
  for (let index = 0; index < places.length; index++) {
    const p = places[index];
    const id = p && String(p.id || "");
    if (!p || !id || !/^[A-Za-z0-9_-]+$/.test(id) || !String(p.name || "").trim() || !CATEGORIES[p.category] || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) {
      skipped.push(`${index + 1}: ${id || "(ID 없음)"} / ${p && p.name ? p.name : "장소 정보 없음"} — 필수 필드/카테고리/좌표 오류`);
      continue;
    }
    if (seen.has(id)) { skipped.push(`${index + 1}: ${id} / ${p.name} — 중복 ID`); continue; }
    seen.add(id);
    valid.push({ ...p, id, lat: Number(p.lat), lng: Number(p.lng) });
  }
  if (!valid.length) throw new Error("생성할 수 있는 장소가 없습니다.");
  const tour = await tourapi.loadOrFetch({
    places: valid,
    cachePath: path.join(ROOT, "data", "tourapi-cache.json"),
    serviceKey: process.env.TOURAPI_SERVICE_KEY || "",
    refresh: args.includes("--refresh-tourapi"),
    log,
  });
  for (const place of valid) {
    const contentId = tourapi.contentIdOf(place);
    const detail = contentId ? tour.byContentId[contentId] : null;
    place.tour = detail && detail.complete ? detail : null;
    if (place.tour && place.tour.homepage && !displayValue(place.homepage)) {
      place.homepage = place.tour.homepage;
      place.homepageFromTour = true;
    }
  }
  const tourStats = tourapi.summarize(valid);
  log(`TourAPI contentid ${tour.contentIds}곳, 이번 빌드에서 받은 상세 ${tour.fetched}곳`);
  log(`이미지 ${tourStats.images} · 개요 ${tourStats.overviews} · TourAPI로 새로 채운 홈페이지 ${tourStats.apiHomepages} · 기존 홈페이지 ${tourStats.existingHomepages} · 동반 조건 ${tourStats.petRules} · 색인 가능 ${tourStats.rich}`);
  fs.rmSync(OUT, { recursive: true, force: true });
  copyAssets();
  let main = makeMainMeta(rawIndex).replace(/데이터 기준일: \d{4}-\d{2}-\d{2}/, "데이터 기준일: " + updatedAt);
  if (USE_SRI) main = await withSri(main);
  fs.writeFileSync(path.join(OUT, "index.html"), main, "utf8");
  const publishedPlaces = valid.map((place) => {
    const copy = { ...place };
    if (!copy.tour) delete copy.tour;
    if (!copy.homepageFromTour) delete copy.homepageFromTour;
    return copy;
  });
  fs.writeFileSync(path.join(OUT, "places.json"), JSON.stringify({ updatedAt, places: publishedPlaces }), "utf8");
  fs.mkdirSync(path.join(OUT, "place"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "place", "place.css"), css, "utf8");
  const indexablePlaces = [];
  let thinCount = 0;
  for (const place of valid) {
    const thin = isThinPlace(place);
    if (thin) thinCount += 1;
    else indexablePlaces.push(place);
    const filename = path.join(OUT, "place", place.id + ".html");
    try { fs.writeFileSync(filename, makePlacePage(place, css, updatedAt, thin), "utf8"); }
    catch (error) { skipped.push(`${place.id}: ${place.name} — 페이지 생성 실패 (${error.message})`); }
  }
  const pageUrls = indexablePlaces.map((p) => `${BASE_URL}/place/${encodeURIComponent(p.id)}.html`);
  const sitemapUrls = [BASE_URL + "/", ...pageUrls];
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${escapeXml(url)}</loc><lastmod>${todayDate()}</lastmod></url>`).join("\n")}\n</urlset>\n`, "utf8");
  fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`, "utf8");
  generateOgImages();
  const htmlCount = verifyOgFiles();
  const builtPages = valid.filter((p) => fs.existsSync(path.join(OUT, "place", p.id + ".html"))).length;
  log(`데이터 기준일: ${updatedAt}`);
  log(`장소 정적 페이지 생성: ${builtPages}/${valid.length}`);
  log(`얇은 장소 noindex·사이트맵 제외: ${thinCount}곳, 색인을 유지하는 장소: ${indexablePlaces.length}곳`);
  if (indexablePlaces.filter((place) => tourapi.isRich(place.tour)).length !== tourStats.rich) {
    throw new Error("색인 장소 수가 TourAPI 상세(이미지·개요·동반 조건) 수와 다릅니다.");
  }
  const sampleHtml = fs.readFileSync(path.join(OUT, "place", "kbizin-212.html"), "utf8");
  if (!sampleHtml.includes("카카오맵에서 보기") || !sampleHtml.includes("https://map.kakao.com/link/search/") || !sampleHtml.includes("네이버 지도에서 보기") || !sampleHtml.includes("https://map.naver.com/p/search/")) {
    throw new Error("장소 페이지에 카카오맵·네이버 지도 검색 링크가 없습니다.");
  }
  if (sampleHtml.includes("pd-overview") || sampleHtml.includes("pd-figure")) throw new Error("contentid가 없는 장소에 관광 개요나 사진을 넣었습니다.");
  if (!sampleHtml.includes('name="robots" content="noindex, follow"')) throw new Error("정보가 얇은 장소가 색인 대상이 되었습니다.");
  log(`전체 HTML: ${htmlCount}, OG PNG: 5, 장소 반영 전 sitemap URL: ${sitemapUrls.length}`);
  if (thinCount + indexablePlaces.length !== valid.length) throw new Error("얇은 장소 분류 수가 전체 장소 수와 다릅니다.");
  if (skipped.length) {
    console.warn(`[petmap] 건너뛴 장소 ${skipped.length}건:`);
    skipped.forEach((line) => console.warn("  - " + line));
  }
  if (builtPages !== valid.length) throw new Error("일부 장소 페이지를 생성하지 못했습니다.");
}

build().catch((error) => { console.error("[petmap] 빌드 실패: " + error.stack); process.exitCode = 1; });
