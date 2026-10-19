"use strict";

// Companion rows are shown only when a field actually has a value.
// Empty, unknown, and code-only API values are left out. This file does not
// infer permission from the fact that a place appears in the pet-tour list.

const fs = require("node:fs");
const path = require("node:path");
const tourapi = require("./tourapi");

const NEED = "확인 필요";
const PET_EMPTY = "정보 없음 — 방문 전 업체에 확인하세요";
const EMPTY_LINE = "동반 조건은 방문 전 업체에 확인해 주세요.";
const GUIDE_DIR = path.join(__dirname, "content", "guide-bodies");
const GUIDE_FIELDS = [
  ["구분", "acmpyTypeCd", "동반 구분"],
  ["동반 가능", "acmpyPsblCpam", "동반 가능 동물"],
  ["필요", "acmpyNeedMtr", "동반 시 필요사항"],
  ["시설", "relaPosesFclty", "구비 시설"],
  ["비치", "relaFrnshPrdlst", "비치 품목"],
  ["대여", "relaRntlPrdlst", "대여 품목"],
  ["구매", "relaPurcPrdlst", "구매 가능 품목"],
  ["기타", "etcAcmpyInfo", "기타 동반 정보"],
  ["주의", "relaAcdntRiskMtr1", "주의사항"],
];
const OPTIONAL_FIELDS = [
  ["leash", "목줄"],
  ["cat", "고양이"],
  ["cage", "케이지·이동장"],
  ["petMenu", "펫 메뉴"],
  ["largeDog", "대형견"],
];

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}
function usable(value) {
  const text = clean(value);
  if (!text || text === "확인 중" || text === NEED || text === "정보 없음" || text === PET_EMPTY || /정보 없음$/.test(text) || text.includes("확인 중")) return "";
  if (text === "미확인" || text === "미확인." || text === "확인 불가" || text === "알 수 없음") return "";
  if (text === "0" || text === "-" || text === "–" || text === "없음" || text === "해당없음" || text === "해당 없음") return "";
  if (/^[0-9A-Za-z]{1,3}$/.test(text)) return "";
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
function labelId(label) {
  const found = tourapi.PET_FIELDS.find((field) => field[1] === label);
  return found ? found[0] : "rule:" + label;
}

let guideCache = null;
function guideFacts() {
  if (guideCache) return guideCache;
  const byPlace = new Map();
  const conflicts = [];
  if (!fs.existsSync(GUIDE_DIR)) {
    guideCache = { byPlace, conflicts };
    return guideCache;
  }
  const pending = new Map();
  for (const name of fs.readdirSync(GUIDE_DIR)) {
    if (!name.endsWith(".md")) continue;
    const markdown = fs.readFileSync(path.join(GUIDE_DIR, name), "utf8");
    const pattern = /\/place\/([A-Za-z0-9_-]+)\.html[^|\n]*\|[^|\n]*\|[^|\n]*\|([^|\n]+)/g;
    let match;
    while ((match = pattern.exec(markdown))) {
      const id = match[1];
      const parts = match[2].replace(/\s+/g, " ").trim().split(/\s*·\s*/);
      for (const part of parts) {
        const labeled = part.match(/^(구분|동반 가능|필요|시설|비치|대여|구매|기타|주의)\s*:\s*(.+)$/);
        if (!labeled) continue;
        const spec = GUIDE_FIELDS.find((field) => field[0] === labeled[1]);
        const value = usable(labeled[2]);
        if (!spec || !value) continue;
        if (!pending.has(id)) pending.set(id, new Map());
        const fields = pending.get(id);
        if (!fields.has(spec[1])) fields.set(spec[1], { id: spec[1], label: spec[2], values: new Map() });
        const row = fields.get(spec[1]);
        if (!row.values.has(value)) row.values.set(value, new Set());
        row.values.get(value).add(name);
      }
    }
  }
  for (const [id, fields] of pending) {
    const rows = [];
    for (const row of fields.values()) {
      if (row.values.size !== 1) {
        conflicts.push(id + " " + row.label);
        continue;
      }
      rows.push({ id: row.id, label: row.label, value: [...row.values.keys()][0], href: "" });
    }
    if (rows.length) byPlace.set(id, rows);
  }
  guideCache = { byPlace, conflicts };
  return guideCache;
}

function pushRow(rows, seen, row) {
  const value = usable(row.value);
  if (!value) return;
  const stamp = row.label + "\n" + value;
  if (seen.has(stamp)) return;
  seen.add(stamp);
  rows.push({ id: row.id, label: row.label, value, href: row.href || "" });
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
  const out = [];
  const seen = new Set();
  const taken = new Set();
  function add(row) {
    const before = out.length;
    pushRow(out, seen, row);
    if (out.length !== before) taken.add(row.id);
  }
  add({ id: "indoorOutdoor", label: "실내·실외", value: indoor, href: "" });
  add({ id: "weight", label: "무게 제한", value: weight, href: "" });
  add({ id: "count", label: "마릿수", value: count, href: "" });
  add({ id: "fee", label: "추가 요금", value: fee, href: "" });
  add({ id: "source", label: "공식 출처", value: source, href: source ? sourceHref : "" });
  add({ id: "checkedOn", label: "확인일", value: checked, href: "" });
  for (const [key, label] of OPTIONAL_FIELDS) add({ id: key, label, value: record[key], href: "" });
  for (const [key, label] of tourapi.PET_FIELDS) {
    const found = byKey.get(key);
    add({ id: key, label: (found && clean(found.label)) || label, value: found && found.value, href: "" });
  }
  for (const rule of rules) add({ id: labelId(rule.label), label: rule.label, value: rule.value, href: "" });
  const noted = guideFacts().byPlace.get(place && place.id) || [];
  for (const row of noted) {
    if (taken.has(row.id)) continue;
    add(row);
  }
  return out;
}

function legacyRealLabels(place) {
  const record = (place && place.enrichment) || {};
  const rules = rulesOf(place);
  const indoor = usable(record.indoorOutdoor) || fromRules(rules, (text) => /실내|실외|야외/.test(text));
  const weight = usable(record.sizeLimit) || fromRules(rules, (text) => /kg|㎏|무게|체중/.test(text));
  const count = usable(record.petCount) || fromRules(rules, (text) => /\d+\s*마리|마릿수|마리\s*까지|최대\s*\d+/.test(text));
  const fee = usable(record.extraFee) || fromRules(rules, (text) => /요금|이용료|비용/.test(text));
  const sourceText = usable(record.checkedSource);
  const homepage = httpUrl(place && place.homepage);
  const checked = /^\d{4}-\d{2}-\d{2}$/.test(clean(record.checkedOn)) ? clean(record.checkedOn) : "";
  const labels = new Set();
  if (indoor) labels.add("실내·실외");
  if (weight) labels.add("무게 제한");
  if (count) labels.add("마릿수");
  if (fee) labels.add("추가 요금");
  if (sourceText || homepage) labels.add("공식 출처");
  if (checked) labels.add("확인일");
  const stored = place && place.tour && Array.isArray(place.tour.petConditions) ? place.tour.petConditions : [];
  const byKey = new Map(stored.filter((item) => item && item.key).map((item) => [item.key, item]));
  for (const [key, label] of [
    ["acmpyTypeCd", "동반 구분"],
    ["acmpyPsblCpam", "동반 가능 동물"],
    ["acmpyNeedMtr", "동반 시 필요사항"],
    ["etcAcmpyInfo", "기타 동반 정보"],
  ]) {
    const found = byKey.get(key);
    if (clean(found && found.value)) labels.add((found && clean(found.label)) || label);
  }
  return labels;
}

function fieldReport(places) {
  const shown = {};
  const gained = {};
  for (const place of places) {
    const previous = legacyRealLabels(place);
    const seen = new Set();
    for (const row of rows(place)) {
      if (seen.has(row.label)) continue;
      seen.add(row.label);
      shown[row.label] = (shown[row.label] || 0) + 1;
      if (!previous.has(row.label)) gained[row.label] = (gained[row.label] || 0) + 1;
    }
  }
  return { shown, gained, guidePlaces: guideFacts().byPlace.size, conflicts: guideFacts().conflicts.slice() };
}

module.exports = { NEED, PET_EMPTY, EMPTY_LINE, rows, usable, fieldReport };
