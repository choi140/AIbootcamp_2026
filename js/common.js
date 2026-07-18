/* =============================================================================
 *  common.js — 공용 헬퍼 (포맷, 배지, 자동갱신, 위치, 카카오맵 로더)
 * =========================================================================== */

const Common = (() => {
  const beachById = (id) => CONFIG.BEACHES.find((b) => b.id === id);
  const qs = (k) => new URLSearchParams(location.search).get(k);

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "방금 전";
    if (m < 60) return m + "분 전";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "시간 전";
    return Math.floor(h / 24) + "일 전";
  }
  function hhmm(iso) {
    const d = iso ? new Date(iso) : new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function nowHHMM() { return hhmm(); }

  /* 안전 등급 → 색상/라벨 유틸 */
  function levelStyle(level) {
    return {
      safe:    { bg: "bg-safe-green", text: "text-safe-green", ring: "border-safe-green", hex: "#2e7d32", light: "#e6f4ea" },
      caution: { bg: "bg-warning-yellow", text: "text-warning-yellow", ring: "border-warning-yellow", hex: "#f9a825", light: "#fef7e0" },
      danger:  { bg: "bg-error", text: "text-error", ring: "border-error", hex: "#ba1a1a", light: "#ffdad6" },
      closed:  { bg: "bg-outline", text: "text-outline", ring: "border-outline", hex: "#5f6368", light: "#e8eaed" },
    }[level.key];
  }

  /* 5분 자동 갱신 타이머 (요구사항 9)
   * 최초 호출은 fn(false) → 세션 캐시를 활용해 빠르게 표시,
   * 이후 주기적 갱신/재활성화 시에는 fn(true) → 백엔드에서 강제로 최신 데이터 수신 */
  function startAutoRefresh(fn) {
    fn(false);
    const id = setInterval(() => fn(true), CONFIG.REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) fn(true); });
    return () => clearInterval(id);
  }

  /* 현재 위치 */
  function getPosition() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { timeout: 6000, maximumAge: 60000 }
      );
    });
  }
  function haversine(a, b) {
    if (!a || !b) return null;
    const R = 6371, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10;
  }

  /* 카카오맵 길찾기 — 앱/웹으로 이동 (키 불필요) */
  function kakaoDirections(beach, from) {
    const name = encodeURIComponent(beach.name);
    let url;
    if (from) url = `https://map.kakao.com/link/to/${name},${beach.lat},${beach.lng}/from/현재위치,${from.lat},${from.lng}`;
    else url = `https://map.kakao.com/link/to/${name},${beach.lat},${beach.lng}`;
    window.open(url, "_blank");
  }

  /* 토스트 */
  function toast(msg, type = "info") {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "fixed left-1/2 -translate-x-1/2 bottom-40 z-[100] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl transition-all duration-300 opacity-0 pointer-events-none max-w-[90%] text-center";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = type === "error" ? "#ba1a1a" : type === "success" ? "#2e7d32" : "#002a48";
    t.style.opacity = "1"; t.style.transform = "translate(-50%, 0)";
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.style.opacity = "0"; }, 2200);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  return {
    beachById, qs, timeAgo, hhmm, nowHHMM, levelStyle, startAutoRefresh,
    getPosition, haversine, kakaoDirections, toast, escapeHtml,
  };
})();

if (typeof window !== "undefined") window.Common = Common;
