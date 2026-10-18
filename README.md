# 댕냥이와 함께

기존 지도 화면과 문구를 유지하면서, 공유·검색 엔진용 장소별 정적 HTML을 생성합니다. 저장소의 장소 데이터는 `data/places_part00.json`부터 `places_part11.json`까지 base64로 인코딩된 JSON 배열로 나뉘어 있습니다. 빌더가 배열을 합친 뒤 페이지를 만듭니다.

## 빌드

- Node.js 20 이상 필요 (npm 패키지는 설치하지 않습니다).
- OG 썸네일 PNG를 텍스트까지 렌더링해 새로 만들려면 ImageMagick `convert`와 SVG 렌더러(`rsvg-convert` 등), 한글 글꼴이 필요합니다. SVG 임시 파일을 1200×630 PNG로 변환하고 임시 SVG는 삭제합니다.
- 빌드 환경에 SVG 렌더러가 없으면 의존성 없는 PNG 발자국 배경을 생성해 빌드를 끝냅니다. 이 폴백 이미지에는 한글 문구가 그려지지 않으며, Open Graph 메타 태그의 제목·설명은 정상 제공됩니다. 이미지 안에도 문구가 필요한 경우 한글 글꼴이 설치된 SVG→PNG 변환기를 준비하세요.

```sh
node build.js
```

산출물은 기본으로 `dist/`에 생성됩니다. `--out=다른폴더`로 출력 위치를 지정할 수 있습니다. `places.json`에 `updatedAt`이 있으면 그 날짜를 사용하고, 없으면 빌드 날짜(한국 시간)를 기준일로 표시합니다. 빌드가 사용할 수 없는 개별 장소는 건너뛰고 ID·장소명·사유를 목록으로 출력합니다. 중복 ID와 경로에 사용할 수 없는 ID도 건너뜁니다.

공개할 수정 제안 이메일은 환경변수로 전달합니다. 설정하지 않으면 메인 상세와 정적 장소 페이지에 이메일 링크를 만들지 않습니다.

```sh
REPORT_EMAIL=help@example.com node build.js
```

장소 상세의 사진·개요·반려동물 동반 조건은 한국관광공사 TourAPI(국문 관광정보 서비스, KorService2)에서 빌드할 때만 받습니다. 브라우저가 이 API를 호출하지 않고, 결과는 `data/tourapi-cache.json`과 정적 HTML에 남습니다. 인증키는 `process.env.TOURAPI_SERVICE_KEY`만 읽습니다. 키가 없으면 네트워크 호출을 건너뛰고 캐시만 쓰며, 키 값은 로그에 남기지 않습니다. 사진 응답의 `cpyrhtDivCd`가 `Type1` 또는 `Type3`일 때만 이미지를 넣습니다. 값이 없거나 다른 유형이면 좌표 지도를 씁니다. 제3유형은 `object-fit: contain`과 `#F2F2F2` 배경으로 원본 비율을 유지하고, 사진 아래에 출처·라이선스 문구와 api.visitkorea.or.kr 링크를 붙입니다. 사진은 공유 이미지(OG)나 로고로 합성하지 않습니다. 모든 장소에는 상호와 주소로 만든 카카오맵·네이버 지도 검색 링크를 붙입니다.

