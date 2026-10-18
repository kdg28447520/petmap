#!/usr/bin/env bash
# KorPetTourService2 raw fetch for data.go.kr dataset 15135102.
# Docs: https://www.data.go.kr/data/15135102/openapi.do
#
# Operations (exact names from that dataset):
#   areaBasedList2  지역기반 관광정보조회
#   detailPetTour2  반려동물 동반여행 조회 (contentId)
#
# Call order, stopping at 950 total calls:
#   1. areaBasedList2, every page
#   2. detailPetTour2 for data/tourapi-priority-ids.txt
#   3. detailPetTour2 for other lodging (32), restaurant (39), tourist spots (12)
#
# Each response is written to its own file before the next call. Detail ids
# that already have a successful file are skipped so a later run can resume.
# Do not run this script under bash -x or set -x.

set -euo pipefail
set +x

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$ROOT"

OUT_DIR="data/tourapi-raw"
PRIORITY_FILE="data/tourapi-priority-ids.txt"
HOST_PATH="apis.data.go.kr/B551011/KorPetTourService2"
BUDGET="${TOURAPI_CALL_BUDGET:-950}"
NUM_OF_ROWS="${TOURAPI_NUM_OF_ROWS:-100}"
DELAY="${TOURAPI_FETCH_DELAY:-0.2}"
MAX_LIST_PAGES=100
MAX_DETAIL_PAGES=5

CALLS=0
SCHEME=https
STOP_REASON=completed
LIST_PAGES=0
PRIORITY_TOTAL=0
PRIORITY_FETCHED=0
PRIORITY_SKIPPED=0
OTHER_FETCHED=0
OTHER_SKIPPED=0
STARTED=0
WROTE_STATUS=0
RESULT_CODE=""
RESULT_MSG=""
TOTAL_COUNT=0
ITEM_COUNT=0
PAGE_HASH=""

BODY_FILE=$(mktemp)
META_FILE=$(mktemp)
QUEUE_FILE=$(mktemp)
cleanup() {
  rm -f "$BODY_FILE" "$META_FILE" "$QUEUE_FILE"
  find "$OUT_DIR" -name '*.partial' -delete 2>/dev/null || true
}
trap cleanup EXIT

on_exit() {
  local status=$?
  trap - EXIT
  cleanup
  if [ "$STARTED" = 1 ]; then
    if [ "$status" -ne 0 ] && [ "$STOP_REASON" = "completed" ]; then
      STOP_REASON=error
    fi
    write_fetched_at || true
  fi
  exit "$status"
}
trap on_exit EXIT

if [ -z "${TOURAPI_SERVICE_KEY:-}" ]; then
  echo "TOURAPI_SERVICE_KEY is empty. Add the repository secret TOURAPI_SERVICE_KEY (decoded data.go.kr service key) and rerun this workflow."
  exit 1
fi

python3 - << 'PY'
import os
import sys
import urllib.parse

key = os.environ.get("TOURAPI_SERVICE_KEY", "")
if key.strip() == "":
    sys.stderr.write(
        "TOURAPI_SERVICE_KEY is empty. Add the repository secret TOURAPI_SERVICE_KEY (decoded data.go.kr service key) and rerun this workflow.\n"
    )
    sys.exit(1)
if "\n" in key or "\r" in key or "\x00" in key:
    sys.stderr.write("TOURAPI_SERVICE_KEY contains a newline and cannot be used safely.\n")
    sys.exit(1)
sys.stdout.write("::add-mask::" + key + "\n")
sys.stdout.write("::add-mask::" + urllib.parse.quote(key, safe="") + "\n")
PY

if ! [[ "$BUDGET" =~ ^[0-9]+$ ]] || [ "$BUDGET" -lt 1 ]; then
  echo "TOURAPI_CALL_BUDGET must be a positive integer."
  exit 1
fi
if [ "$BUDGET" -gt 950 ]; then
  echo "TOURAPI_CALL_BUDGET ${BUDGET} is above 950; capping at 950."
  BUDGET=950
fi
if ! [[ "$NUM_OF_ROWS" =~ ^[0-9]+$ ]] || [ "$NUM_OF_ROWS" -lt 1 ] || [ "$NUM_OF_ROWS" -gt 1000 ]; then
  echo "TOURAPI_NUM_OF_ROWS must be an integer from 1 to 1000."
  exit 1
