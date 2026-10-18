"use strict";

// Name-based access labels. Facts below were checked on 2026-10-18
// against the linked 국립공원공단 pages. Provincial parks, county parks,
// beaches, and recreation forests stay unverified unless a page says otherwise.
const SOURCES = {
  withPet: "https://reservation.knps.or.kr/contents/withPet.do",
  ban: "https://knps.or.kr/portal/main/contents.do?menuNo=8000377",
  resume: "https://reservation.knps.or.kr/community/board/notice/boardDetail.do?seq=29153",
  easylaw: "https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1809&ccfNo=2&cciNo=2&cnpClsNo=1"
};

const FINE = "공고 제2023-71호는 자연공원법 제86조와 시행령 제46조에 따른 과태료를 1차 60만원, 2차 100만원, 3차 200만원으로 적습니다.";
const BAN = "국립공원공단 금지행위 공고는 공원생태계에 영향을 미칠 수 있는 개(장애인복지법 제40조 장애인 보조견 제외)·고양이의 입장을 제한합니다.";

function accessNotice(name) {
  const text = String(name || "");
  if (/북한산국립공원/.test(text)) {
    return {
      tone: "limit",
      label: "반려동물 출입 제한(시범 탐방로 2구간만 예약제 허용)",
      indoorOutdoor: "야외 탐방로 2구간만 예약 후 허용. 그 밖은 출입 제한",
      weightLimit: "맹견 입장 제한. 체중 상한 숫자는 공지에 없음",
      extraFee: "사전 예약 필요. 추가 요금 액수는 공지에 없음",
      detail: BAN + " " + FINE + " 예외로 적힌 북한산 구간은 북한산초등학교~백화사, 북한산성 제2주차장 입구~수구정 화장실입니다. 사전 예약, 1인 1마리, 동물등록, 최근 1년 이내 광견병 접종 증빙이 필요하고 맹견은 입장할 수 없습니다. 2026-08-10 공지는 일시 중단되었던 이 시범사업의 운영 재개를 알립니다.",
      sources: [SOURCES.withPet, SOURCES.ban, SOURCES.resume],
      sourceLabel: "국립공원공단 예약시스템·금지행위 공고"
    };
  }
  if (/국립공원/.test(text)) {
    return {
      tone: "limit",
      label: "반려동물 출입 제한(장애인 보조견 제외, 공단 시범 장소만 예외)",
      indoorOutdoor: "국립공원 출입 제한. 예외는 북한산 탐방로 2구간, 계룡산 동학사야영장 하우스 2동, 가야산생태탐방원 2동",
      weightLimit: "미확인",
      extraFee: "미확인",
      detail: BAN + " " + FINE + " 국립공원공단 반려견 동행 안내의 예외는 북한산 탐방로 2구간, 계룡산 동학사야영장 하우스 2동, 가야산생태탐방원 2동입니다. 이 장소 이름은 그 세 곳의 예외 시설명과 같지 않습니다. 고캠핑 반려견 동반 목록에 있어도 이 제한 안내를 함께 보여 줍니다.",
      sources: [SOURCES.ban, SOURCES.withPet],
      sourceLabel: "국립공원공단 금지행위 공고·반려견 동행 안내"
    };
  }
  if (/도립공원|군립공원/.test(text)) {
    return {
      tone: "unknown",
      label: "반려동물 출입 여부 미확인(관리사무소 확인 필요)",
      indoorOutdoor: "미확인",
      weightLimit: "미확인",
      extraFee: "미확인",
      detail: "도립공원·군립공원은 자연공원법상 공원관리청이 동물 출입을 제한할 수 있습니다. 2026-10-18에 울산시·밀양시·양산시 공원 공지를 찾았으나 가지산도립공원·신불산군립공원의 허용이나 금지를 적은 문장은 확인하지 못했습니다. 이 장소의 출입 여부는 미확인입니다.",
      sources: [SOURCES.easylaw],
      sourceLabel: ""
    };
  }
  if (/자연휴양림/.test(text)) {
    return {
      tone: "unknown",
      label: "반려동물 출입 여부 미확인(휴양림 관리소 확인 필요)",
      indoorOutdoor: "미확인",
      weightLimit: "미확인",
      extraFee: "미확인",
      detail: "자연휴양림은 시설마다 반려견 동반 규정이 다릅니다. 이 장소의 실내·야외, 무게 제한, 추가 요금은 관리소 공식 안내에서 확인하지 못했습니다.",
      sources: [],
      sourceLabel: ""
    };
  }
  if (/해수욕장/.test(text)) {
    return {
      tone: "unknown",
      label: "반려동물 출입 여부 미확인(관리기관 확인 필요)",
      indoorOutdoor: "미확인",
      weightLimit: "미확인",
      extraFee: "미확인",
      detail: "해수욕장 출입은 시·군 고시와 개장 기간에 따라 다릅니다. 이 장소 이름의 허용 여부는 확인하지 못했습니다.",
      sources: [],
      sourceLabel: ""
    };
  }
  return null;
}

module.exports = { accessNotice, SOURCES };
