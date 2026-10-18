# 장소 보강 파일

경로: `data/enrichment/places.json`

이 파일 하나만 고칩니다. 빌드(`node build.js && node guides.js`)가 행을 읽어 장소 페이지에 반영합니다. `example: true` 이거나 `publish: false` 이거나 장소 ID가 `EXAMPLE`으로 시작하면 페이지에 넣지 않고, 색인·사이트맵·광고 단위에도 넣지 않습니다. 저장소에 들어 있는 `EXAMPLE-DO-NOT-PUBLISH` 행은 그 예시입니다.

실제 행을 같은 `places` 객체에 장소 ID를 키로 추가하면, 아래 필수 다섯 칸이 기준을 통과하는 페이지만 자동으로 `index`, 사이트맵, 광고 단위를 갖습니다. 기준에 못 미치면 페이지는 그대로 두고 `noindex, follow`이며 광고 단위는 없습니다.

## 필드

장소 ID는 객체 키입니다. 값은 `data/places_part*.json`의 `id`와 같아야 합니다.

| 키 | 필수 | 적는 값 |
|---|---|---|
| `petAccess` | 색인할 때만 | `allowed`(동반 허용), `restricted`(출입 제한), `unverified`(미확인). 색인은 값이 정확히 `allowed`일 때만 |
| `indoorOutdoor` | 예 | 실내/실외. `실내`, `실외`, `야외` 중 하나를 포함 |
| `sizeLimit` | 예 | 무게·크기 제한. 예: `소형견 10kg 이하`, `제한 없음` |
| `extraFee` | 예 | 추가 요금. 없으면 `추가 요금 없음` |
| `checkedOn` | 예 | 확인일 `YYYY-MM-DD` |
| `checkedSource` | 예 | 확인 출처. 페이지·전화·공지 등 확인한 곳 |
| `leash` | 아니오 | 목줄. 비우면 타일을 만들지 않음 |
| `cat` | 아니오 | 고양이 동반 |
| `petCount` | 아니오 | 동반 마릿수 |
| `cage` | 아니오 | 케이지·이동장 |
| `petMenu` | 아니오 | 펫 전용 메뉴 |
| `largeDog` | 아니오 | 대형견 동반 |
| `example` | 아니오 | `true`면 이 행은 게시하지 않음 |
| `publish` | 아니오 | `false`면 이 행은 게시하지 않음 |

빈 문자열은 없는 칸으로 봅니다. `미확인`, `확인 중`, `정보 없음`, `확인 불가`, `알 수 없음`은 그 칸이 비어 있는 것과 같습니다.

## 색인 기준

색인 규칙은 `index-rule.js` 한 곳에만 있습니다. `build.js`, `guides.js`, 지도 페이지(`index.html`이 불러 쓰는 `/index-rule.js`)가 그 모듈만 호출합니다. `petAccess`가 `allowed`이고, 다섯 필수 칸이 모두 있으며, `checkedOn`이 `YYYY-MM-DD`이고, `indoorOutdoor`에 실내·실외·야외 중 하나가 있고, 보강 문장과 관광 개요·동반 규정을 합친 공백 없는 길이가 24자 이상일 때만 색인합니다. `restricted`와 `unverified`, 그리고 `petAccess`가 없는 행은 `noindex, follow`입니다. 이름에 `국립공원`이 있으면 `petAccess`를 `allowed`로 적어도 출입 제한이며 색인하지 않습니다. 도립공원·군립공원·자연휴양림·해수욕장은 허용으로 확인되기 전에는 미확인 안내를 보여 주고 색인하지 않습니다. 선택 칸만 채워진 페이지는 타일만 보이고 색인하지 않습니다.

## 예시 행

게시하지 않는 예시입니다. 실제 장소를 넣을 때 이 키는 그대로 두어도 됩니다.

```json
{
  "places": {
    "EXAMPLE-DO-NOT-PUBLISH": {
      "example": true,
      "petAccess": "allowed",
      "indoorOutdoor": "실내·실외",
      "sizeLimit": "소형견 10kg 이하",
      "extraFee": "추가 요금 없음",
      "leash": "목줄 착용 필수",
      "cat": "고양이 동반 불가",
      "petCount": "최대 2마리",
      "cage": "",
      "petMenu": "",
      "largeDog": "",
      "checkedOn": "2026-10-18",
      "checkedSource": "예시 행이라 페이지에 게시하지 않습니다"
    }
  }
}
```