fi
if ! [[ "$DELAY" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "TOURAPI_FETCH_DELAY must be a non-negative number of seconds."
  exit 1
fi

if [ ! -f "$PRIORITY_FILE" ]; then
  echo "Missing ${PRIORITY_FILE}. Add the priority contentId list and rerun."
  exit 1
fi

if [ -L "$OUT_DIR" ]; then
  echo "data/tourapi-raw is a symlink; refusing to write."
  exit 1
fi

declare -a PRIORITY_IDS=()
declare -A IN_PRIORITY=()
while IFS= read -r line || [ -n "$line" ]; do
  cid=${line//[[:space:]]/}
  [ -n "$cid" ] || continue
  if ! [[ "$cid" =~ ^[0-9]{1,12}$ ]]; then
    echo "Ignoring a non-numeric priority id line."
    continue
  fi
  if [ -n "${IN_PRIORITY[$cid]+x}" ]; then
    continue
  fi
  IN_PRIORITY["$cid"]=1
  PRIORITY_IDS+=("$cid")
done < "$PRIORITY_FILE"
PRIORITY_TOTAL=${#PRIORITY_IDS[@]}
if [ "$PRIORITY_TOTAL" -eq 0 ]; then
  echo "Priority content id list is empty."
  exit 1
fi

echo "Schedule cron 10 15 * * * is 00:10 KST. GitHub runs that schedule only when this workflow file is on the default branch."
echo "Priority content ids: ${PRIORITY_TOTAL}. Call budget: ${BUDGET}. Page size: ${NUM_OF_ROWS}."

is_tls_failure() {
  case "$1" in
    35|51|53|54|58|59|60|64|66|77|80|82|83|90|91) return 0 ;;
    *) return 1 ;;
  esac
}

detail_saved() {
  local id="$1"
  local path="${OUT_DIR}/detailPetTour2-${id}-page-0001.json"
  [ -f "$path" ] || return 1
  python3 - "$path" << 'PY'
import json
import sys

try:
    data = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    sys.exit(1)
header = {}
if isinstance(data, dict):
    response = data.get("response")
    if isinstance(response, dict) and isinstance(response.get("header"), dict):
        header = response["header"]
code = str(header.get("resultCode", ""))
sys.exit(0 if code in {"0000", "00", "03", "0003"} else 1)
PY
}

load_meta() {
  RESULT_CODE=$(sed -n 's/^RESULT=//p' "$META_FILE" | head -n 1)
  RESULT_MSG=$(sed -n 's/^RESULT_MSG=//p' "$META_FILE" | head -n 1)
  TOTAL_COUNT=$(sed -n 's/^TOTAL=//p' "$META_FILE" | head -n 1)
  ITEM_COUNT=$(sed -n 's/^COUNT=//p' "$META_FILE" | head -n 1)
  PAGE_HASH=$(sed -n 's/^HASH=//p' "$META_FILE" | head -n 1)
  TOTAL_COUNT=${TOTAL_COUNT:-0}
  ITEM_COUNT=${ITEM_COUNT:-0}
}

pause() {
  if [ "$DELAY" != "0" ] && [ "$DELAY" != "0.0" ]; then
    sleep "$DELAY"
  fi
}

# do_request OP CANONICAL_OUT ERROR_OUT [curl data-urlencode extras...]
# returns 0 ok/nodata, 10 budget (no call), 11 quota stop, 2 fatal, 1 transport
do_request() {
  local op="$1"
  local canonical="$2"
  local error_out="$3"
  shift 3

  if [ "$CALLS" -ge "$BUDGET" ]; then
    STOP_REASON=budget
    return 10
  fi

  local attempt=1
  while [ "$attempt" -le 3 ]; do
    if [ "$CALLS" -ge "$BUDGET" ]; then
      STOP_REASON=budget
      return 10
    fi

    local url="${SCHEME}://${HOST_PATH}/${op}"
    case "$url" in
      https://apis.data.go.kr/B551011/KorPetTourService2/*|http://apis.data.go.kr/B551011/KorPetTourService2/*) ;;
      *)
        echo "Refusing to call a non-TourAPI URL."
        return 2
        ;;
    esac

    local rc=0
    local http_code
    http_code=$(
      python3 - "$BODY_FILE" "$url" "$NUM_OF_ROWS" "$@" << 'PY' | curl -s --config -
import os
import sys

body_path, url, num_of_rows = sys.argv[1], sys.argv[2], sys.argv[3]
extras = sys.argv[4:]
key = os.environ["TOURAPI_SERVICE_KEY"]

def q(value):
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'

lines = [
    "silent",
    "max-time = 60",
    "connect-timeout = 20",
    "get",
    f"output = {q(body_path)}",
    'write-out = "%{http_code}"',
    f"url = {q(url)}",
    'user-agent = "petmap-tourapi-fetch"',
    'data-urlencode = "MobileOS=ETC"',
    'data-urlencode = "MobileApp=petmap"',
    'data-urlencode = "_type=json"',
    f"data-urlencode = {q('numOfRows=' + str(num_of_rows))}",
]
if "%" in key:
    lines.append(f"data = {q('serviceKey=' + key)}")
else:
    lines.append(f"data-urlencode = {q('serviceKey=' + key)}")
for extra in extras:
    lines.append(f"data-urlencode = {q(extra)}")
sys.stdout.write("\n".join(lines) + "\n")
PY
    ) || rc=$?
    http_code=${http_code//$'\n'/}
    http_code=${http_code//$'\r'/}

    if [ "$rc" -ne 0 ] && is_tls_failure "$rc" && [ "$SCHEME" = "https" ]; then
      echo "HTTPS TLS failed for ${op} (curl exit ${rc}). Falling back to http."
      SCHEME=http
      attempt=$((attempt + 1))
      continue
    fi

    if [ "$rc" -ne 0 ] || ! [[ "$http_code" =~ ^[0-9]{3}$ ]] || [ "$http_code" = "000" ]; then
      if [ "$attempt" -ge 3 ]; then
        echo "Request failed for ${op} (curl exit ${rc}, http ${http_code:-none})."
        return 1
      fi
      echo "Transient failure for ${op} (curl exit ${rc}, http ${http_code:-none}); retrying."
      attempt=$((attempt + 1))
      pause
      continue
    fi

    CALLS=$((CALLS + 1))
    export TOURAPI_HTTP_CODE="$http_code"
    local klass
    klass=$(
      python3 - "$BODY_FILE" "$canonical" "$error_out" << 'PY'
import hashlib
import json
import os
import pathlib
import sys
import urllib.parse

body_path, canonical, error_out = sys.argv[1], sys.argv[2], sys.argv[3]
key = os.environ["TOURAPI_SERVICE_KEY"]
encoded = urllib.parse.quote(key, safe="")
raw = pathlib.Path(body_path).read_bytes()
meta_path = os.environ["TOURAPI_META_FILE"]

def redact(message):
    message = message.replace("\n", " ").replace("\r", " ")
    if key and key in message:
        message = message.replace(key, "***")
    if encoded and encoded in message:
        message = message.replace(encoded, "***")
    return message[:200]

def write_meta(result, msg, total, count, digest):
    pathlib.Path(meta_path).write_text(
        f"RESULT={result}\nRESULT_MSG={redact(msg)}\nTOTAL={total}\nCOUNT={count}\nHASH={digest}\n",
        encoding="utf-8",
    )

def save(path):
    dest = pathlib.Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_suffix(dest.suffix + ".partial")
    with partial.open("wb") as handle:
        handle.write(raw)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(partial, dest)

digest = hashlib.sha256(raw).hexdigest()
http = os.environ.get("TOURAPI_HTTP_CODE", "")
if (key and key.encode("utf-8") in raw) or (encoded and encoded.encode("utf-8") in raw):
    write_meta("leak", "response contained the service key", 0, 0, digest)
    sys.stdout.write("leak\n")
    sys.exit(0)

def rows_of(body):
    if not isinstance(body, dict):
        return []
    items = body.get("items")
    if items in (None, ""):
        return []
    if isinstance(items, list):
        return [row for row in items if isinstance(row, dict)]
    if isinstance(items, dict):
        item = items.get("item")
        if item in (None, ""):
            return []
        if isinstance(item, list):
            return [row for row in item if isinstance(row, dict)]
        if isinstance(item, dict):
            return [item]
    return []

try:
    data = json.loads(raw.decode("utf-8"))
except Exception:
    save(error_out)
    write_meta("badjson", f"http {http} body was not JSON", 0, 0, digest)
    if http == "429":
        sys.stdout.write("quota\n")
    elif http in {"500", "502", "503", "504"}:
        sys.stdout.write("retry\n")
    else:
        sys.stdout.write("fatal\n")
    sys.exit(0)

header = {}
body = {}
if isinstance(data, dict) and isinstance(data.get("response"), dict):
    response = data["response"]
    if isinstance(response.get("header"), dict):
        header = response["header"]
    if isinstance(response.get("body"), dict):
        body = response["body"]
code = str(header.get("resultCode", ""))
msg = str(header.get("resultMsg", ""))
try:
    total = int(body.get("totalCount") or 0)
except (TypeError, ValueError):
    total = 0
count = len(rows_of(body))
write_meta(code, msg, total, count, digest)

if http in {"500", "502", "503", "504"} or code in {"01", "02", "04", "05"}:
    save(error_out)
    sys.stdout.write("retry\n")
    sys.exit(0)
if http == "429" or code in {"22", "0022"}:
    save(error_out)
    sys.stdout.write("quota\n")
    sys.exit(0)
if http == "200" and code in {"0000", "00", "03", "0003"}:
    save(canonical)
    sys.stdout.write("nodata\n" if code in {"03", "0003"} else "ok\n")
    sys.exit(0)
save(error_out)
sys.stdout.write("fatal\n")
PY
    )

    load_meta
    klass=$(printf '%s\n' "$klass" | tail -n 1)

    if [ "$klass" = "leak" ]; then
      echo "Refusing to save ${op}: response contained the service key."
      return 2
    fi
    if [ "$klass" = "ok" ] || [ "$klass" = "nodata" ]; then
      pause
      return 0
    fi
    if [ "$klass" = "quota" ]; then
      echo "TourAPI quota result ${RESULT_CODE} (${RESULT_MSG}) on ${op} after ${CALLS} calls."
      STOP_REASON=quota
      return 11
    fi
    if [ "$klass" = "retry" ] && [ "$CALLS" -ge "$BUDGET" ]; then
      STOP_REASON=budget
      return 10
    fi
    if [ "$klass" = "retry" ] && [ "$attempt" -lt 3 ]; then
      echo "Retryable result ${RESULT_CODE:-http ${http_code}} for ${op}; retrying."
      attempt=$((attempt + 1))
      pause
      continue
    fi
    echo "TourAPI result ${RESULT_CODE:-none} (${RESULT_MSG:-http ${http_code}}) for ${op}."
    return 2
  done
  echo "Request failed for ${op} after retries."
  return 1
}

write_fetched_at() {
  if [ "$WROTE_STATUS" = 1 ]; then
    return 0
  fi
  WROTE_STATUS=1
  mkdir -p "$OUT_DIR"
  local kst utc detail_files
  kst=$(TZ=Asia/Seoul date +%Y-%m-%dT%H:%M:%S%z)
  utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  detail_files=$(find "$OUT_DIR" -name 'detailPetTour2-*-page-*.json' ! -path '*/errors/*' | wc -l | tr -d ' ')
  cat > "${OUT_DIR}/fetched-at.txt" << EOF
fetched_at_kst=${kst}
fetched_at_utc=${utc}
dataset=15135102
service=KorPetTourService2
docs=https://www.data.go.kr/data/15135102/openapi.do
operations=areaBasedList2,detailPetTour2
MobileOS=ETC
MobileApp=petmap
_type=json
scheme=${SCHEME}
call_budget=${BUDGET}
calls_used=${CALLS}
stop_reason=${STOP_REASON}
areaBasedList2_pages=${LIST_PAGES}
priority_ids=${PRIORITY_TOTAL}
priority_fetched=${PRIORITY_FETCHED}
priority_skipped_saved=${PRIORITY_SKIPPED}
other_order=32,39,12
other_fetched=${OTHER_FETCHED}
other_skipped_saved=${OTHER_SKIPPED}
detail_files=${detail_files}
schedule_note=GitHub runs cron only from the default branch. This workflow file is on tourapi-fetch, so 10 15 * * * (00:10 KST) does not run until the workflow is on the default branch.
EOF
  echo "Fetch status ${STOP_REASON}: calls ${CALLS}/${BUDGET}, list pages ${LIST_PAGES}, priority fetched ${PRIORITY_FETCHED} skipped ${PRIORITY_SKIPPED}, other fetched ${OTHER_FETCHED} skipped ${OTHER_SKIPPED}."
}

handle_request_status() {
  local rc="$1"
  case "$rc" in
    0) return 0 ;;
    10)
      STOP_REASON=budget
      return 10
      ;;
    11)
      STOP_REASON=quota
      return 11
      ;;
    *)
      STOP_REASON=error
      return "$rc"
      ;;
  esac
}

