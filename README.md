# 바당타임 — 실시간 입장·해루질 안전 가이드

그동안 제주 바다를 관광하거나, 즐기고 싶을 때 물때가 맞지 않아 입장하지 못하거나 예쁜 경관을 보지 못했던 날들이 많았습니다.
이러한 문제를 해결 하기 위해 제주 바다의 실시간 물때를 연동해 간조와 만조의 시간대를 알려주고 해안의 입장 여부를 보여주게 했습니다.

실시간 해양·기상 데이터를 분석해 제주 해안의 **안전한 입장·해루질 가능 여부**를 알려주는 모바일 웹서비스입니다.
Stitch 디자인을 그대로 구현했으며 **HTML / CSS / JavaScript** 만 사용합니다. 데이터 저장은 **Google 스프레드시트 + Apps Script** 로 연동합니다.

> ✅ **키를 하나도 설정하지 않아도 "샘플 데이터"로 즉시 동작**합니다.
> 아래 설정을 채우면 순서대로 실데이터로 전환됩니다.

---

## 📁 파일 구조

```
project2/
├─ index.html            # ① 대시보드 (오늘의 안전 요약 · 해안 카드)
├─ detail.html           # ⑤ 해안 상세 (조석·파고 그래프, 안전분석, 제보, 길찾기)
├─ ai.html               # ④ AI 실시간 입수 최적지 추천
├─ map.html              # ⑦ 카카오맵 안전 지도
│  # 하단 네비게이션은 전 페이지 공통: 홈 · 지도 · AI 추천
├─ js/
│  ├─ config.js          # ★ 모든 설정(키·판단기준·해안목록) — 여기만 수정
│  ├─ tailwind-config.js # 디자인 시스템(색·타이포)
│  ├─ api.js             # 데이터 계층 (백엔드 호출 + 샘플 폴백)
│  ├─ safety.js          # ③ 입수 가능 판단 엔진 + AI 추천 로직
│  ├─ charts.js          # 순수 SVG 조석·파고 그래프
│  ├─ common.js          # 공용 헬퍼(포맷·위치·카카오·토스트)
│  ├─ dashboard.js / detail.js / ai.js / favorites.js / map.js
└─ apps-script/
   └─ Code.gs            # ⑥ Google Apps Script 백엔드 (조석·기상·제보 DB)
```

---

## 🚀 실행 방법

브라우저 보안(CORS·모듈 로드) 때문에 파일을 더블클릭하지 말고 **로컬 서버**로 여세요.

```bash
# 이 폴더에서
python -m http.server 5510
# 브라우저에서 http://localhost:5510 접속
```

배포는 GitHub Pages / Netlify / Vercel 등 **정적 호스팅** 어디든 됩니다.

---

## ⚙️ 설정 (js/config.js 한 파일)

### 1) 조수·기상·제보 백엔드 — Google Apps Script `APPS_SCRIPT_URL`

조석표(badatime) 스크래핑, 기상 API 프록시, 제보 DB를 **하나의 Apps Script 웹앱**이 담당합니다.
클라이언트에서 직접 badatime·공공API를 부르면 CORS로 막히므로 서버 역할이 반드시 필요합니다.

