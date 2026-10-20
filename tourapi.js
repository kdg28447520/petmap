"use strict";

// Build-time client for 한국관광공사 TourAPI 4 (KorService2).
// The browser never calls this API. Results are cached in data/tourapi-cache.json
// and copied into the static place pages.
const fs = require("node:fs");
const path = require("node:path");

const TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2";
const CACHE_VERSION = 1;
const PET_FIELDS = [
  ["acmpyPsblCpam", "동반 가능 동물"],
  ["etcAcmpyPsblCpam", "기타 동반 동물"],
  ["acmpyTypeCd", "동반 구분"],
  ["acmpyNeedMtr", "동반 시 필요사항"],
  ["relaPosesFclty", "구비 시설"],
  ["relaFrnshPrdlst", "비치 품목"],
  ["relaRntlPrdlst", "대여 품목"],
  ["relaPurcPrdlst", "구매 가능 품목"],
  ["etcAcmpyInfo", "기타 동반 정보"],
  ["relaAcdntRiskMtr1", "주의사항"],
  ["relaAcdntRiskMtr2", "주의사항"],
  ["relaAcdntRiskMtr3", "주의사항"],
];
// detailPetTour2 fields shown as returned. Empty stays empty so the page can
// print the visit-before-you-go line. Names are checked on the first live call.
const VERBATIM_PET_FIELDS = [
  ["acmpyTypeCd", "동반 구분"],
  ["acmpyPsblCpam", "동반 가능 동물"],
  ["acmpyNeedMtr", "동반 시 필요사항"],
  ["etcAcmpyInfo", "기타 동반 정보"],
];
const PET_EMPTY = "정보 없음 — 방문 전 업체에 확인하세요";
let petFieldNamesNoted = false;

function contentIdOf(place) {
  if (!place || place.source !== "tourapi") return "";
  const id = String(place.id || "").replace(/^tour-/, "");
  return /^\d{4,12}$/.test(id) ? id : "";
}

