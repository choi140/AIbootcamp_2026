/* dashboard.js — 대시보드(index.html) 로직 */
(() => {
  let state = { filter: "safe", search: "", entries: [] };
  const TITLES = { safe: "현재 입수 가능 지역", caution: "주의가 필요한 지역", danger: "출입 금지 지역" };

  function paint() {
    renderSummary(state.entries);
    renderList();
    document.getElementById("update-stamp").textContent = Common.nowHHMM() + " 기준 업데이트";
  }

  async function loadAll(force = false) {
    document.getElementById("update-stamp").textContent = "업데이트 중…";
    const entries = await Promise.all(
      CONFIG.BEACHES.map(async (beach) => {
        // 라이브 데이터가 나중에 도착하면 해당 해안만 갱신 후 다시 그림
        const conditions = await API.getConditions(beach, {
          force,
          onLive: (live) => {
            const entry = state.entries.find((x) => x.beach.id === beach.id);
            if (!entry) return;
            entry.conditions = live;
            entry.evalResult = Safety.evaluate(live);
            paint();
          },
        });
        return { beach, conditions, evalResult: Safety.evaluate(conditions) };
      })
    );
    state.entries = entries;
    paint();
  }

  /* 상단 요약 — 전체 해안 중 가장 위험한 곳을 대표로 표시 */
  function renderSummary(entries) {
    // 통합 안전 지수는 '기상' 기준이므로 운영 종료(closed)는 제외하고 가장 위험한 곳을 대표로 표시
    const rank = { danger: 3, caution: 2, safe: 1, closed: 0 };
    const pool = entries.filter((e) => e.evalResult.level.key !== "closed");
    const src = pool.length ? pool : entries;
    const worst = src.slice().sort((a, b) => rank[b.evalResult.level.key] - rank[a.evalResult.level.key])[0];
    const c = worst.conditions, ev = worst.evalResult;
    const st = Common.levelStyle(ev.level);

    const box = document.getElementById("summary-status");
    const icon = box.querySelector(".material-symbols-outlined");
    const iconWrap = icon.parentElement;
    icon.textContent = ev.level.key === "safe" ? "check_circle"
      : ev.level.key === "caution" ? "warning"
      : ev.level.key === "closed" ? "schedule" : "dangerous";
    icon.className = `material-symbols-outlined text-[48px]`;
    icon.style.color = st.hex;
    iconWrap.style.background = st.light;

    const headline = document.getElementById("summary-headline");
    headline.textContent = ev.headline;
    headline.style.color = st.hex;

    // 대표 지표 = 가장 위험한 해안 기준
    document.getElementById("m-wave").textContent = c.wave + " m";
    document.getElementById("m-wind").textContent = c.windSpeed + " m/s";
    document.getElementById("m-tide").textContent = `${c.phase}${c.currentHeight != null ? " (" + c.currentHeight + "cm)" : ""}`;

    const advBox = document.getElementById("m-advisory-box");
    const adv = document.getElementById("m-advisory");
    if (c.advisory) {
      adv.textContent = c.advisory + " 발효 중";
      advBox.className = "bg-error-container/20 p-4 rounded-2xl border border-error/10";
      adv.className = "text-[15px] font-black text-error";
      advBox.querySelector(".material-symbols-outlined").parentElement.className = "flex items-center gap-2 mb-2 text-error";
    } else {
      adv.textContent = "특보 없음";
      advBox.className = "bg-safe-green/10 p-4 rounded-2xl border border-safe-green/10";
      adv.className = "text-[15px] font-black text-safe-green";
      advBox.querySelector(".material-symbols-outlined").parentElement.className = "flex items-center gap-2 mb-2 text-safe-green";
    }
  }

  /* 해안 카드 목록 */
  function renderList() {
    const list = document.getElementById("coast-list");
    const q = state.search.trim();
    let items = state.entries.filter((e) => {
      // 운영 종료(closed)는 '출입 금지' 탭에 함께 노출
      const key = e.evalResult.level.key === "closed" ? "danger" : e.evalResult.level.key;
      if (key !== state.filter) return false; // 선택한 등급만 표시
      if (q && !(e.beach.name.includes(q) || e.beach.region.includes(q))) return false;
      return true;
    });
    // 안전 → 주의 → 위험 → 운영종료 순
    const rank = { safe: 1, caution: 2, danger: 3, closed: 4 };
    items.sort((a, b) => rank[a.evalResult.level.key] - rank[b.evalResult.level.key]);

    document.getElementById("coast-title").textContent = TITLES[state.filter] || "해안 목록";
    document.getElementById("coast-count").textContent = `(${items.length}곳)`;
    if (!items.length) {
      list.innerHTML = `<div class="text-center text-outline py-10 text-sm">조건에 맞는 해안이 없습니다.</div>`;
      return;
    }
    list.innerHTML = items.map(cardHtml).join("");
  }

  function cardHtml(e) {
    const { beach: b, conditions: c, evalResult: ev } = e;
    const st = Common.levelStyle(ev.level);
    const badgeIcon = ev.level.key === "safe"
      ? `<span class="w-2 h-2 bg-white rounded-full"></span>`
      : ev.level.key === "closed"
      ? `<span class="material-symbols-outlined text-[18px]">schedule</span>`
      : `<span class="material-symbols-outlined text-[18px]">warning</span>`;
    const gray = (ev.level.key === "danger" || ev.level.key === "closed") ? "grayscale-[30%]" : "";
    const arrow = c.waveTrend === "up" ? " ↑" : "";
    const waveCls = ev.factors.wave === "safe" ? "text-primary" : "text-error";
    const windCls = ev.factors.wind === "safe" ? "text-primary" : "text-error";

    return `
    <div class="bg-white rounded-[28px] overflow-hidden shadow-sm border border-outline-variant/30">
      <div class="relative h-44">
        <img alt="${Common.escapeHtml(b.name)}" class="w-full h-full object-cover ${gray}" src="${b.image}" loading="lazy" decoding="async" onerror="this.style.background='#c2c7cf';this.removeAttribute('src')"/>
        <div class="absolute top-4 left-4">
          <div class="text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg text-[13px] font-black" style="background:${st.hex}">
            ${badgeIcon} ${ev.level.label}
          </div>
        </div>
        <div class="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm">
          <span class="text-[13px] font-bold text-primary">수온 ${c.waterTemp}°C</span>
        </div>
      </div>
      <div class="p-6">
        <div class="flex justify-between items-start mb-5">
          <div>
            <h3 class="text-[20px] font-black text-primary mb-1">${Common.escapeHtml(b.name)}</h3>
            <div class="flex items-center gap-1 text-on-surface-variant text-[13px] font-medium">
              <span class="material-symbols-outlined text-[16px]">location_on</span>${Common.escapeHtml(b.region)}
            </div>
          </div>
          <a href="tel:${b.phone}" class="w-12 h-12 bg-surface-container rounded-2xl flex items-center justify-center text-primary active:scale-95 transition-transform">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">call</span>
          </a>
        </div>
        <div class="grid grid-cols-3 gap-2 py-4 border-y border-surface-variant/40 mb-6">
          <div class="text-center border-r border-outline-variant/20">
            <div class="text-[10px] text-outline font-bold mb-1">물때</div>
            <div class="text-[14px] font-black text-primary">${c.phase}</div>
          </div>
          <div class="text-center border-r border-outline-variant/20">
            <div class="text-[10px] text-outline font-bold mb-1">파고</div>
            <div class="text-[14px] font-black ${waveCls}">${c.wave}m${arrow}</div>
          </div>
          <div class="text-center">
            <div class="text-[10px] text-outline font-bold mb-1">풍속</div>
            <div class="text-[14px] font-black ${windCls}">${c.windSpeed}m/s${arrow}</div>
          </div>
        </div>
        <a href="detail.html?beach=${b.id}" class="w-full bg-primary-container text-white py-4 rounded-2xl font-black text-[16px] shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          실시간 안전 데이터 상세 보기
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </a>
      </div>
    </div>`;
  }

  function bindTabs() {
    document.querySelectorAll("#tabs .tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.filter = btn.dataset.filter;
        document.querySelectorAll("#tabs .tab").forEach((b) => {
          const active = b === btn;
          b.className = "tab flex-none px-6 py-3 rounded-full text-[14px] " +
            (active ? "bg-primary text-white font-black shadow-md" : "bg-white text-on-surface-variant border border-outline-variant/30 font-bold");
        });
        renderList();
      });
    });
    document.getElementById("search").addEventListener("input", (e) => { state.search = e.target.value; renderList(); });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindTabs();
    if (!API.hasBackend()) console.info("ℹ️ 백엔드(Apps Script) 미연결 — 샘플 데이터로 동작합니다.");
    Common.startAutoRefresh(loadAll); // 5분 자동 갱신
  });
})();
