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
const ENRICHMENT_FIELDS = [
  { id: "indoorOutdoor", keys: ["indoorOutdoor", "실내실외", "실내/실외"], label: "실내/실외" },
  { id: "sizeLimit", keys: ["sizeLimit", "weightLimit", "무게제한", "무게·크기 제한"], label: "무게·크기 제한" },
  { id: "extraFee", keys: ["extraFee", "추가 요금", "추가요금"], label: "추가 요금" },
  { id: "checkedOn", keys: ["checkedOn", "확인일"], label: "확인일" },
  { id: "checkedSource", keys: ["checkedSource", "sourceNote", "확인 출처", "출처", "source"], label: "확인 출처" },
];
const UNCONFIRMED = new Set(["미확인", "미확인.", "확인 불가", "알 수 없음"]);
const INDEX_BODY_MIN = 24;
const AD_UNIT = '<aside class="ad-slot" aria-label="광고"><p class="ad-slot-label">광고</p><ins class="adsbygoogle" style="display:block;width:100%;min-height:250px" data-ad-client="ca-pub-4533404826925371" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>';
let catalogPlaces = [];
const REGION_ORDER = [
  "서울특별시", "경기도", "인천광역시", "강원특별자치도",
  "대전광역시", "세종특별자치시", "충청북도", "충청남도",
  "전북특별자치도", "광주광역시", "전라남도",
  "경상북도", "경상남도", "부산광역시", "대구광역시", "울산광역시",
  "제주특별자치도",
];
const REGION_SHORT = {
  "서울특별시": "서울", "경기도": "경기", "인천광역시": "인천", "강원특별자치도": "강원",
  "대전광역시": "대전", "세종특별자치시": "세종", "충청북도": "충북", "충청남도": "충남",
  "전북특별자치도": "전북", "광주광역시": "광주", "전라남도": "전남",
  "경상북도": "경북", "경상남도": "경남", "부산광역시": "부산", "대구광역시": "대구", "울산광역시": "울산",
  "제주특별자치도": "제주",
};
const HOME_GUIDE_IDS = [
  "seoul-pet-cafes-walks",
  "gyeonggi-daytrip-pets",
  "gangwon-overnight-with-dog",
  "jeju-pet-flight-guide",
  "busan-pet-beach-cafe",
  "korea-pet-map-counts",
];
function loadEnrichmentMap() {
  const file = path.join(ROOT, "content", "place-enrichment.json");
  if (!fs.existsSync(file)) return {};
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = parsed && parsed.places ? parsed.places : parsed;
  if (Array.isArray(rows)) {
    const map = {};
    for (const row of rows) if (row && row.id) map[String(row.id)] = row;
    return map;
  }
  return rows && typeof rows === "object" ? rows : {};
}
function enrichmentValue(record, keys) {
  if (!record) return "";
  for (const key of keys) {
    if (record[key] == null) continue;
    const text = displayValue(record[key]);
    if (text) return text;
  }
  return "";
}
function normalizeEnrichment(record) {
  if (!record || typeof record !== "object") return null;
  const normalized = {};
  let any = false;
  for (const field of ENRICHMENT_FIELDS) {
    const value = enrichmentValue(record, field.keys);
    if (!value) continue;
    normalized[field.id] = value;
    any = true;
  }
  return any ? normalized : null;
}
function enrichmentRows(place) {
  const record = place && place.enrichment;
  return ENRICHMENT_FIELDS.map((field) => ({ id: field.id, label: field.label, value: enrichmentValue(record, [field.id]) }));
}
function isFilledEnrichment(place) {
  const rows = enrichmentRows(place);
  if (rows.some((row) => !row.value || UNCONFIRMED.has(row.value))) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rows.find((row) => row.id === "checkedOn").value)) return false;
  if (!/실내|실외|야외/.test(rows.find((row) => row.id === "indoorOutdoor").value)) return false;
  const overview = place.tour && displayValue(place.tour.overview) || "";
  const pet = place.tour && Array.isArray(place.tour.petRules) ? place.tour.petRules.map((rule) => displayValue(rule.value)).join("") : "";
  const body = (rows.map((row) => row.value).join("") + overview + pet).replace(/\s/g, "");
  return Array.from(body).length >= INDEX_BODY_MIN;
}
const ICON = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  bang: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  cross: '<path d="M18 6 6 18M6 6l12 12"/>',
  dog: '<path d="M7 9.5 4.5 5.5 4 11c0 4 3.5 8 8 8s8-4 8-8l-.5-5.5L17 9.5"/><path d="M7 9.5c1.4-1 3.1-1.5 5-1.5s3.6.5 5 1.5"/><circle cx="9.5" cy="12.5" r=".6" fill="currentColor"/><circle cx="14.5" cy="12.5" r=".6" fill="currentColor"/><path d="M11 15.5h2l-1 1z"/>',
  indoor: '<path d="M3.5 10.5 12 4l8.5 6.5V20h-17z"/><path d="M9.5 20v-5.5h5V20"/>',
  leash: '<circle cx="6.5" cy="6.5" r="3"/><path d="m8.6 8.6 9.4 9.4"/><path d="M15 21h5v-5"/>',
  cat: '<path d="M5 19.5v-8.5L4 4l5 3.2h6L20 4l-1 7v8.5z"/><circle cx="9.5" cy="12.5" r=".6" fill="currentColor"/><circle cx="14.5" cy="12.5" r=".6" fill="currentColor"/><path d="M11 15.2h2l-1 1z"/>',
  count: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  fee: '<circle cx="12" cy="12" r="9"/><path d="M9 9.5c.5-1 1.6-1.5 3-1.5 1.7 0 3 .8 3 2s-1.3 1.7-3 2-3 .8-3 2 1.3 2 3 2c1.4 0 2.5-.5 3-1.5M12 6v2M12 16v2"/>',
  cage: '<rect x="4" y="7" width="16" height="12" rx="1"/><path d="M4 12h16M9 7v12M15 7v12M8 7 12 3l4 4"/>',
  menu: '<path d="M4 10h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/>',
  rule: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8h.01"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
};
function strokeIcon(name, size) {
  const px = size || 22;
  return `<svg class="ic" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${px <= 16 ? 2 : 1.5}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;
}
function confirmedText(value) {
  const text = displayValue(value);
  if (!text || UNCONFIRMED.has(text)) return "";
  return text;
}
function monthIndex(iso) {
  const match = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]);
}
function isStaleCheck(iso) {
  const then = monthIndex(iso);
  const now = monthIndex(DEFAULT_DATE);
  return then != null && now != null && now - then > 12;
}
function checkedBadgeText(iso) {
  const match = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
  if (!match) return "";
  const label = match[1] + "." + match[2] + " 확인";
  return isStaleCheck(iso) ? label + " · 오래된 정보" : label;
}
function tidyTile(tile) {
  if (tile.note && (tile.note === tile.status || tile.status.includes(tile.note))) tile.note = "";
  return tile;
}
function pushTile(tiles, tile) {
  const next = tidyTile(tile);
  const key = next.label + "\n" + next.status;
  if (tiles.some((item) => item.label + "\n" + item.status === key)) return;
  tiles.push(next);
}
function indoorTile(value) {
  const indoor = /실내/.test(value);
  const outdoorOnly = /실외|야외/.test(value) && !indoor;
  return { icon: "indoor", label: "실내 동반", tone: outdoorOnly ? "no" : "yes", status: value, note: "" };
}
function sizeTile(value) {
  if (/소형견만|소형만|소형견\s*전용/.test(value)) return { icon: "dog", label: "소형견만", tone: "must", status: value, note: "" };
  if (/대형견/.test(value) && /불가|금지|안\s*됨/.test(value) && !/가능/.test(value)) return { icon: "dog", label: "대형견 동반", tone: "no", status: "불가", note: value };
  if (/대형견/.test(value) && /가능|허용|환영/.test(value) && !/불가|금지|이하|미만|까지/.test(value)) return { icon: "dog", label: "대형견 동반", tone: "yes", status: "가능", note: value };
  const open = /제한\s*없음|제한없음|무게\s*제한\s*없음/.test(value);
  return { icon: "dog", label: "무게·크기 제한", tone: open ? "yes" : "must", status: value, note: "" };
}
function feeTile(value) {
  const none = /^(없음|없음\.|무료|0원)$/.test(value) || /추가\s*요금\s*없음|요금\s*없음|별도\s*요금\s*없음|무료/.test(value);
  return { icon: "fee", label: "추가 요금", tone: none ? "yes" : "must", status: none ? "없음" : value, note: "" };
}
function tilesFromRules(rules, tiles) {
  for (const rule of rules || []) {
    const label = confirmedText(rule && rule.label);
    const value = confirmedText(rule && rule.value);
    if (!value) continue;
    const text = (label + " " + value).replace(/\s+/g, " ");
    if (/목줄/.test(text) && /필수|착용|해야|필요|지참/.test(text)) {
      pushTile(tiles, { icon: "leash", label: "목줄 착용", tone: "must", status: "필수", note: value });
      continue;
    }
    if (/고양이/.test(text) && /불가|안\s*됨|금지|제외|가능|허용|환영/.test(text)) {
      const denied = /불가|안\s*됨|금지|제외/.test(text);
      pushTile(tiles, { icon: "cat", label: "고양이 동반", tone: denied ? "no" : "yes", status: denied ? "불가" : "가능", note: value });
      continue;
    }
    if (/\d+\s*마리|마리\s*까지|최대\s*\d+/.test(text)) {
      pushTile(tiles, { icon: "count", label: "동반 마릿수", tone: /필수|제한|까지/.test(text) ? "must" : "yes", status: value, note: "" });
      continue;
    }
    if (/케이지|이동장/.test(text) && /필수|필요|착용|지참|해야/.test(text)) {
      pushTile(tiles, { icon: "cage", label: "케이지 필수", tone: "must", status: "필수", note: value });
      continue;
    }
    if (/메뉴/.test(text) && /펫|반려|애견|동물/.test(text)) {
      const missing = /없|불가|제공하지/.test(text);
      pushTile(tiles, { icon: "menu", label: "펫 전용 메뉴", tone: missing ? "no" : "yes", status: missing ? "불가" : "가능", note: value });
      continue;
    }
    if (/^(없음|해당\s*없음|해당없음|없음\.|-|–)$/.test(value)) continue;
    pushTile(tiles, { icon: "rule", label: label || "동반 조건", tone: "must", status: value, note: "" });
  }
}
function companionTiles(place) {
  const tiles = [];
  const record = place && place.enrichment;
  const indoor = confirmedText(enrichmentValue(record, ["indoorOutdoor"]));
  const size = confirmedText(enrichmentValue(record, ["sizeLimit"]));
  const fee = confirmedText(enrichmentValue(record, ["extraFee"]));
  if (indoor) pushTile(tiles, indoorTile(indoor));
  if (size) pushTile(tiles, sizeTile(size));
  if (fee) pushTile(tiles, feeTile(fee));
  const rules = place && place.tour && Array.isArray(place.tour.petRules) ? place.tour.petRules : [];
  tilesFromRules(rules, tiles);
  return tiles;
}
function correctionButton(place) {
  return `<a class="pd-fix" href="/contact.html?place=${encodeURIComponent(place.id)}" aria-label="정보 정정 요청">${strokeIcon("pencil", 18)}정정 요청</a>`;
}
function enrichmentHtml(place) {
  const tiles = companionTiles(place);
  if (!tiles.length) return "";
  const checked = confirmedText(enrichmentValue(place.enrichment, ["checkedOn"]));
  const source = confirmedText(enrichmentValue(place.enrichment, ["checkedSource"]));
  const badgeText = checkedBadgeText(checked);
  const badge = badgeText
    ? `<span class="vbadge${isStaleCheck(checked) ? " is-stale" : ""}">${strokeIcon("calendar", 16)}${escapeHtml(badgeText)}</span>`
    : "";
  const items = tiles.map((tile) => {
    const note = tile.note ? `<small>${escapeHtml(tile.note)}</small>` : "";
    const statusIcon = tile.tone === "yes" ? "check" : tile.tone === "no" ? "cross" : "bang";
    return `<li class="cond ${tile.tone}"><span class="ci">${strokeIcon(tile.icon, 22)}</span><span><b>${escapeHtml(tile.label)}</b><span class="st">${strokeIcon(statusIcon, 16)}${escapeHtml(tile.status)}</span>${note}</span></li>`;
  }).join("");
  const sub = source ? `<p class="enr-sub">${escapeHtml(source)}</p>` : "";
  return `<section class="enr" aria-labelledby="enr-title"><div class="enr-h"><h2 id="enr-title">반려동물 동반 조건</h2>${badge}</div>${sub}<ul class="conds">${items}</ul><div class="enr-f"><p>방문 전 업체에 한 번 더 확인해 주세요. 바뀐 내용은 정정 요청으로 알려 주세요.</p>${correctionButton(place)}</div></section>`;
}
function localityOf(address) {
  return String(address || "").trim().split(/\s+/)[1] || "";
}
function distKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function fmtKm(km) {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return Math.max(1, Math.round(km * 1000)) + "m";
  return km.toFixed(1).replace(/\.0$/, "") + "km";
}
function nearestCompanions(place) {
  const region = regionOf(place.addr);
  const locality = localityOf(place.addr);
  const sameLocality = [];
  const sameRegion = [];
  const rest = [];
  for (const other of catalogPlaces) {
    if (!other || other.id === place.id) continue;
    if (!Number.isFinite(other.lat) || !Number.isFinite(other.lng)) continue;
    if (locality && localityOf(other.addr) === locality) sameLocality.push(other);
    else if (regionOf(other.addr) === region) sameRegion.push(other);
    else rest.push(other);
  }
  function take(list, count) {
    return list
      .map((other) => ({ place: other, km: distKm(place, other) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, count);
  }
  let picked = take(sameLocality, 3);
  if (picked.length < 3) picked = picked.concat(take(sameRegion, 3 - picked.length));
  if (picked.length < 3) picked = picked.concat(take(rest, 3 - picked.length));
  return picked;
}
function nearbyHtml(place) {
  const picked = nearestCompanions(place);
  if (!picked.length) return "";
  const locality = localityOf(place.addr);
  const region = regionOf(place.addr);
  const allLocal = locality && picked.every((item) => localityOf(item.place.addr) === locality);
  const allRegion = picked.every((item) => regionOf(item.place.addr) === region);
  const title = allLocal ? locality + "의 다른 동반 장소" : (REGION_SHORT[region] || region) + "의 다른 동반 장소";
  const sub = allLocal ? "같은 시·군·구에서 가까운 순" : allRegion ? "같은 시·도에서 가까운 순" : "가까운 순";
  const items = picked.map((item) => {
    const other = item.place;
    const category = CATEGORIES[other.category];
    const where = [localityOf(other.addr), regionOf(other.addr)].filter(Boolean);
    const meta = [category ? category.label : "", where[0] || ""].filter(Boolean).join(" · ");
    return `<li><a href="/place/${encodeURIComponent(other.id)}.html"><span class="dot dot--${escapeHtml(other.category)}"></span><span><b>${escapeHtml(other.name)}</b><span class="m">${escapeHtml(meta)}</span></span><span class="km">${escapeHtml(fmtKm(item.km))}</span></a></li>`;
  }).join("");
  return `<section class="pd-near"><h2>${escapeHtml(title)}</h2><p class="s">${escapeHtml(sub)}</p><ul class="near">${items}</ul></section>`;
}
function staticMapSvg(place) {
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  const x = Math.round(Math.max(36, Math.min(664, ((lng - 124) / 8) * 700)));
  const y = Math.round(Math.max(36, Math.min(164, ((39 - lat) / 6) * 200)));
  const label = escapeXml(place.name + " 위치, 위도 " + lat.toFixed(5) + ", 경도 " + lng.toFixed(5));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="200" viewBox="0 0 700 200" role="img" aria-label="${label}">
  <rect width="700" height="200" fill="#ECEEE6"/>
  <path d="M0 140 C120 120 200 160 330 130 S560 90 700 110" stroke="#fff" stroke-width="14" fill="none"/>
  <path d="M260 0 L300 200 M480 0 L440 200 M0 60 L700 40" stroke="#fff" stroke-width="7" fill="none"/>
  <rect x="40" y="20" width="120" height="60" fill="#E1E6D8"/>
  <rect x="520" y="130" width="140" height="50" fill="#E1E6D8"/>
  <path d="M600 0 C580 60 640 90 700 80 V0 Z" fill="#D5E3E8"/>
    <g transform="translate(${x} ${y})">
    <path d="M0 0s15-13 15-25a15 15 0 0 0-30 0c0 12 15 25 15 25z" fill="#C2410C" stroke="#fff" stroke-width="2"/>
    <circle cx="0" cy="-25" r="5.5" fill="#fff"/>
  </g>
</svg>`;
}
function staticMapHtml(place) {
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  const address = displayValue(place.addr);
  const alt = place.name + " 위치. 위도 " + lat.toFixed(5) + ", 경도 " + lng.toFixed(5) + (address ? ". " + address : "");
  const caption = address || ("위도 " + lat.toFixed(5) + ", 경도 " + lng.toFixed(5));
  return `<figure class="pd-snap"><img src="/place/maps/${encodeURIComponent(place.id)}.svg" width="700" height="200" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
}
function crumbHtml(place) {
  const region = regionOf(place.addr);
  const locality = localityOf(place.addr);
  const short = REGION_SHORT[region] || region;
  const category = CATEGORIES[place.category];
  const chev = `<span class="sep" aria-hidden="true">${strokeIcon("chev", 14)}</span>`;
  const parts = [`<a href="/">전국 지도</a>`];
  if (region && region !== "전국") parts.push(`<a href="/?region=${encodeURIComponent(short)}">${escapeHtml(region)}</a>`);
  if (locality) parts.push(`<a href="/?region=${encodeURIComponent(short)}&amp;locality=${encodeURIComponent(locality)}">${escapeHtml(locality)}</a>`);
  parts.push(`<b>${escapeHtml(category.label)}</b>`);
  return `<nav class="pd-crumb" aria-label="현재 위치">${parts.join(chev)}</nav>`;
}
function actionButtons(place, options) {
  const tel = phoneHref(place.tel);
  const phone = displayValue(place.tel);
  const official = displayValue(place.homepage);
  const mapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;
  const buttons = [`<a class="pd-btn pri" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">${strokeIcon("pin", 18)}길찾기</a>`];
  if (official) buttons.push(`<a class="pd-btn" href="${escapeHtml(official)}" target="_blank" rel="noopener">${strokeIcon("external", 18)}공식 사이트</a>`);
  if (tel && phone) buttons.push(`<a class="pd-btn" href="${escapeHtml(tel)}">${strokeIcon("phone", 18)}<span>전화</span></a>`);
  if (options && options.stacked) {
    const rest = buttons.slice(1);
    return `<a class="pd-btn pri" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">${strokeIcon("pin", 18)}길찾기</a>${rest.length ? `<div class="pd-btn-row">${rest.join("")}</div>` : ""}`;
  }
  return buttons.join("");
}
function homeGuideLinks() {
  const guides = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "guides.json"), "utf8"));
  const longs = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "long-guides.json"), "utf8"));
  const byId = new Map([...guides, ...longs].map((guide) => [guide.id, guide]));
  return HOME_GUIDE_IDS.map((id) => {
    const guide = byId.get(id);
    if (!guide) throw new Error("홈에 넣을 가이드가 없습니다: " + id);
    return guide;
  });
}
function pickRepresentatives(places) {
  const byRegion = new Map();
  for (const place of places) {
    const region = regionOf(place.addr);
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(place);
  }
  for (const list of byRegion.values()) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const picked = [];
  const seen = new Set();
  for (const region of REGION_ORDER) {
    const list = byRegion.get(region) || [];
    const chosen = [];
    for (const category of ["food", "stay", "park", "hospital"]) {
      const found = list.find((place) => place.category === category && !seen.has(place.id));
      if (!found) continue;
      chosen.push(found);
      if (chosen.length >= 2) break;
    }
    for (const place of list) {
      if (chosen.length >= 2) break;
      if (!chosen.includes(place)) chosen.push(place);
    }
    for (const place of chosen) {
      seen.add(place.id);
      picked.push(place);
    }
  }
  if (picked.length < 30) {
    for (const place of places.slice().sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (picked.length >= 30) break;
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      picked.push(place);
    }
  }
  return picked;
}
function crawlCatalogHtml(places) {
  const counts = new Map();
  for (const place of places) {
    const region = regionOf(place.addr);
    counts.set(region, (counts.get(region) || 0) + 1);
  }
  const regions = REGION_ORDER.filter((region) => counts.has(region));
  for (const region of counts.keys()) if (!regions.includes(region)) regions.push(region);
  const regionItems = regions.map((region) => {
    const href = "/?region=" + encodeURIComponent(REGION_SHORT[region] || region);
    return `<li><a href="${href}">${escapeHtml(region)} <span>${counts.get(region)}곳</span></a></li>`;
  }).join("");
  const reps = pickRepresentatives(places);
  const placeItems = reps.map((place) => {
    const category = CATEGORIES[place.category];
    return `<li><a href="/place/${encodeURIComponent(place.id)}.html">${escapeHtml(place.name)}</a> <span>${escapeHtml(regionOf(place.addr))} · ${escapeHtml(category.label)}</span></li>`;
  }).join("");
  const guideItems = homeGuideLinks().map((guide) => `<li><a href="/guides/${encodeURIComponent(guide.id)}.html">${escapeHtml(guide.title)}</a></li>`).join("");
  return `<div class="crawl-catalog-inner"><h2>시·도별 장소 수</h2><ul class="region-counts">${regionItems}</ul><h2>대표 장소</h2><p class="crawl-note">지도가 열리지 않아도 상세 페이지로 이동할 수 있어요. 수록 ${places.length.toLocaleString("ko-KR")}곳 가운데 시·도마다 고른 ${reps.length}곳입니다.</p><ul class="rep-places">${placeItems}</ul><h2>여행 가이드</h2><ul class="guide-links">${guideItems}</ul></div>`;
}
function injectCrawlCatalog(html, places) {
  if (!html.includes("<!--CRAWL_CATALOG-->")) throw new Error("홈 HTML에 정적 목록 위치가 없습니다.");
  const next = html.replace("<!--CRAWL_CATALOG-->", crawlCatalogHtml(places));
  const forbidden = (next.match(/불러올 수 없어요|조건에 맞는 장소가 없어요/g) || []).length;
  if (forbidden) throw new Error("홈 서버 HTML에 빈 상태 문구가 있습니다: " + forbidden);
  const placeLinks = (next.match(/href="\/place\/[^"]+\.html"/g) || []).length;
  const guideLinks = (next.match(/href="\/guides\/[^"]+\.html"/g) || []).length;
  if (placeLinks < 30) throw new Error("홈 장소 링크가 30개 미만입니다: " + placeLinks);
  if (guideLinks < 6) throw new Error("홈 가이드 링크가 6개 미만입니다: " + guideLinks);
  if (!next.includes("시·도별 장소 수")) throw new Error("홈에 시·도별 장소 수가 없습니다.");
  log(`홈 정적 목록: 시·도 ${new Set(places.map((place) => regionOf(place.addr))).size}곳, 장소 링크 ${placeLinks}, 가이드 링크 ${guideLinks}`);
  return next;
}
function assertNoindexWithoutAds(htmlFiles) {
  const problems = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    const noindex = html.includes('name="robots" content="noindex, follow"');
    const hasUnit = /<ins\b[^>]*\bclass="adsbygoogle"/.test(html);
    if (noindex && hasUnit) problems.push(path.relative(OUT, file));
  }
  if (problems.length) throw new Error("noindex 페이지에 광고 단위가 있습니다: " + problems.slice(0, 8).join(", "));
}
function makePlacePage(place, css, updatedAt, thin) {
  const cat = CATEGORIES[place.category];
  const region = regionOf(place.addr);
  const locality = localityOf(place.addr);
  const title = `${place.name} — ${region} 반려동물 동반 · 댕냥이와 함께`;
  const description = descriptionFor(place, cat);
  const url = `${BASE_URL}/place/${encodeURIComponent(place.id)}.html`;
  const image = `${BASE_URL}/og/${cat.image}`;
  const isHospital = place.category === "hospital";
  const search = tourapi.mapLinks(place);
  const detail = place.tour || null;
  const overview = detail ? displayValue(detail.overview) : "";
  const photo = detail && tourapi.isSizedImage(detail.image) ? detail.image : null;
  const address = displayValue(place.addr);
  const hours = displayValue(place.hours);
  const source = displayValue(sourceFor(place));
  const checked = confirmedText(enrichmentValue(place.enrichment, ["checkedOn"]));
  const checkedSource = confirmedText(enrichmentValue(place.enrichment, ["checkedSource"]));
  const badgeText = checkedBadgeText(checked);
  const rows = [
    address ? `<div class="pd-row"><dt>주소</dt><dd>${escapeHtml(address)}</dd></div>` : "",
    hours ? `<div class="pd-row"><dt>${isHospital ? "진료시간" : "운영시간"}</dt><dd>${escapeHtml(hours)}</dd></div>` : "",
    source ? `<div class="pd-row"><dt>출처</dt><dd>${escapeHtml(source)}</dd></div>` : "",
  ].filter(Boolean).join("\n");
  const photoHtml = photo
    ? `<figure class="pd-figure"><img src="${escapeHtml(photo.url)}" width="${Math.round(Number(photo.width))}" height="${Math.round(Number(photo.height))}" alt="${escapeHtml(photo.alt || place.name)}" loading="lazy" decoding="async"><figcaption class="pd-caption">${escapeHtml(tourapi.imageCaption(photo))}</figcaption></figure>`
    : staticMapHtml(place);
  const overviewHtml = overview ? `<p class="pd-overview">${escapeHtml(overview)}</p>` : "";
  const enrich = enrichmentHtml(place);
  const correction = enrich ? "" : `<p class="pd-correct">${correctionButton(place)}</p>`;
  const where = [REGION_SHORT[region] || region, locality].filter((part) => part && part !== "전국").join(" ");
  const warning = isHospital
    ? `<p class="pd-warn"><strong>야간·응급 진료 가능 여부는 방문 전 전화로 확인하세요.</strong></p>`
    : `<p class="pd-warn">공공데이터에 등록된 정보 기준이라 실제 운영 현황과 다를 수 있어요. 방문 전 반려동물 동반 가능 여부를 해당 업체에 확인하세요.</p>`;
  const checkedLine = badgeText
    ? `<p><b>동반 조건 ${escapeHtml(badgeText)}</b>${checkedSource ? escapeHtml(checkedSource) : ""}</p>`
    : "";
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
  <main class="page-detail">
    <article class="pd-wrap">
      ${crumbHtml(place)}
      <div class="pd-grid">
        <div class="pd-col">
          <h1 class="pd-title">${escapeHtml(place.name)}</h1>
          <p class="pd-cat"><span class="dot dot--${place.category}"></span>${escapeHtml(cat.label)}${where ? " · " + escapeHtml(where) : ""}</p>
          ${photoHtml}
          ${overviewHtml}
          ${rows ? `<div class="pd-info"><dl>${rows}</dl></div>` : ""}
          <div class="pd-mact">${actionButtons(place)}</div>
          ${enrich}
          ${correction}
          ${thin ? "" : AD_UNIT}
          <!--RELATED_GUIDES-->
          ${nearbyHtml(place)}
          ${warning}
          ${reportLink()}
          <p><a class="pd-back" href="/">← 목록으로 돌아가기</a></p>
        </div>
        <aside class="pd-side">
          <div class="pd-card pd-actions-card">
            <h2>바로 가기</h2>
            ${actionButtons(place, { stacked: true })}
            <div class="pd-maplinks">
              <a href="${escapeHtml(search.kakao)}" target="_blank" rel="noopener">카카오맵에서 보기</a>
              <a href="${escapeHtml(search.naver)}" target="_blank" rel="noopener">네이버 지도에서 보기</a>
            </div>
          </div>
          <div class="pd-card pd-source-card">
            <h2>정보 출처</h2>
            <p><b>공공데이터 ${escapeHtml(updatedAt)}</b>${source ? escapeHtml(source) : ""}</p>
            ${checkedLine}
          </div>
        </aside>
      </div>
    </article>
  </main>
  <footer class="site-footer">
    <nav class="trust-nav" aria-label="안내">
      <a href="/about.html">소개</a>
      <a href="/privacy.html">개인정보처리방침</a>
      <a href="/contact.html">문의</a>
      <a href="/terms.html">이용안내</a>
    </nav>
    <p>데이터 기준일: ${escapeHtml(updatedAt)}</p>
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
// Index only places whose enrichment block is filled and whose visible body
// clears INDEX_BODY_MIN. Everything else stays on the site as noindex,follow
// and is left out of the sitemap. TourAPI detail alone does not index a page.
function isThinPlace(place) {
  return !isFilledEnrichment(place);
}
function assertEnrichmentPolicy() {
  const base = { id: "policy-check", name: "정책 확인", category: "food", addr: "서울특별시 중구", lat: 1, lng: 1, source: "kbizin", tel: "", hours: "", homepage: "" };
  const filled = { ...base, enrichment: { indoorOutdoor: "실내·실외", sizeLimit: "소형견 10kg 이하", extraFee: "추가 요금 없음", checkedOn: "2026-10-18", checkedSource: "업체 공식 안내 페이지" } };
  if (isThinPlace(filled)) throw new Error("보강이 채워진 장소가 noindex로 분류되었습니다.");
  const indexed = makePlacePage(filled, "", "2026-10-18", false);
  const hasAdUnit = (html) => /<ins\b[^>]*\bclass="adsbygoogle"/.test(html);
  const indexedOk = !indexed.includes("noindex") && hasAdUnit(indexed) && indexed.includes("정보 정정 요청") && indexed.includes("contact.html?place=policy-check") && indexed.includes('class="enr"') && indexed.includes("반려동물 동반 조건") && indexed.includes("실내 동반") && indexed.includes("실내·실외") && indexed.includes("무게·크기 제한") && indexed.includes("소형견 10kg 이하") && indexed.includes("추가 요금") && indexed.includes("업체 공식 안내 페이지") && indexed.includes("2026.10 확인") && indexed.includes('class="ad-slot"') && indexed.includes("min-height:250px");
  if (!indexedOk || indexed.includes("예시") || indexed.includes("pd-photo-paw") || indexed.includes("대형견 동반")) {
    throw new Error("보강 장소 페이지 구성이 맞지 않습니다.");
  }
  const thinPage = makePlacePage(base, "", "2026-10-18", true);
  if (!thinPage.includes('content="noindex, follow"') || hasAdUnit(thinPage) || !thinPage.includes('href="/contact.html?place=policy-check"') || thinPage.includes('class="enr"') || thinPage.includes("예시") || thinPage.includes("pd-photo-paw") || !thinPage.includes("/place/maps/policy-check.svg")) {
    throw new Error("얇은 장소 페이지에 광고 단위가 있거나 정정 링크가 없습니다.");
  }
  const withRule = { ...base, id: "policy-rule", tour: { petRules: [{ label: "동반 시 필요사항", value: "목줄 착용" }] } };
  const rulePage = makePlacePage(withRule, "", "2026-10-18", true);
  if (!rulePage.includes("목줄 착용") || !rulePage.includes("필수") || !rulePage.includes('class="enr"') || hasAdUnit(rulePage) || rulePage.includes("대형견") || rulePage.includes("고양이 동반")) {
    throw new Error("확인된 동반 조건만 타일로 만들지 못했습니다.");
  }
  if (checkedBadgeText("2026-10-18") !== "2026.10 확인" || checkedBadgeText("2025-09-01") !== "2025.09 확인 · 오래된 정보") {
    throw new Error("확인일 배지 형식이 맞지 않습니다.");
  }
  const partial = { ...base, enrichment: { indoorOutdoor: "실내", sizeLimit: "10kg 이하", extraFee: "없음", checkedOn: "2026-10-18" } };
  if (!isThinPlace(partial)) throw new Error("출처가 없는 보강이 색인 대상이 되었습니다.");
  const unknown = { ...base, enrichment: { indoorOutdoor: "미확인", sizeLimit: "소형견 10kg 이하", extraFee: "추가 요금 없음", checkedOn: "2026-10-18", checkedSource: "업체 공식 안내" } };
  if (!isThinPlace(unknown)) throw new Error("미확인 보강이 색인 대상이 되었습니다.");
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
  const enrichmentMap = loadEnrichmentMap();
  for (const place of valid) place.enrichment = normalizeEnrichment(enrichmentMap[place.id]);
  assertEnrichmentPolicy();
  const tourStats = tourapi.summarize(valid);
  const filledCount = valid.filter((place) => isFilledEnrichment(place)).length;
  log(`TourAPI contentid ${tour.contentIds}곳, 이번 빌드에서 받은 상세 ${tour.fetched}곳`);
  log(`이미지 ${tourStats.images} · 개요 ${tourStats.overviews} · TourAPI로 새로 채운 홈페이지 ${tourStats.apiHomepages} · 기존 홈페이지 ${tourStats.existingHomepages} · 동반 조건 ${tourStats.petRules} · TourAPI 상세 충족 ${tourStats.rich} · 보강 후 색인 ${filledCount}`);
  fs.rmSync(OUT, { recursive: true, force: true });
  copyAssets();
  let main = makeMainMeta(rawIndex).replace(/데이터 기준일: \d{4}-\d{2}-\d{2}/, "데이터 기준일: " + updatedAt);
  main = injectCrawlCatalog(main, valid);
  if (USE_SRI) main = await withSri(main);
  fs.writeFileSync(path.join(OUT, "index.html"), main, "utf8");
  const publishedPlaces = valid.map((place) => {
    const copy = { ...place };
    if (!copy.tour) delete copy.tour;
    if (!copy.homepageFromTour) delete copy.homepageFromTour;
    if (!copy.enrichment) delete copy.enrichment;
    return copy;
  });
  fs.writeFileSync(path.join(OUT, "places.json"), JSON.stringify({ updatedAt, places: publishedPlaces }), "utf8");
  fs.mkdirSync(path.join(OUT, "place", "maps"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "place", "place.css"), css, "utf8");
  catalogPlaces = valid;
  const indexablePlaces = [];
  let thinCount = 0;
  for (const place of valid) {
    const thin = isThinPlace(place);
    if (thin) thinCount += 1;
    else indexablePlaces.push(place);
    const filename = path.join(OUT, "place", place.id + ".html");
    try {
      const pageHtml = makePlacePage(place, css, updatedAt, thin);
      fs.writeFileSync(filename, pageHtml, "utf8");
      const detail = place.tour || null;
      const photo = detail && tourapi.isSizedImage(detail.image) ? detail.image : null;
      if (!photo) fs.writeFileSync(path.join(OUT, "place", "maps", place.id + ".svg"), staticMapSvg(place), "utf8");
    }
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
  log(`얇은 장소 noindex·사이트맵 제외: ${thinCount}곳, 보강이 채워져 색인하는 장소: ${indexablePlaces.length}곳`);
  const sitemapXml = fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8");
  for (const place of valid) {
    const pagePath = path.join(OUT, "place", place.id + ".html");
    const page = fs.readFileSync(pagePath, "utf8");
    const filled = isFilledEnrichment(place);
    const url = `${BASE_URL}/place/${encodeURIComponent(place.id)}.html`;
    const inSitemap = sitemapXml.includes(`<loc>${url}</loc>`);
    if (filled !== inSitemap) throw new Error("사이트맵과 보강 색인 기준이 다릅니다: " + place.id);
    const hasAdUnit = /<ins\b[^>]*\bclass="adsbygoogle"/.test(page);
    if (filled && (page.includes("noindex") || !hasAdUnit)) throw new Error("보강된 장소가 noindex이거나 광고 단위가 없습니다: " + place.id);
    if (!filled && (!page.includes('content="noindex, follow"') || hasAdUnit)) throw new Error("보강되지 않은 장소가 색인되거나 광고 단위가 있습니다: " + place.id);
    if (!page.includes(`href="/contact.html?place=${encodeURIComponent(place.id)}"`) || !page.includes("정보 정정 요청")) throw new Error("정정 요청 링크가 없습니다: " + place.id);
  }
  assertNoindexWithoutAds([path.join(OUT, "index.html"), ...valid.map((place) => path.join(OUT, "place", place.id + ".html"))]);
  const sampleHtml = fs.readFileSync(path.join(OUT, "place", "kbizin-212.html"), "utf8");
  if (!sampleHtml.includes("카카오맵에서 보기") || !sampleHtml.includes("https://map.kakao.com/link/search/") || !sampleHtml.includes("네이버 지도에서 보기") || !sampleHtml.includes("https://map.naver.com/p/search/")) {
    throw new Error("장소 페이지에 카카오맵·네이버 지도 검색 링크가 없습니다.");
  }
  if (sampleHtml.includes("pd-overview") || sampleHtml.includes("pd-figure")) throw new Error("contentid가 없는 장소에 관광 개요나 사진을 넣었습니다.");
  if (sampleHtml.includes("예시") || sampleHtml.includes("pd-photo-paw") || !sampleHtml.includes('class="pd-snap"') || !fs.existsSync(path.join(OUT, "place", "maps", "kbizin-212.svg"))) {
    throw new Error("장소 페이지에 예시 값이나 발바닥 플레이스홀더가 있습니다.");
  }
  if (!sampleHtml.includes('name="robots" content="noindex, follow"')) throw new Error("정보가 얇은 장소가 색인 대상이 되었습니다.");
  if (/<ins\b[^>]*\bclass="adsbygoogle"/.test(sampleHtml)) throw new Error("noindex 샘플 장소에 광고 단위가 있습니다.");
  log(`전체 HTML: ${htmlCount}, OG PNG: 5, 장소 반영 전 sitemap URL: ${sitemapUrls.length}`);
  if (thinCount + indexablePlaces.length !== valid.length) throw new Error("얇은 장소 분류 수가 전체 장소 수와 다릅니다.");
  if (skipped.length) {
    console.warn(`[petmap] 건너뛴 장소 ${skipped.length}건:`);
    skipped.forEach((line) => console.warn("  - " + line));
  }
  if (builtPages !== valid.length) throw new Error("일부 장소 페이지를 생성하지 못했습니다.");
}

build().catch((error) => { console.error("[petmap] 빌드 실패: " + error.stack); process.exitCode = 1; });
