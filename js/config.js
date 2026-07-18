/* =============================================================================
 *  바당타임 — 전역 설정 (CONFIG)
 * -----------------------------------------------------------------------------
 *  이 파일 하나만 수정하면 서비스가 실제 데이터로 동작합니다.
 *  각 값을 채우기 전에는 자동으로 "샘플 데이터"로 동작하므로 바로 미리보기가 됩니다.
 * =========================================================================== */

const CONFIG = {
  /* ---------------------------------------------------------------------------
   * 1) Google Apps Script 웹앱 URL  (조수 스크래핑 · 기상 프록시 · 제보 DB 게이트웨이)
   *    apps-script/Code.gs 를 배포한 뒤 나오는 /exec URL 을 붙여넣으세요.
   *    비워두면 프론트가 샘플 데이터로 동작합니다.
   * ------------------------------------------------------------------------- */
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycby-4Uw7_WD_iSWLIBNIgl3fdsfmTwCa1xLoKHZbupKoUaoC_BpNXLoHFMVroLWKQ_gz/exec", // 예: "https://script.google.com/macros/s/AKfyc.../exec"

  /* ---------------------------------------------------------------------------
   * 2) 지도 표시 : Leaflet + OpenStreetMap (키 불필요)
   *    길찾기    : 카카오맵 링크(map.kakao.com/link) — 키 없이 동작
   *    → 별도의 카카오맵 JavaScript 키가 필요 없습니다.
   * ------------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------------
   * 3) 데이터 자동 갱신 주기 (요구사항 9번: 5분)
   * ------------------------------------------------------------------------- */
  REFRESH_INTERVAL_MS: 5 * 60 * 1000,

  /* ---------------------------------------------------------------------------
   * 4) 입수 가능 판단 기준 (요구사항 3번)
   *    ★ 이 상수만 고치면 판정 로직 전체가 바뀝니다. (코드 수정 불필요)
   *    단계: 값 <= safeMax → 안전 / <= cautionMax → 주의 / 초과 → 위험
   * ------------------------------------------------------------------------- */
  SAFETY_THRESHOLDS: {
    wave:  { safeMax: 1.0, cautionMax: 2.0 },   // 파고 (m)
    wind:  { safeMax: 8.0, cautionMax: 12.0 },  // 풍속 (m/s)
    // 물때 가중치: 간조(썰물)일수록 입수/해루질 유리, 만조는 수심 깊어 주의 가점
    tide:  { highTidePenalty: 1, springTidePenalty: 1 },
    // 기상특보 발효 시 즉시 위험 처리할 특보 키워드
    dangerAdvisories: ["풍랑경보", "폭풍해일", "해일경보", "태풍"],
    cautionAdvisories: ["풍랑주의보", "강풍", "호우", "폭염"],
  },

  /* ---------------------------------------------------------------------------
   * 5) 제보 표시 규칙 (요구사항 6번)
   * ------------------------------------------------------------------------- */
  REPORT_HIDE_AFTER_MS: 24 * 60 * 60 * 1000, // 24시간 지난 제보 숨김
  REPORT_ABUSE_THRESHOLD: 3,                 // 신고 N회 이상 시 자동 숨김

  /* ---------------------------------------------------------------------------
   * 6) 해안 데이터셋
   *    idx        : badatime.com view_day.jsp?idx=___ 조석관측소 번호
   *    lat/lng    : 카카오맵 좌표
   *    phone      : 담당기관(안전) 전화
   *    org        : 데이터/관리 기관명
   *    grid(nx,ny): 기상청 동네예보 격자 (기상 프록시용)
   * ------------------------------------------------------------------------- */
  BEACHES: [
    {
      id: "hamdeok",
      name: "함덕 해수욕장",
      region: "제주특별자치도 제주시 조천읍",
      shortRegion: "제주시 조천읍",
      idx: 1213,
      lat: 33.5433, lng: 126.6694,
      phone: "064-728-3994",
      org: "제주시청 해양수산과",
      grid: { nx: 54, ny: 39 },
      image: "https://images.unsplash.com/photo-1590523278191-995cbcda646b?q=80&w=1200&auto=format&fit=crop",
      openHours: "10:00 - 19:00",
    },
    {
      id: "hyeopjae",
      name: "협재 해수욕장",
      region: "제주특별자치도 제주시 한림읍",
      shortRegion: "제주시 한림읍",
      idx: 1218,
      lat: 33.3941, lng: 126.2398,
      phone: "064-796-2114",
      org: "제주시청 한림읍사무소",
      grid: { nx: 51, ny: 38 },
      image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop",
      openHours: "10:00 - 19:00",
    },
    {
      id: "jungmun",
      name: "중문 색달 해수욕장",
      region: "제주특별자치도 서귀포시 중문동",
      shortRegion: "서귀포시 중문동",
      idx: 1226,
      lat: 33.2447, lng: 126.4103,
      phone: "064-760-4991",
      org: "서귀포시청 관광진흥과",
      grid: { nx: 51, ny: 33 },
      image: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=1200&auto=format&fit=crop",
      openHours: "10:00 - 19:00",
    },
    {
      id: "jusangjeolli",
      name: "주상절리대",
      region: "제주특별자치도 서귀포시 중문동",
      shortRegion: "서귀포시 중문동",
      idx: 1226,
      lat: 33.2380, lng: 126.4267,
      phone: "064-738-1521",
      org: "서귀포시청 세계유산본부",
      grid: { nx: 52, ny: 33 },
      image: "주상절리대.jpg",
      openHours: "09:00 - 19:30",
    },
    {
      id: "yongmeori",
      name: "용머리해안",
      region: "제주특별자치도 서귀포시 안덕면 사계리",
      shortRegion: "서귀포시 안덕면",
      idx: 1218,
      lat: 33.2317, lng: 126.3153,
      phone: "064-794-2940",
      org: "용머리해안 매표소",
      grid: { nx: 50, ny: 33 },
      image: "용머리해안.jpg",
      openHours: "간조 시 개방 (물때별 변동)",
    },
    {
      id: "sagye",
      name: "사계해변",
      region: "제주특별자치도 서귀포시 안덕면 사계리",
      shortRegion: "서귀포시 안덕면",
      idx: 1218,
      lat: 33.2262, lng: 126.3145,
      phone: "064-760-4991",
      org: "서귀포시청 해양수산과",
      grid: { nx: 50, ny: 33 },
      image: "https://images.unsplash.com/photo-1471922694854-ff1b63b20054?q=80&w=1200&auto=format&fit=crop",
      openHours: "상시 개방",
    },
  ],
};

/* 안전 등급 상수 (전역 공유) */
const SAFETY_LEVEL = {
  SAFE:    { key: "safe",    label: "입수 가능",   color: "#2e7d32", bg: "#e6f4ea", short: "안전" },
  CAUTION: { key: "caution", label: "주의",        color: "#f9a825", bg: "#fef7e0", short: "주의" },
  DANGER:  { key: "danger",  label: "입수 금지",   color: "#ba1a1a", bg: "#ffdad6", short: "위험" },
  // 운영(개장) 시간 외 — 기상과 무관하게 입수 불가
  CLOSED:  { key: "closed",  label: "입수 불가능", color: "#5f6368", bg: "#e8eaed", short: "운영종료" },
};

if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
  window.SAFETY_LEVEL = SAFETY_LEVEL;
}