색인 여부는 `index-rule.js`만 결정합니다. `build.js`, `guides.js`, 브라우저 지도(`index.html` → `/index-rule.js`)가 이 모듈을 같이 씁니다. 장소 보강 원본은 `data/enrichment/places.json` 한 파일입니다. 키는 장소 ID입니다. 색인하려면 `petAccess`가 `allowed`이고 필수 칸 `indoorOutdoor`(실내/실외), `sizeLimit`(무게·크기 제한), `extraFee`(추가 요금), `checkedOn`(YYYY-MM-DD), `checkedSource`(확인 출처)가 채워져야 합니다. `restricted`·`unverified`·빈 `petAccess`는 색인하지 않습니다. 이름에 `국립공원`이 있는 장소는 값을 채워도 출입 제한입니다. 선택 칸 `leash`, `cat`, `petCount`, `cage`, `petMenu`, `largeDog`는 타일만 만들고 색인 조건에는 들어가지 않습니다. 다섯 필수 칸이 모두 있고, 값이 `미확인`·`확인 중`·`정보 없음`이 아니며, 보강 문장과 관광 개요를 합친 길이가 24자 이상일 때 그 페이지는 자동으로 `index`가 됩니다. 광고 단위는 같은 레코드를 `adsAllowed()`로 따로 판단합니다. `accessNotice()`가 있는 장소(국립공원 등)는 광고 단위를 넣지 않습니다. 나머지는 `noindex, follow`입니다. 사이트맵에는 색인 대상인 `/place/` URL만 넣습니다. `example: true`, `publish: false`, ID가 `EXAMPLE`으로 시작하는 행은 게시하지 않습니다. 저장소의 `EXAMPLE-DO-NOT-PUBLISH` 행은 그 예시이며 배포 폴더로 복사하지 않습니다. 필드 설명은 `data/enrichment/SCHEMA.md`에 있습니다. 광고 스크립트와 `ads.txt`는 그대로 둡니다. 모든 상세에는 `/contact.html?place=장소ID`로 가는 `정보 정정 요청` 링크가 있습니다. 가이드 본문이 그 장소를 링크하면 상세에 `관련 가이드`가 붙습니다.