propagate_status() {
  local status=0
  handle_request_status "$1" && status=0 || status=$?
  if [ "$status" -eq 0 ]; then
    return 0
  fi
  if [ "$status" -eq 10 ] || [ "$status" -eq 11 ]; then
    finish_early "$STOP_REASON"
  fi
  exit "$status"
}

finish_early() {
  local why="$1"
  STOP_REASON=$why
  echo "Stopping early (${why}) at ${CALLS} calls. Saved responses stay on disk for the commit, and detail ids already saved are skipped on the next run."
  exit 0
}

mkdir -p "$OUT_DIR/errors"
STARTED=1
export TOURAPI_META_FILE="$META_FILE"

echo "Fetching areaBasedList2 (all pages)."
page=1
prev_hash=""
list_items=0
while [ "$page" -le "$MAX_LIST_PAGES" ]; do
  printf -v pad '%04d' "$page"
  canonical="${OUT_DIR}/areaBasedList2-page-${pad}.json"
  error_out="${OUT_DIR}/errors/areaBasedList2-page-${pad}.json"
  rc=0
  do_request areaBasedList2 "$canonical" "$error_out" "pageNo=${page}" || rc=$?
  propagate_status "$rc"
  LIST_PAGES=$page
  list_items=$((list_items + ITEM_COUNT))
  echo "areaBasedList2 page=${page} calls=${CALLS}/${BUDGET} scheme=${SCHEME} result=${RESULT_CODE} items=${ITEM_COUNT} totalCount=${TOTAL_COUNT}"
  if [ -n "$prev_hash" ] && [ "$PAGE_HASH" = "$prev_hash" ] && [ "$list_items" -lt "$TOTAL_COUNT" ]; then
    echo "areaBasedList2 page ${page} repeated the previous response."
    STOP_REASON=error
    exit 1
  fi
  prev_hash=$PAGE_HASH
  if [ "$ITEM_COUNT" -eq 0 ] || [ "$list_items" -ge "$TOTAL_COUNT" ] || [ "$ITEM_COUNT" -lt "$NUM_OF_ROWS" ]; then
    break
  fi
  if [ "$page" -eq "$MAX_LIST_PAGES" ]; then
    echo "areaBasedList2 did not finish within ${MAX_LIST_PAGES} pages."
    STOP_REASON=error
    exit 1
  fi
  page=$((page + 1))
