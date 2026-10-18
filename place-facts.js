"use strict";

// Shows companion conditions only when a source field actually contains them.
// Missing fields stay "확인 필요". This file does not infer permission from
// the fact that a place appears in the pet-tour list.

const NEED = "확인 필요";
const PET_EMPTY = "정보 없음 — 방문 전 업체에 확인하세요";
const VERBATIM_PET_FIELDS = [
  ["acmpyTypeCd", "동반 구분"],
  ["acmpyPsblCpam", "동반 가능 동물"],
  ["acmpyNeedMtr", "동반 시 필요사항"],
  ["etcAcmpyInfo", "기타 동반 정보"],
];

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}
function usable(value) {
  const text = clean(value);
  if (!text || text === "확인 중" || text === NEED || text === "정보 없음" || /정보 없음$/.test(text) || text.includes("확인 중")) return "";
  if (text === "미확인" || text === "미확인." || text === "확인 불가" || text === "알 수 없음") return "";
  return text;
}
function httpUrl(value) {
  const text = usable(value);
  return /^https?:\/\//i.test(text) ? text : "";
}
function rulesOf(place) {
  const rules = place && place.tour && Array.isArray(place.tour.petRules) ? place.tour.petRules : [];
  return rules
    .map((rule) => ({ label: usable(rule && rule.label), value: usable(rule && rule.value) }))
    .filter((rule) => rule.value);
}
function fromRules(rules, test) {
  for (const rule of rules) {
    const text = (rule.label + " " + rule.value).trim();
    if (test(text, rule.value, rule.label)) return rule.value;
  }
  return "";
}
function rows(place) {
  const record = (place && place.enrichment) || {};
  const rules = rulesOf(place);
  const indoor = usable(record.indoorOutdoor) || fromRules(rules, (text) => /실내|실외|야외/.test(text));
  const weight = usable(record.sizeLimit) || fromRules(rules, (text) => /kg|㎏|무게|체중/.test(text));
  const count = usable(record.petCount) || fromRules(rules, (text) => /\d+\s*마리|마릿수|마리\s*까지|최대\s*\d+/.test(text));
  const fee = usable(record.extraFee) || fromRules(rules, (text) => /요금|이용료|비용/.test(text));
  const sourceText = usable(record.checkedSource);
  const homepage = httpUrl(place && place.homepage);
  const source = sourceText || homepage;
  const sourceHref = httpUrl(sourceText) || homepage;
  const checked = /^\d{4}-\d{2}-\d{2}$/.test(usable(record.checkedOn)) ? usable(record.checkedOn) : "";
  const stored = place && place.tour && Array.isArray(place.tour.petConditions) ? place.tour.petConditions : [];
  const byKey = new Map(stored.filter((item) => item && item.key).map((item) => [item.key, item]));
  const verbatim = VERBATIM_PET_FIELDS.map(([key, label]) => {
    const found = byKey.get(key);
    const value = clean(found && found.value);
    return { id: key, label: (found && clean(found.label)) || label, value: value || PET_EMPTY, href: "" };
  });
  return [
    { id: "indoorOutdoor", label: "실내·실외", value: indoor || NEED, href: "" },
    { id: "weight", label: "무게 제한", value: weight || NEED, href: "" },
    { id: "count", label: "마릿수", value: count || NEED, href: "" },
    { id: "fee", label: "추가 요금", value: fee || NEED, href: "" },
    { id: "source", label: "공식 출처", value: source || NEED, href: source ? sourceHref : "" },
    { id: "checkedOn", label: "확인일", value: checked || NEED, href: "" },
  ].concat(verbatim);
}

module.exports = { NEED, PET_EMPTY, rows, usable };