function plainText(value) {
  return String(value == null ? "" : value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function httpUrl(value) {
  const raw = String(value || "");
  const fromHref = (raw.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
  const candidate = fromHref || (raw.match(/https?:\/\/[^\s"'<>]+/i) || [])[0] || "";
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch (_) {
    return "";
  }
}

function imageUrl(value) {
  let href = httpUrl(value);
  if (!href) return "";
  if (href.startsWith("http://") && /visitkorea\.or\.kr|kto\.or\.kr/i.test(href)) href = "https://" + href.slice("http://".length);
  return href.startsWith("https://") ? href : "";
}

function readableApiText(value) {
  const text = plainText(value);
  if (!text || text === "0" || text === "-" || text === "없음" || text === "해당없음") return "";
  if (/^[0-9A-Za-z]{1,3}$/.test(text)) return "";
  return text;
}

function licenseKind(code) {
  const compact = String(code || "").toLowerCase().replace(/\s+/g, "");
  if (!compact) return "";
  if (compact === "type3" || compact === "3" || compact.includes("제3유형")) return "type3";
  if (compact === "type1" || compact === "1" || compact.includes("제1유형")) return "type1";
  return "";
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function photoName(image, fallbackName) {
  return plainText((image && (image.imgname || image.alt)) || fallbackName) || "관광 사진";
}

function imageCaption(image, fallbackName) {
  const kind = licenseKind(image && image.licenseCode);
  if (!kind) return "";
  const name = photoName(image, fallbackName);
  if (kind === "type3") return "사진: ‘" + name + "’ ⓒ 한국관광공사 · 공공누리 제3유형(출처표시+변경금지) · 원본 그대로 게재 · api.visitkorea.or.kr";
  return "사진: ‘" + name + "’ ⓒ 한국관광공사 · 공공누리 제1유형(출처표시) · api.visitkorea.or.kr";
}

function captionHtml(image, fallbackName) {
  const kind = licenseKind(image && image.licenseCode);
  if (!kind) return "";
  const name = escapeHtml(photoName(image, fallbackName));
  const link = '<a href="https://api.visitkorea.or.kr" target="_blank" rel="noopener">api.visitkorea.or.kr</a>';
  if (kind === "type3") return "사진: ‘" + name + "’ ⓒ 한국관광공사 · 공공누리 제3유형(출처표시+변경금지) · 원본 그대로 게재 · " + link;
  return "사진: ‘" + name + "’ ⓒ 한국관광공사 · 공공누리 제1유형(출처표시) · " + link;
}

function isSizedImage(image) {
  if (!image || !imageUrl(image.url)) return false;
  const width = Math.round(Number(image.width));
  const height = Math.round(Number(image.height));
  return Number.isFinite(width) && Number.isFinite(height) && width >= 1 && height >= 1 && width <= 8000 && height <= 8000;
}

function isUsablePhoto(image) {
  return isSizedImage(image) && Boolean(licenseKind(image.licenseCode));
}

function petRulesFromItem(item) {
  const rules = [];
  const seen = new Set();
  for (const [key, label] of PET_FIELDS) {
    const value = readableApiText(item && item[key]);
    if (!value) continue;
    const stamp = label + "\n" + value;
    if (seen.has(stamp)) continue;
    seen.add(stamp);
    rules.push({ label, value });
  }
  return rules;
}

function verbatimApiText(value) {
  return plainText(value);
}

function petConditionsFromItem(item) {
  return PET_FIELDS.map(([key, label]) => ({
    key,
    label,
    value: verbatimApiText(item && item[key]),
  }));
}

function notePetFieldNames(item, log) {
  if (petFieldNamesNoted || !item || typeof item !== "object") return;
  petFieldNamesNoted = true;
  const missing = PET_FIELDS.map(([key]) => key).filter((key) => !Object.prototype.hasOwnProperty.call(item, key));
  if (missing.length) {
    log("detailPetTour2 응답에 없는 필드: " + missing.join(", ") + ". 응답 키: " + Object.keys(item).join(", "));
    return;
  }
  log("detailPetTour2 필드 확인: " + VERBATIM_PET_FIELDS.map(([key]) => key).join(", "));
}

function isRich(detail) {
  if (!detail) return false;
  return Boolean(plainText(detail.overview) && isUsablePhoto(detail.image) && Array.isArray(detail.petRules) && detail.petRules.some((rule) => plainText(rule.value)));
}

function licensedImage(imageItem, commonItem) {
  const itemCode = plainText(imageItem && imageItem.cpyrhtDivCd);
  const itemUrl = imageUrl(imageItem && (imageItem.originimgurl || imageItem.smallimageurl));
  if (licenseKind(itemCode) && itemUrl) {
    return {
      url: itemUrl,
      licenseCode: itemCode,
      alt: plainText((imageItem && imageItem.imgname) || (commonItem && commonItem.title)) || "",
      imgname: plainText(imageItem && imageItem.imgname) || "",
    };
  }
  const commonCode = plainText(commonItem && commonItem.cpyrhtDivCd);
  const commonUrl = imageUrl((commonItem && (commonItem.firstimage || commonItem.firstimage2)) || "");
  if (licenseKind(commonCode) && commonUrl) {
    return {
      url: commonUrl,
      licenseCode: commonCode,
      alt: plainText(commonItem && commonItem.title) || "",
      imgname: plainText(commonItem && commonItem.title) || "",
    };
  }
  return null;
}

function mapLinks(place) {
  const query = [place && place.name, place && place.addr].map((part) => plainText(part)).filter(Boolean).join(" ");
  return {
    query,
    kakao: "https://map.kakao.com/link/search/" + encodeURIComponent(query),
    naver: "https://map.naver.com/p/search/" + encodeURIComponent(query),
  };
}

function itemsOf(payload) {
  const body = payload && payload.response && payload.response.body;
  const items = body && body.items && body.items.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function imageSize(buffer) {
  if (!buffer || buffer.length < 24) return null;
  if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.toString("ascii", 0, 3) === "GIF") {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    if (buffer.toString("ascii", 12, 16) === "VP8X" && buffer.length >= 30) {
      return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    }
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const size = buffer.readUInt16BE(offset + 2);
      if (size < 2) return null;
      const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSof && offset + 9 < buffer.length) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      offset += 2 + size;
    }
  }
  return null;
}

function normalizeDetail(contentId, common, imageItem, petItem, size) {
  const commonItem = common || {};
  const picked = licensedImage(imageItem, commonItem);
  const image = picked && size ? {
    url: picked.url,
    width: size.width,
    height: size.height,
    licenseCode: picked.licenseCode,
    alt: picked.alt,
    imgname: picked.imgname,
  } : null;
  const tel = plainText(commonItem.tel).replace(/^TEL\\s*[:：]?\\s*/i, "");
  const address = [plainText(commonItem.addr1), plainText(commonItem.addr2)].filter(Boolean).join(" ").trim();
  return {
    contentId: String(contentId),
    overview: plainText(commonItem.overview),
    tel,
    address,
    zipcode: plainText(commonItem.zipcode),
    homepage: httpUrl(commonItem.homepage),
    image: image && isUsablePhoto(image) ? image : null,
    petRules: petRulesFromItem(petItem),
    petConditions: petConditionsFromItem(petItem),
    fetchedAt: new Date().toISOString(),
    complete: true,
  };
}

function readCache(cachePath) {
  if (!fs.existsSync(cachePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  if (JSON.stringify(parsed).includes("serviceKey")) throw new Error("TourAPI 캐시에 인증키가 들어 있습니다.");
  const places = parsed && parsed.places;
  return places && typeof places === "object" ? places : {};
}

function writeCache(cachePath, places) {
  const body = JSON.stringify({ version: CACHE_VERSION, service: "KorService2", places }, null, 2) + "\n";
  if (body.includes("serviceKey")) throw new Error("TourAPI 캐시에 인증키를 쓰지 않습니다.");
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const temp = cachePath + ".tmp";
  fs.writeFileSync(temp, body, "utf8");
  fs.renameSync(temp, cachePath);
}

function serviceKeyQuery(key) {
  const trimmed = String(key || "").trim();
  if (!trimmed) return "";
  const encoded = /%[0-9A-Fa-f]{2}/.test(trimmed) ? trimmed : encodeURIComponent(trimmed);
  return "serviceKey=" + encoded;
}

async function tourGet(operation, key, params) {
  const url = new URL(TOUR_BASE + "/" + operation);
  for (const [name, value] of Object.entries({ MobileOS: "ETC", MobileApp: "petmap", _type: "json", numOfRows: "10", pageNo: "1", ...params })) {
    url.searchParams.set(name, value);
  }
  url.search += (url.search ? "&" : "?") + serviceKeyQuery(key);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const text = await response.text();
  if (text.includes(key) && key.length > 8) throw new Error(operation + " 응답을 기록하지 않습니다.");
  if (text.trim().startsWith("<")) {
    const message = (text.match(/<returnAuthMsg>([^<]+)/) || text.match(/<errMsg>([^<]+)/) || [])[1] || "XML 오류";
    const code = (text.match(/<returnReasonCode>([^<]+)/) || [])[1] || String(response.status);
    throw new Error(operation + " " + code + " " + message);
  }
  const payload = JSON.parse(text);
  const header = payload && payload.response && payload.response.header;
  if (header && header.resultCode && header.resultCode !== "0000") throw new Error(operation + " " + header.resultCode + " " + (header.resultMsg || ""));
  return itemsOf(payload);
}

async function measureImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("이미지 HTTP " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error("이미지가 8MB를 넘습니다.");
  const size = imageSize(bytes);
  if (!size) throw new Error("이미지 크기를 읽지 못했습니다.");
  return size;
}

async function fetchOne(contentId, key) {
  const [commonItems, imageItems, petItems] = await Promise.all([
    tourGet("detailCommon2", key, { contentId, defaultYN: "Y", firstImageYN: "Y", addrinfoYN: "Y", overviewYN: "Y" }),
    tourGet("detailImage2", key, { contentId, imageYN: "Y", subImageYN: "N" }),
    tourGet("detailPetTour2", key, { contentId }),
  ]);
  const common = commonItems[0] || {};
  const imageItem = imageItems[0] || null;
  if (petItems[0]) notePetFieldNames(petItems[0], (message) => console.log("[petmap] " + message));
  const picked = licensedImage(imageItem, common);
  let size = null;
  if (picked) {
    try { size = await measureImage(picked.url); }
    catch (error) { size = null; }
  }
  return normalizeDetail(contentId, common, imageItem, petItems[0] || null, size);
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function loadOrFetch({ places, cachePath, serviceKey, refresh, log }) {
  const cached = readCache(cachePath);
  const ids = [];
  const seen = new Set();
  for (const place of places) {
    const contentId = contentIdOf(place);
    if (!contentId || seen.has(contentId)) continue;
    seen.add(contentId);
    ids.push(contentId);
  }
  if (!serviceKey) {
    log("TOURAPI_SERVICE_KEY가 없어 TourAPI 상세 호출을 건너뜁니다. 캐시에 있는 값만 사용합니다.");
    return { byContentId: cached, contentIds: ids.length, fetched: 0 };
  }
  const pending = ids.filter((id) => {
    const row = cached[id];
    const hasContactFields = row
      && Object.prototype.hasOwnProperty.call(row, "tel")
      && Object.prototype.hasOwnProperty.call(row, "address");
    return refresh || !row || row.complete !== true || !hasContactFields;
  });
  log("TourAPI contentid " + ids.length + "곳 중 " + pending.length + "곳을 detailCommon2·detailImage2·detailPetTour2로 받습니다.");
  let fetched = 0;
  let failed = 0;
  await mapPool(pending, 3, async (contentId) => {
    try {
      cached[contentId] = await fetchOne(contentId, serviceKey);
      fetched += 1;
    } catch (error) {
      failed += 1;
      const message = String(error && error.message || error);
      log("TourAPI " + contentId + " 건너뜀: " + (serviceKey && message.includes(serviceKey) ? "응답을 기록하지 않습니다." : message));
    }
  });
  if (fetched) writeCache(cachePath, cached);
  if (failed) log("TourAPI 실패 " + failed + "곳. 받은 값만 페이지에 넣습니다.");
  return { byContentId: cached, contentIds: ids.length, fetched };
}

function summarize(places) {
  let images = 0;
  let overviews = 0;
  let apiHomepages = 0;
  let petRules = 0;
  let rich = 0;
  let existingHomepages = 0;
  for (const place of places) {
    const detail = place.tour;
    if (plainText(place.homepage) && !place.homepageFromTour) existingHomepages += 1;
    if (!detail) continue;
    if (isUsablePhoto(detail.image)) images += 1;
    if (plainText(detail.overview)) overviews += 1;
    if (place.homepageFromTour) apiHomepages += 1;
    if (Array.isArray(detail.petRules) && detail.petRules.length) petRules += 1;
    if (isRich(detail)) rich += 1;
  }
  return { images, overviews, apiHomepages, existingHomepages, petRules, rich };
}

function selfCheck() {
  const provider = normalizeDetail("123456", { tel: "TEL : 02-1234-5678", addr1: "서울특별시 중구", addr2: "세종대로 1", zipcode: "04524" }, null, null, null);
  if (provider.tel !== "02-1234-5678" || provider.address !== "서울특별시 중구 세종대로 1" || provider.zipcode !== "04524") throw new Error("업체 연락처·주소 정규화 실패");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const size = imageSize(png);
  if (!size || size.width !== 1 || size.height !== 1) throw new Error("PNG 크기 파싱 실패");
  const links = mapLinks({ name: "100코달리 와인바", addr: "서울특별시 중구 다산로38길 11" });
  if (!links.kakao.startsWith("https://map.kakao.com/link/search/")) throw new Error("카카오 검색 주소");
  if (!links.naver.startsWith("https://map.naver.com/p/search/")) throw new Error("네이버 검색 주소");
  if (!decodeURIComponent(links.kakao.split("/search/")[1]).includes("100코달리 와인바")) throw new Error("검색어");
  if (contentIdOf({ source: "kbizin", id: "kbizin-212" })) throw new Error("kbizin은 contentid가 아닙니다");
  if (contentIdOf({ source: "tourapi", id: "tour-2707444" }) !== "2707444") throw new Error("contentid");
  const homepage = httpUrl('<a href="https://www.gayoungdang.com/" target="_blank">홈페이지</a>');
  if (homepage !== "https://www.gayoungdang.com/") throw new Error("홈페이지 추출");
  const rules = petRulesFromItem({ acmpyNeedMtr: "목줄 또는 이동장", acmpyTypeCd: "01", relaAcdntRiskMtr1: "없음" });
  if (rules.length !== 1 || rules[0].label !== "동반 시 필요사항") throw new Error("동반 조건 정리");
  const conditions = petConditionsFromItem({ acmpyNeedMtr: "목줄 또는 이동장", acmpyTypeCd: "01", acmpyPsblCpam: "", etcAcmpyInfo: "없음", relaPosesFclty: "정원" });
  const byKey = new Map(conditions.map((row) => [row.key, row.value]));
  if (conditions.length !== PET_FIELDS.length || byKey.get("acmpyTypeCd") !== "01" || byKey.get("acmpyPsblCpam") !== "" || byKey.get("acmpyNeedMtr") !== "목줄 또는 이동장" || byKey.get("etcAcmpyInfo") !== "없음" || byKey.get("relaPosesFclty") !== "정원") throw new Error("동반 조건 원문");
  const rich = { overview: "펜션 소개", image: { url: "https://tong.visitkorea.or.kr/cms/resource/a.jpg", width: 640, height: 480, licenseCode: "Type1" }, petRules: rules };
  if (!isRich(rich)) throw new Error("풍부한 상세 판정");
  if (isRich({ ...rich, petRules: [] })) throw new Error("동반 조건 없는 페이지는 색인하지 않습니다");
  if (!imageCaption(rich.image).includes("공공누리 제1유형")) throw new Error("라이선스 문구");
  if (imageCaption({ licenseCode: "" }) !== "") throw new Error("유형이 없는 사진에는 캡션을 붙이지 않습니다");
  if (licenseKind("Type1") !== "type1" || licenseKind("Type3") !== "type3" || licenseKind("") !== "" || licenseKind("Type2") !== "") throw new Error("cpyrhtDivCd 분류");
  const bare = { url: "https://tong.visitkorea.or.kr/cms/resource/a.jpg", width: 640, height: 480, licenseCode: "" };
  if (isUsablePhoto(bare) || isUsablePhoto({ ...bare, licenseCode: "Type2" })) throw new Error("허용되지 않은 사진을 사용합니다");
  if (!isUsablePhoto(rich.image)) throw new Error("제1유형 사진을 사용하지 않습니다");
  const type3 = { url: "https://tong.visitkorea.or.kr/cms/resource/b.jpg", width: 900, height: 300, licenseCode: "Type3", imgname: "해변&사진" };
  const html = captionHtml(type3, "장소명");
  if (!html.includes("공공누리 제3유형(출처표시+변경금지)") || !html.includes("원본 그대로 게재") || !html.includes('href="https://api.visitkorea.or.kr"') || !html.includes("해변&amp;사진")) throw new Error("제3유형 캡션");
  if (captionHtml({ licenseCode: "", alt: "없음" }, "장소명") !== "") throw new Error("유형 없는 캡션 HTML");
  if (!captionHtml({ licenseCode: "Type1", imgname: "" }, "장소명").includes("장소명")) throw new Error("사진 이름이 없으면 장소명을 씁니다");
  const commonOnly = licensedImage(null, { firstimage: "https://tong.visitkorea.or.kr/cms/resource/c.jpg", cpyrhtDivCd: "" });
  if (commonOnly) throw new Error("cpyrhtDivCd 없는 firstimage를 사용합니다");
  const typed = licensedImage({ originimgurl: "https://tong.visitkorea.or.kr/cms/resource/d.jpg", cpyrhtDivCd: "Type3", imgname: "정원" }, { firstimage: "https://tong.visitkorea.or.kr/cms/resource/e.jpg" });
  if (!typed || typed.licenseCode !== "Type3" || !typed.url.endsWith("/d.jpg")) throw new Error("제3유형 사진 선택");
  console.log("[petmap] tourapi self-check ok");
}

module.exports = {
  contentIdOf,
  plainText,
  httpUrl,
  imageUrl,
  imageCaption,
  captionHtml,
  licenseKind,
  isSizedImage,
  isUsablePhoto,
  isRich,
  PET_FIELDS,
  VERBATIM_PET_FIELDS,
  PET_EMPTY,
  petConditionsFromItem,
  mapLinks,
  imageSize,
  readCache,
  loadOrFetch,
  summarize,
  selfCheck,
};

if (require.main === module && process.argv.includes("--self-check")) selfCheck();