done

if [ "$LIST_PAGES" -gt 0 ]; then
  for stale in "$OUT_DIR"/areaBasedList2-page-*.json; do
    [ -e "$stale" ] || continue
    base=$(basename "$stale")
    num=${base#areaBasedList2-page-}
    num=${num%.json}
    num=$((10#$num))
    if [ "$num" -gt "$LIST_PAGES" ]; then
      rm -f "$stale"
    fi
  done
fi

echo "Fetching detailPetTour2 for priority content ids."
for cid in "${PRIORITY_IDS[@]}"; do
  if detail_saved "$cid"; then
    PRIORITY_SKIPPED=$((PRIORITY_SKIPPED + 1))
    continue
  fi
  if [ "$CALLS" -ge "$BUDGET" ]; then
    finish_early budget
  fi
  page=1
  while [ "$page" -le "$MAX_DETAIL_PAGES" ]; do
    printf -v pad '%04d' "$page"
    canonical="${OUT_DIR}/detailPetTour2-${cid}-page-${pad}.json"
    error_out="${OUT_DIR}/errors/detailPetTour2-${cid}-page-${pad}.json"
    rc=0
    do_request detailPetTour2 "$canonical" "$error_out" "pageNo=${page}" "contentId=${cid}" || rc=$?
    propagate_status "$rc"
    if [ "$page" -eq 1 ]; then
      PRIORITY_FETCHED=$((PRIORITY_FETCHED + 1))
    fi
    echo "detailPetTour2 priority contentId=${cid} page=${page} calls=${CALLS}/${BUDGET} result=${RESULT_CODE} items=${ITEM_COUNT} totalCount=${TOTAL_COUNT}"
    if [ "$ITEM_COUNT" -eq 0 ] || [ $((page * NUM_OF_ROWS)) -ge "$TOTAL_COUNT" ] || [ "$ITEM_COUNT" -lt "$NUM_OF_ROWS" ]; then
      break
    fi
    page=$((page + 1))
  done
done

python3 - "$OUT_DIR" > "$QUEUE_FILE" << 'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
seen = set()
pages = sorted(path for path in root.glob("areaBasedList2-page-*.json") if path.is_file())
for path in pages:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        continue
    body = {}
    if isinstance(data, dict) and isinstance(data.get("response"), dict):
        raw_body = data["response"].get("body")
        if isinstance(raw_body, dict):
            body = raw_body
    items = body.get("items")
    rows = []
    if isinstance(items, dict):
        item = items.get("item")
        if isinstance(item, dict):
            rows = [item]
        elif isinstance(item, list):
            rows = [row for row in item if isinstance(row, dict)]
    elif isinstance(items, list):
        rows = [row for row in items if isinstance(row, dict)]
    for row in rows:
        cid = str(row.get("contentid") or row.get("contentId") or "").strip()
        ctype = str(row.get("contenttypeid") or row.get("contentTypeId") or "").strip()
        if not cid.isdigit() or cid in seen:
            continue
        seen.add(cid)
        sys.stdout.write(f"{cid}\t{ctype}\n")
PY

declare -a LODGING=() RESTAURANT=() TOURIST=()
while IFS=$'\t' read -r cid ctype; do
  [ -n "$cid" ] || continue
  if [ -n "${IN_PRIORITY[$cid]+x}" ]; then
    continue
  fi
  case "$ctype" in
    32) LODGING+=("$cid") ;;
    39) RESTAURANT+=("$cid") ;;
    12) TOURIST+=("$cid") ;;
  esac
