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
  easylaw: "https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1809&ccfNo=2&cciNo=2&cnpClsNo=1",
};
const FINE = "공고 제2023-71호는 자연공원법 제86조와 시행령 제46조에 따른 과태료를 1차 60만원, 2차 100만원, 3차 200만원으로 적습니다.";
const BAN = "국립공원공단 금지행위 공고는 공원생태계에 영향을 미칠 수 있는 개(장애인복지법 제40조 장애인 보조견 제외)·고양이의 입장을 제한합니다.";

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
function accessNotice(place) {
  const name = String(place && place.name || "");
  const status = petAccessStatus(place);
  if (/북한산국립공원/.test(name)) {
    return {
      status: "restricted",
      badge: "출입 제한",
      heading: "반려동물 출입 제한",
      label: "반려동물 출입 제한(시범 탐방로 2구간만 예약제 허용)",
      detail: BAN + " " + FINE + " 예외로 적힌 북한산 구간은 북한산초등학교~백화사, 북한산성 제2주차장 입구~수구정 화장실입니다. 사전 예약, 1인 1마리, 동물등록, 최근 1년 이내 광견병 접종 증빙이 필요하고 맹견은 입장할 수 없습니다. 2026-08-10 공지는 일시 중단되었던 이 시범사업의 운영 재개를 알립니다. 이 카드는 그 두 구간 전체가 아니라 공원 이름입니다. 동반 가능 장소로 안내하지 않습니다.",
      sources: [SOURCES.withPet, SOURCES.ban, SOURCES.resume],
    };
  }
  if (/국립공원/.test(name)) {
    return {
      status: "restricted",
      badge: "출입 제한",
      heading: "반려동물 출입 제한",
      label: "반려동물 출입 제한(장애인 보조견 제외, 공단 시범 장소만 예외)",
      detail: BAN + " " + FINE + " 국립공원공단 반려견 동행 안내의 예외는 북한산 탐방로 2구간, 계룡산 동학사야영장 하우스 2동, 가야산생태탐방원 2동입니다. 이 장소 이름은 그 세 곳의 예외 시설명과 같지 않습니다. 고캠핑 반려견 동반 목록에 있어도 동반 가능 장소로 안내하지 않습니다.",
      sources: [SOURCES.ban, SOURCES.withPet],
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
function noticeHtml(place) {
  const notice = accessNotice(place);
  if (!notice) return "";
  const links = (notice.sources || []).map((href) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(href)}</a>`).join("<br>");
  return `<aside class="access-note access-note--${notice.status}"><h2>${escapeHtml(notice.heading)}</h2><p>${escapeHtml(notice.detail)}</p>${links ? `<p class="access-src">확인 출처<br>${links}</p>` : ""}</aside>`;
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
  explicitAccess,
  petAccessStatus,
  isFilledEnrichment,
  isIndexable,
  accessNotice,
  includeInPetLists,
  noticeHtml,
  placeTitle,
};

if (typeof module === "object" && module.exports) module.exports = api;
if (typeof globalThis !== "undefined") globalThis.PetmapIndexRule = api;