인증키 환경변수 이름은 `TOURAPI_SERVICE_KEY`입니다. [한국관광공사_국문 관광정보 서비스_GW](https://www.data.go.kr/data/15101578/openapi.do)에서 활용신청을 하면 개발계정은 자동승인됩니다. 마이페이지의 인증키 중 디코딩된 일반 인증키를 넣습니다.

```sh
TOURAPI_SERVICE_KEY='발급받은키' node build.js
```

이미 받아 둔 상세를 다시 받으려면 `node build.js --refresh-tourapi`를 사용합니다. 호출은 `detailCommon2`, `detailImage2`, `detailPetTour2`이고, contentid가 있는 TourAPI 장소만 대상입니다.

외부 스크립트/CSS에 대해 실제 파일을 가져와 SHA-384 SRI를 계산하고 출력 HTML에 주입하려면 다음 옵션을 사용합니다. 네트워크 요청에 실패한 리소스는 경고만 출력하고 `integrity` 없이 빌드를 계속합니다.

```sh
node build.js --sri
```

빌더는 생성된 모든 HTML의 `og:image` 절대 URL이 같은 도메인의 실제 PNG 파일을 가리키는지 확인하고, PNG 시그니처와 크기도 검사합니다.

## 출력

- `dist/index.html`: 기존 메인 페이지와 변경된 메타데이터
- `dist/place/{id}.html`: 장소별 정적 상세 페이지
- `dist/place/place.css`: 기존 지도 상세화면의 스타일 규칙을 추출한 공통 스타일
- `dist/og/default.png`, `stay.png`, `food.png`, `park.png`, `hospital.png`: 1200×630 공유 이미지
- `dist/sitemap.xml`: 메인 페이지, 가이드·안내 페이지, 색인 대상 `/place/` URL. 한국 날짜 기준 `lastmod`

## 광고 자리

애드센스 스크립트와 `ads.txt`는 바꾸지 않습니다. 빈 `.ad-slot`은 높이 0입니다. `data-ad-status="filled"`일 때만 위아래 여백과 ‘광고’ 표시가 생기고, 광고 250px을 포함한 자리 높이는 308px입니다.

펫맵의 첫 광고는 홈 지도 아래 장소 목록의 6번째 카드 뒤입니다. 그 문서 위치가 900px보다 위면 더 아래 카드 뒤로 옮깁니다. 지역 가이드는 두 번째 코스 뒤, 그 외 가이드는 세 번째 내용 절 뒤입니다. 헤더 바로 아래나 지도 위에는 두지 않습니다.
- `dist/robots.txt`: Sitemap 선언
- `dist/places.json`: `updatedAt`과 정규화한 장소 데이터
- `dist/data/`: 지도 앱이 읽는 원본 데이터 조각

기존 `#/place/{id}` 주소도 계속 사용할 수 있고, 목록·주변 장소·지도 마커의 상세 이동은 크롤러가 읽을 수 있는 `/place/{id}.html`을 사용합니다. 해시 URL은 레거시 공유 주소 호환을 위해 남겨 두었습니다.

## 로컬 미리보기 및 Vercel 배포

```sh
node build.js
cd dist
python3 -m http.server 8080
```

저장소의 `vercel.json`은 `node build.js && node guides.js`를 실행하고 `dist`를 정적 출력 디렉터리로 배포하도록 설정되어 있습니다. `petmap.kr` 호스트는 `https://www.petmap.kr`로 301합니다. `ads.txt`만은 리디렉션에서 빼 두어 파일 내용과 게시 경로를 바꾸지 않습니다. `http://www.petmap.kr`이 배포까지 그대로 들어오면 같은 파일의 두 번째 규칙이 `https://www.petmap.kr`로 301합니다.

HTTP를 HTTPS로 올리는 첫 단계는 Vercel 가장자리에서 처리됩니다. 대시보드에서 다음을 유지합니다.

- Production 도메인의 기본 호스트는 `www.petmap.kr`이고, `petmap.kr`은 `www.petmap.kr`로 301합니다.
- 도메인 설정에서 HTTP→HTTPS 리디렉션이 켜져 있습니다. Vercel 프로젝트는 이 리디렉션이 기본값입니다.
- 배포 후 `curl -sI http://petmap.kr/`, `curl -sI http://www.petmap.kr/`, `curl -sI https://petmap.kr/`의 `Location`이 `https://www.petmap.kr/`인지 확인합니다. HTTP를 HTTPS로 올리는 가장자리 응답은 308일 수 있습니다. `vercel.json`에 적힌 호스트 규칙(apex → www, 앱에 도달한 http www → https www)은 301입니다. 포트 80이 막힌 환경에서는 이 확인을 할 수 없습니다.

GitHub 기본 브랜치에 반영되면 Vercel이 새 빌드를 배포합니다. 배포 후 다음 주소를 확인합니다.

- `https://petmap.kr/`
- `https://petmap.kr/place/tour-2707444.html` (예시)
- `https://petmap.kr/sitemap.xml`
- `https://petmap.kr/robots.txt`

## 공유 미리보기 확인

- 카카오: [카카오 개발자센터 공유 디버거](https://developers.kakao.com/tool/debugger/sharing)에서 메인 또는 장소 URL을 입력합니다.
- 페이스북: [Sharing Debugger](https://developers.facebook.com/tools/debug/)에서 URL을 입력하고 다시 스크래핑합니다.
- 네이버: 네이버 앱/블로그 작성 화면에 URL을 실제로 붙여넣어 제목과 썸네일을 확인합니다.

장소별 이미지는 장소 1,400개마다 생성하지 않고 카테고리별 이미지 4장을 공유합니다. 크롤러의 캐시 때문에 메타 태그 수정 직후 이전 썸네일이 잠시 보일 수 있습니다.

## 유지할 항목

- 메인 `<title>`은 `댕냥이와 함께 — 반려동물 동반 전국 지도`를 유지합니다.
- Leaflet 지도 타일 주소·저작자 표시 상수와 타일 폴백 처리는 그대로 둡니다.
- 24시 동물병원 필터는 기본으로 켜집니다.
- API 키나 개인정보는 코드에 저장하지 않습니다.