done < "$QUEUE_FILE"

fetch_others() {
  local label="$1"
  shift
  local cid
  if [ "$#" -eq 0 ]; then
    return 0
  fi
  echo "Fetching detailPetTour2 for ${label}."
  for cid in "$@"; do
    if detail_saved "$cid"; then
      OTHER_SKIPPED=$((OTHER_SKIPPED + 1))
      continue
    fi
    if [ "$CALLS" -ge "$BUDGET" ]; then
      finish_early budget
    fi
    printf -v pad '%04d' 1
    local canonical="${OUT_DIR}/detailPetTour2-${cid}-page-${pad}.json"
    local error_out="${OUT_DIR}/errors/detailPetTour2-${cid}-page-${pad}.json"
    local rc=0
    do_request detailPetTour2 "$canonical" "$error_out" "pageNo=1" "contentId=${cid}" || rc=$?
    propagate_status "$rc"
    OTHER_FETCHED=$((OTHER_FETCHED + 1))
    echo "detailPetTour2 ${label} contentId=${cid} page=1 calls=${CALLS}/${BUDGET} result=${RESULT_CODE} items=${ITEM_COUNT} totalCount=${TOTAL_COUNT}"
    local page=2
    while [ "$page" -le "$MAX_DETAIL_PAGES" ] && [ "$ITEM_COUNT" -ge "$NUM_OF_ROWS" ] && [ $(( (page - 1) * NUM_OF_ROWS )) -lt "$TOTAL_COUNT" ]; do
      if [ "$CALLS" -ge "$BUDGET" ]; then
        finish_early budget
      fi
      printf -v pad '%04d' "$page"
      canonical="${OUT_DIR}/detailPetTour2-${cid}-page-${pad}.json"
      error_out="${OUT_DIR}/errors/detailPetTour2-${cid}-page-${pad}.json"
      rc=0
      do_request detailPetTour2 "$canonical" "$error_out" "pageNo=${page}" "contentId=${cid}" || rc=$?
      propagate_status "$rc"
      echo "detailPetTour2 ${label} contentId=${cid} page=${page} calls=${CALLS}/${BUDGET} result=${RESULT_CODE} items=${ITEM_COUNT} totalCount=${TOTAL_COUNT}"
      page=$((page + 1))
    done
  done
}

fetch_others lodging "${LODGING[@]+"${LODGING[@]}"}"
fetch_others restaurant "${RESTAURANT[@]+"${RESTAURANT[@]}"}"
fetch_others tourist "${TOURIST[@]+"${TOURIST[@]}"}"

STOP_REASON=completed
echo "Finished within the call budget."
exit 0
