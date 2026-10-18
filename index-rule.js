"use strict";

// Single index rule for petmap. build.js, guides.js, and the map page
// (index.html) must call this module. Do not copy the decision elsewhere.
// A place is indexable only when petAccess is exactly "allowed" and the five
// enrichment fields are filled. National parks are always "restricted".

const FIELD_IDS = ["indoorOutdoor", "sizeLimit", "extraFee", "checkedOn", "checkedSource"];
const UNCONFIRMED = new Set(["미확인", "미확인.", "확인 불가", "알 수 없음"]);
const INDEX_BODY_MIN = 24;
const SOURCES = {
  withPet: "https://reservation.knps.or.kr/contents/withPet.do",
  ban: "https://knps.or.kr/portal/main/contents.do?menuNo=8000377",
  resume: "https://reservation.knps.or.kr/community/board/notice/boardDetail.do?seq=29153",
  law: "https://law.go.kr/lsLinkCommonInfo.do?lspttninfSeq=80172",
  easylaw: "https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1809&ccfNo=2&cciNo=2&cnpClsNo=1",
};
const PARK_SHORT = "국립공원은 원칙적으로 반려동물 출입이 금지돼요(자연공원법). 어기면 과태료 1차 60만 원이 부과될 수 있어요. 일부 시범 구간만 사전 예약한 반려견이 들어갈 수 있으니 국립공원공단 예약시스템에서 먼저 확인하세요. (확인일 2026-10-18)";
const PARK_BODY = [
  "국립공원은 야생동물 서식지를 보호하기 위해 개·고양이 등 반려동물의 출입을 제한해요(「자연공원법」 제29조, 시행령 제26조). 장애인 보조견은 예외예요. 어기면 과태료가 1차 60만 원, 2차 100만 원, 3차 200만 원 부과될 수 있어요.",
  "다만 국립공원공단 시범사업 구역에서는 사전 예약한 반려견만 들어갈 수 있어요. 현재 안내된 곳은 북한산 탐방로 2개 구간, 계룡산 동학사 야영장 2동, 가야산생태탐방원 2동이에요.",
  "이 장소가 공공데이터에 올라 있더라도 반려동물 동반이 허락된다는 뜻은 아니에요. 방문 전 해당 국립공원사무소에 꼭 확인하세요.",
  "출처: 국립공원공단 반려동물 출입제한 공고 제2023-71호, 국립공원공단 예약시스템 '반려견 동행' (확인일 2026-10-18)",
];

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function displayValue(value) {
  const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  if (!text || text === "확인 중" || text === "정보 없음" || /정보 없음$/.test(text) || text.includes("확인 중")) return "";
  return text;
}
function explicitAccess(record) {
  const raw = record && (record.petAccess != null ? record.petAccess : record.access);
  const text = String(raw == null ? "" : raw).trim().toLowerCase();
  if (text === "allowed" || text === "허용") return "allowed";
  if (text === "restricted" || text === "제한" || text === "금지") return "restricted";
  if (text === "unverified" || text === "미확인") return "unverified";
  return "";
}
function petAccessStatus(place) {
  const name = String(place && place.name || "");
  if (/국립공원/.test(name)) return "restricted";
  const explicit = explicitAccess(place && place.enrichment);
  if (explicit === "restricted") return "restricted";
  if (explicit === "allowed") return "allowed";
  return "unverified";
}
function isFilledEnrichment(place) {
  const record = place && place.enrichment;
  const values = FIELD_IDS.map((id) => displayValue(record && record[id]));
  if (values.some((value) => !value || UNCONFIRMED.has(value))) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values[3])) return false;
  if (!/실내|실외|야외/.test(values[0])) return false;
  const overview = place.tour && displayValue(place.tour.overview) || "";
  const pet = place.tour && Array.isArray(place.tour.petRules) ? place.tour.petRules.map((rule) => displayValue(rule && rule.value)).join("") : "";
  const body = (values.join("") + overview + pet).replace(/\s/g, "");
  return Array.from(body).length >= INDEX_BODY_MIN;
}
function isIndexable(place) {
  return petAccessStatus(place) === "allowed" && isFilledEnrichment(place);
}
// Ad exclusion is its own decision. It does not read a robots meta tag.
function adsAllowed(place) {
  if (accessNotice(place)) return false;
  if (petAccessStatus(place) !== "allowed") return false;
  return isFilledEnrichment(place);
}
function noindexReason(place) {
  if (isIndexable(place)) return "";
  if (/국립공원|도립공원|군립공원|자연휴양림|해수욕장/.test(String(place && place.name || ""))) return "named-access";
  if (petAccessStatus(place) !== "allowed") return "pet-access";
  return "incomplete-record";
}
function adExclusionReason(place) {
  if (adsAllowed(place)) return "";
  if (accessNotice(place)) return "access-notice";
  if (petAccessStatus(place) !== "allowed") return "pet-access";
  if (!isFilledEnrichment(place)) return "incomplete-record";
  return "other";
}
function accessNotice(place) {
  const name = String(place && place.name || "");
  const status = petAccessStatus(place);
  if (/국립공원/.test(name)) {
    return {
      status: "restricted",
      badge: "출입 제한",
      heading: "반려동물 출입 제한",
      label: "반려동물 출입 제한",
      detail: PARK_SHORT,
      sources: /북한산/.test(name)
        ? [SOURCES.withPet, SOURCES.ban, SOURCES.resume, SOURCES.law]
        : [SOURCES.ban, SOURCES.withPet, SOURCES.law],
    };
  }
  if (/도립공원|군립공원/.test(name)) {
    return {
      status: "unverified",
      badge: "출입 미확인",
      heading: "반려동물 출입 여부 미확인",
      label: "반려동물 출입 여부 미확인(관리사무소 확인 필요)",
      detail: "도립공원·군립공원은 자연공원법상 공원관리청이 동물 출입을 제한할 수 있습니다. 2026-10-18에 울산시·밀양시·양산시 공원 공지를 찾았으나 가지산도립공원·신불산군립공원의 허용이나 금지를 적은 문장은 확인하지 못했습니다. 이 장소의 출입 여부는 미확인이며 동반 가능 장소로 안내하지 않습니다.",
      sources: [SOURCES.easylaw],
    };
  }
  if (/자연휴양림/.test(name)) {
    return {
      status: "unverified",
      badge: "출입 미확인",
      heading: "반려동물 출입 여부 미확인",
      label: "반려동물 출입 여부 미확인(휴양림 관리소 확인 필요)",
      detail: "자연휴양림은 시설마다 반려견 동반 규정이 다릅니다. 이 장소의 실내·야외, 무게 제한, 추가 요금은 관리소 공식 안내에서 확인하지 못했습니다. 확인 전에는 동반 가능 장소로 안내하지 않습니다.",
      sources: [],
    };
  }
  if (/해수욕장/.test(name)) {
    return {
      status: "unverified",
      badge: "출입 미확인",
      heading: "반려동물 출입 여부 미확인",
      label: "반려동물 출입 여부 미확인(관리기관 확인 필요)",
      detail: "해수욕장 출입은 시·군 고시와 개장 기간에 따라 다릅니다. 이 장소 이름의 허용 여부는 확인하지 못했습니다.",
      sources: [],
    };
  }
  if (status === "restricted") {
    return {
      status: "restricted",
      badge: "출입 제한",
      heading: "반려동물 출입 제한",
      label: "반려동물 출입 제한",
      detail: "이 장소는 반려동물 출입이 제한된 것으로 기록되어 있습니다. 동반 가능 장소로 안내하지 않습니다.",
      sources: [],
    };
  }
  if (explicitAccess(place && place.enrichment) === "unverified") {
    return {
      status: "unverified",
      badge: "출입 미확인",
      heading: "반려동물 출입 여부 미확인",
      label: "반려동물 출입 여부 미확인",
      detail: "이 장소의 반려동물 출입 여부는 확인하지 못했습니다. 확인 전에는 동반 가능 장소로 안내하지 않습니다.",
      sources: [],
    };
  }
  return null;
}
function includeInPetLists(place) {
  return !accessNotice(place);
}
function paragraphs(lines) {
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}
function sourceLinks(notice) {
  const links = (notice.sources || []).map((href) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(href)}</a>`).join("<br>");
  return links ? `<p class="access-src">확인 출처<br>${links}</p>` : "";
}
function nationalParkExtra(name) {
  if (/북한산/.test(name)) {
    return `<h3>북한산은 2개 구간에서만 반려견과 걸을 수 있어요</h3><ul><li>구간: ① 서울 북한산초등학교~백화사 ② 북한산성 제2주차장 입구~수구정 화장실</li><li>조건: 국립공원공단 예약시스템에서 사전 예약, 동물등록된 반려견, 최근 1년 이내 광견병 접종 증빙, 1인당 1마리, 맹견 불가</li><li>이 두 구간 밖의 북한산 탐방로(정릉·우이동·도봉 등)는 반려견 출입이 금지돼요.</li><li>2026년 8월 10일 운영을 다시 시작했어요. 크기 제한 등 세부 조건은 예약할 때 확인하세요.</li><li>문의: 북한산국립공원 북한산성분소 02-357-9698</li><li>예약: <a href="${escapeHtml(SOURCES.withPet)}" target="_blank" rel="noopener">${escapeHtml(SOURCES.withPet)}</a></li></ul><p>출처: 국립공원공단 예약시스템(확인일 2026-10-18)</p>`;
  }
  if (/계룡산/.test(name)) {
    return paragraphs(["계룡산국립공원 탐방로는 반려견 동반이 안 돼요. 동학사 야영장의 반려견 전용 2동(하우스5·6)만 추첨 예약으로 이용할 수 있어요. (국립공원공단 예약시스템, 확인일 2026-10-18)"]);
  }
  if (/가야산/.test(name)) {
    return paragraphs(["가야산생태탐방원 '자연의집-반려견' 2동만 예약으로 이용할 수 있어요. 반려견은 지정된 구역 안에서만 활동할 수 있어요."]);
  }
  if (/월악산/.test(name)) {
    return paragraphs(["월악산국립공원은 반려견 동반 시범사업 대상이 아니에요. 야영장 포함 공원 안에는 반려견을 데려갈 수 없어요. 방문 전 공원사무소에 확인하세요."]);
  }
  return "";
}
function nationalParkHtml(place, notice) {
  const name = String(place && place.name || "");
  return `<aside class="access-note access-note--${notice.status}"><h2>${escapeHtml(notice.heading)}</h2><p>⚠️ ${escapeHtml(PARK_SHORT)}</p><h3>반려동물 동반 안내</h3>${paragraphs(PARK_BODY)}${nationalParkExtra(name)}${sourceLinks(notice)}</aside>`;
}
function noticeHtml(place) {
  const notice = accessNotice(place);
  if (!notice) return "";
  if (/국립공원/.test(String(place && place.name || ""))) return nationalParkHtml(place, notice);
  const official = (notice.sources || []).find(Boolean) || "";
  const phrase = official
    ? `동반 가능 구역·조건은 <a href="${escapeHtml(official)}" target="_blank" rel="noopener">공식 안내</a> 확인 필요`
    : "동반 가능 구역·조건은 공식 안내 확인 필요";
  return `<aside class="access-note access-note--${notice.status}"><h2>${escapeHtml(notice.heading)}</h2><p>${phrase}</p><p>${escapeHtml(notice.detail)}</p>${sourceLinks(notice)}</aside>`;
}
function placeTitle(place, region) {
  const notice = accessNotice(place);
  if (notice) return place.name + " — " + notice.heading + " · 댕냥이와 함께";
  return place.name + " — " + region + " 반려동물 동반 · 댕냥이와 함께";
}

const api = {
  FIELD_IDS,
  INDEX_BODY_MIN,
  SOURCES,
  PARK_SHORT,
  explicitAccess,
  petAccessStatus,
  isFilledEnrichment,
  isIndexable,
  adsAllowed,
  noindexReason,
  adExclusionReason,
  accessNotice,
  includeInPetLists,
  noticeHtml,
  placeTitle,
};

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.PetmapIndexRule = api;
