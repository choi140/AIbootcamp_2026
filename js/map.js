/* map.js — Leaflet 안전 지도 (map.html)
 *  · 해수욕장 위치 표시 : Leaflet + OpenStreetMap (JS 키 불필요)
 *  · 길찾기            : 카카오맵 링크 (Common.kakaoDirections)
 */
(() => {
  let map = null, userMarker = null, userPos = null;
  let entries = [];

  async function loadData() {
    entries = await Promise.all(CONFIG.BEACHES.map(async (beach) => {
      const conditions = await API.getConditions(beach);
      return { beach, conditions, evalResult: Safety.evaluate(conditions) };
    }));
    renderList();
    if (map) renderMarkers();
  }

  function initMap() {
    if (typeof L === "undefined") {
      console.info("[map] Leaflet 로드 실패 — 목록/길찾기는 정상 동작");
      return;
    }
    document.getElementById("map-fallback").style.display = "none";

    map = L.map("map", { zoomControl: true, attributionControl: true })
      .setView([33.38, 126.55], 10); // 제주 중심

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    renderMarkers();
    locate();
  }

  function renderMarkers() {
    if (!map || typeof L === "undefined") return;
    // 기존 배지 마커 제거 후 다시 그림 (자동 갱신 대비)
    if (renderMarkers._layer) map.removeLayer(renderMarkers._layer);
    const group = L.layerGroup().addTo(map);
    renderMarkers._layer = group;

    entries.forEach((e) => {
      const st = Common.levelStyle(e.evalResult.level);
      const label = `${Common.escapeHtml(e.beach.name.split(" ")[0])} ${e.evalResult.level.short}`;
      const html = `<div style="background:${st.hex};color:#fff;padding:4px 10px;border-radius:9999px;`
        + `font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3);`
        + `border:2px solid #fff;cursor:pointer;">${label}</div>`;
      const icon = L.divIcon({ html, className: "beach-badge", iconSize: null, iconAnchor: [0, 0] });
      L.marker([e.beach.lat, e.beach.lng], { icon })
        .addTo(group)
        .on("click", () => { location.href = "detail.html?beach=" + e.beach.id; });
    });
  }

  async function locate() {
    userPos = await Common.getPosition();
    if (userPos && map && typeof L !== "undefined") {
      if (userMarker) map.removeLayer(userMarker);
      const dot = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#0c6780;border:3px solid #fff;`
          + `border-radius:50%;box-shadow:0 0 0 4px rgba(12,103,128,.3);"></div>`,
        className: "user-dot", iconSize: [16, 16], iconAnchor: [8, 8],
      });
      userMarker = L.marker([userPos.lat, userPos.lng], { icon: dot }).addTo(map);
      map.setView([userPos.lat, userPos.lng], 12);
    }
    renderList();
  }

  function renderList() {
    const rank = { safe: 1, caution: 2, danger: 3, closed: 4 };
    const sorted = entries.slice().sort((a, b) => rank[a.evalResult.level.key] - rank[b.evalResult.level.key]);
    document.getElementById("coast-list").innerHTML = sorted.map((e) => {
      const { beach: b, conditions: c, evalResult: ev } = e;
      const st = Common.levelStyle(ev.level);
      const dist = Common.haversine(userPos, b);
      return `<div class="bg-white rounded-2xl border border-surface-variant p-4 flex items-center gap-3 shadow-sm">
        <div class="w-2.5 h-12 rounded-full flex-none" style="background:${st.hex}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2"><h3 class="font-bold text-primary truncate">${Common.escapeHtml(b.name)}</h3>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full flex-none" style="color:${st.hex};background:${st.light}">${ev.level.label}</span></div>
          <p class="text-xs text-on-surface-variant mt-0.5">파고 ${c.wave}m · 풍속 ${c.windSpeed}m/s${dist != null ? " · " + dist + "km" : ""}</p>
        </div>
        <div class="flex gap-1 flex-none">
          <a href="detail.html?beach=${b.id}" class="w-10 h-10 bg-surface-container rounded-xl flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[20px]">info</span></a>
          <button data-nav="${b.id}" class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white"><span class="material-symbols-outlined text-[20px]">near_me</span></button>
        </div>
      </div>`;
    }).join("");
    document.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () =>
      Common.kakaoDirections(Common.beachById(btn.dataset.nav), userPos)));
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("locate").addEventListener("click", locate);
    initMap();                          // ① 지도를 먼저 즉시 표시 (데이터 대기 X)
    Common.startAutoRefresh(loadData);  // ② 데이터는 뒤에서 로드 (즉시 1회 + 5분마다, 중복 호출 제거)
  });
})();