**설치 순서**
1. [Google Sheets](https://sheets.new) 새 문서 생성
2. 상단 **확장 프로그램 → Apps Script**
3. `apps-script/Code.gs` 전체 내용을 붙여넣기 (기존 `myFunction` 삭제)
4. (선택) 상단의 `KMA_SERVICE_KEY`, `KHOA_KEY` 에 공공데이터 키 입력
5. 함수 선택창에서 **`setupSheet` 실행** → 권한 승인 (시트에 `reports` 헤더 자동 생성)
6. **배포 → 새 배포 → 유형: 웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자**
7. 나온 **`.../exec` URL** 을 복사해 `js/config.js` 의 `APPS_SCRIPT_URL` 에 붙여넣기

> 스프레드시트 컬럼: `작성시간 · 닉네임 · 해안명 · 카테고리 · 내용 · 사진URL · 추천수 · 신고수 · id`
> 24시간 지난 제보 자동 숨김, 신고 3회 이상 자동 숨김이 서버에서 처리됩니다.

### 2) 지도·길찾기 — 키 불필요

- **지도 표시**: Leaflet + OpenStreetMap 타일을 사용하므로 별도 API 키가 필요 없습니다.
- **길찾기**: 카카오맵 링크(`map.kakao.com/link`)로 연결되며 키 없이 동작합니다.
- 즉, 카카오맵 JavaScript 키 설정 단계가 사라졌습니다.

### 3) 기상 데이터 (선택) — 기상청 단기예보

- [공공데이터포털](https://data.go.kr) → "기상청_단기예보 조회서비스" 활용신청
- 발급된 **일반 인증키(Decoding)** 를 `apps-script/Code.gs` 의 `KMA_SERVICE_KEY` 에 입력
- 미설정 시 기온·풍속은 badatime/샘플 값으로 대체됩니다.

---

## 🧠 입수 가능 판단 기준 (수정 가능)

`js/config.js` 의 `SAFETY_THRESHOLDS` **상수만** 고치면 판정 로직 전체가 바뀝니다. (요구사항 3)

```js
SAFETY_THRESHOLDS: {
  wave: { safeMax: 1.0, cautionMax: 2.0 },   // 파고(m):  ≤1.0 안전 / ≤2.0 주의 / 초과 위험
  wind: { safeMax: 8.0, cautionMax: 12.0 },  // 풍속(m/s)
  dangerAdvisories: ["풍랑경보","폭풍해일","해일경보","태풍"], // 발효 시 즉시 '입수 금지'
  cautionAdvisories: ["풍랑주의보","강풍","호우","폭염"],       // 발효 시 '주의'
}
```

**판정 규칙** (`js/safety.js`): 파고·풍속·물때·기상특보를 종합해
`입수 가능(safe)` · `주의(caution)` · `입수 금지(danger)` 세 단계 + `안전지수(0~100)` 를 계산합니다.
기상특보가 최우선이며, 간조/썰물은 수심이 낮아 입수에 유리한 것으로 가중합니다.

---

## ✅ 요구사항 대응표

| # | 요구사항 | 구현 위치 |
|---|----------|-----------|
| 1 | 실시간 조수표(물때·만조·간조·조위·다음물때·그래프) | `Code.gs getTide` (badatime 스크래핑) · `charts.js` · `detail.html` |
| 2 | 기상(풍속·풍향·기온·수온·파고·특보) | `Code.gs getWeather` · `api.js` · 대시보드/상세 |
| 3 | 입수 가능 3단계 판단 (기준 상수 분리) | `config.js SAFETY_THRESHOLDS` · `safety.js` |
| 4 | AI 추천(최적 해변 + 이유) | `safety.js recommend` · `ai.html` |
| 5 | 상세 페이지(그래프·분석·전화·길찾기 실동작) | `detail.html` · `detail.js` |
| 6 | 오늘 제보 (Sheets DB, 24h 숨김, 추천/신고) | `Code.gs` reports CRUD · `detail.js` |
| 7 | 카카오맵(현재위치·해안위치·길찾기) | `map.html` · `map.js` · `common.js` |
| 9 | 5분 자동 갱신 | `common.js startAutoRefresh` (전 페이지) |

---

## 📝 참고

- 샘플 데이터는 해안 ID 기반 결정론적 생성이라 새로고침해도 값이 일관됩니다.
- 백엔드 미연결 시 제보는 브라우저 `localStorage` 에 임시 저장됩니다(내 기기에서만 보임).
- 해안 목록·전화번호·좌표·조석관측소(idx)는 `config.js BEACHES` 에서 추가/수정하세요.
  badatime 관측소 번호는 `m.badatime.com/view_day.jsp?idx=___` 의 idx 값입니다.
