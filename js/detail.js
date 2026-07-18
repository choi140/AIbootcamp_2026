/* detail.js — 해안 상세(detail.html) */
(() => {
  const beachId = Common.qs("beach") || "hyeopjae";
  const beach = Common.beachById(beachId) || CONFIG.BEACHES[0];
  let currentCond = null;
  let selectedChip = "";

  const REPORT_CHIPS = [
    "🌊 파도가 높아요", "🌊 파도가 잔잔해요", "🚫 출입 통제 중", "⚠️ 미끄러워요",
    "👨‍👩‍👧 사람이 많아요", "😊 한적해요", "🚗 주차 여유", "🚗 주차 혼잡",
    "🪼 해파리 발견", "🐟 해루질 최적",
  ];

  /* ── 해안 위험요인 정적 정보 ── */
  const RISKS = {
    hyeopjae: ["이안류(Rip Current) 주의: 북측 방파제 인근에서 간조 시 급격한 유속 발생 가능성이 있습니다.", "수중 암초 지대: 비양도 방향 150m 지점은 수심이 급격히 깊어지며 날카로운 암초가 많습니다."],
    jungmun: ["이안류 상습 발생: 색달 해변은 이안류 발생 빈도가 높아 입수 시 각별한 주의가 필요합니다.", "높은 파도: 외해에 직접 노출되어 파고가 빠르게 상승할 수 있습니다."],
    yongmeori: ["물때 고립 위험: 용머리해안은 만조 시 탐방로가 물에 잠겨 통제되며, 간조 시각을 반드시 확인해야 합니다.", "미끄러운 암반: 사암 절벽 탐방로가 젖으면 매우 미끄럽습니다.", "이안류 주의: 파도가 높을 때 절벽 하단에서 이안류가 발생할 수 있습니다."],
    hamdeok: ["이안류 주의: 서우봉 방향 깊은 골에서 이안류가 발생할 수 있습니다."],
    jusangjeolli: ["절벽 추락 위험: 주상절리 관람 데크 밖 접근 금지.", "파도 월파: 만조 시 파도가 절벽을 넘을 수 있습니다."],
    sagye: ["갯벌 고립: 물때를 확인하지 않으면 밀물에 고립될 수 있습니다."],
  };

  function paint(cond) {
    currentCond = cond;
    const ev = Safety.evaluate(cond);
    renderHero(cond, ev);
    renderCharts(cond);
    renderTimes(cond, ev);
    renderRisks(ev);
    renderAI(cond, ev);
    document.getElementById("update-time").textContent = Common.nowHHMM();
  }

  async function load(force = false) {
    // 캐시/샘플로 즉시 렌더 → 라이브 데이터 도착 시 다시 렌더
    const cond = await API.getConditions(beach, { force, onLive: paint });
    paint(cond);
  }

  function renderHero(c, ev) {
    document.getElementById("hero-name").textContent = beach.name;
    document.getElementById("hero-wave").textContent = c.wave + "m";
    document.getElementById("hero-wind").textContent = c.windSpeed + "m/s";
    document.getElementById("hero-tide").textContent = c.phase;
    document.getElementById("hero-water").textContent = c.waterTemp + "°C";
    document.getElementById("data-org").textContent = c.source;

    const badge = document.getElementById("hero-badge");
    document.getElementById("hero-badge-label").textContent = ev.level.label;
    const st = Common.levelStyle(ev.level);
    badge.classList.remove("safe-indicator");
    badge.style.background = st.hex;
  }

  function renderCharts(c) {
    Charts.renderTide(document.getElementById("tide-chart"), c);
    Charts.renderWave(document.getElementById("wave-chart"), c);
    // 조석 라벨
    const highs = c.highTides || [], lows = c.lowTides || [];
    const first = (c.events && c.events[0]) || {};
    const last = (c.events && c.events[c.events.length - 1]) || {};
    document.getElementById("tide-lo1").textContent = first.time ? `${first.time} (${first.type === "high" ? "만조" : "간조"})` : "–";
    document.getElementById("tide-lo2").textContent = last.time ? `${last.time} (${last.type === "high" ? "만조" : "간조"})` : "–";
    document.getElementById("tide-now").textContent = Common.nowHHMM();
    const trend = c.phase === "밀물" ? `${c.currentHeight ?? ""}cm 상승 중` : `${c.currentHeight ?? ""}cm 하강 중`;
    document.getElementById("tide-trend").textContent = trend;
    document.getElementById("wave-avg").textContent = `평균 ${c.wave}m`;
  }

  function renderTimes(c, ev) {
    const openEl = document.getElementById("open-hours");
    const closed = ev && ev.level.key === "closed";
    const tideGated = closed && ev.openInfo && ev.openInfo.tide;
    openEl.textContent = beach.openHours + (closed ? (tideGated ? " · 만조 통제" : " · 운영 종료") : "");
    openEl.style.color = closed ? "#ba1a1a" : "";
    document.getElementById("sunset-time").textContent = (c.sunset || "19:44") + " 이후";
  }

  function renderRisks(ev) {
    const list = RISKS[beach.id] || ["현재 특별한 정적 위험요인 정보가 없습니다. 기상 변화에 유의하세요."];
    document.getElementById("risk-list").innerHTML = list.map((t) => {
      const [head, ...rest] = t.split(":");
      const body = rest.join(":");
      return `<div class="flex items-start gap-2 text-xs"><span class="w-1.5 h-1.5 bg-error rounded-full mt-1.5 shrink-0"></span>
        <p>${body ? `<span class="font-bold">${Common.escapeHtml(head)}:</span>${Common.escapeHtml(body)}` : Common.escapeHtml(head)}</p></div>`;
    }).join("");
  }

  function renderAI(c, ev) {
    let headline, detail;
    const nextT = c.nextEvent ? c.nextEvent.time : "";
    const nextType = c.nextEvent ? (c.nextEvent.type === "high" ? "만조" : "간조") : "";
    if (ev.level.key === "closed") {
      const tideGated = ev.openInfo && ev.openInfo.tide;
      headline = tideGated
        ? "현재 만조로 탐방로가 통제되어 입수할 수 없습니다."
        : "운영 시간이 종료되어 현재 입수할 수 없습니다.";
      detail = tideGated
        ? `${beach.name}은(는) 만조 시 탐방로가 물에 잠겨 통제됩니다. 간조(썰물) 시각(${(c.lowTides && c.lowTides[0] && c.lowTides[0].time) || "물때표 확인"})에 맞춰 방문해 주세요.`
        : `이 장소의 운영 시간은 ${beach.openHours} 입니다. 운영 시간 내에 방문해 주세요. 기상 조건과 무관하게 시간 외 입수는 통제됩니다.`;
    } else if (ev.level.key === "safe") {
      headline = nextType === "간조" ? `${nextT} 간조가 시작되어 물놀이 공간이 넓어집니다.` : "현재 파도와 바람이 안정적이어 입수하기 좋습니다.";
      detail = `현재 풍향은 ${c.windDir}, 파고 ${c.wave}m로 안정적입니다. ${c.sunset || "19:44"} 일몰 전까지 물놀이를 마치는 것을 권장합니다.`;
    } else if (ev.level.key === "caution") {
      headline = "조건이 변하고 있어 주의가 필요합니다.";
      detail = `파고 ${c.wave}m · 풍속 ${c.windSpeed}m/s. ${c.advisory ? c.advisory + " 발효 중이므로 " : ""}무리한 입수는 자제하고 안전요원 지시를 따르세요.`;
    } else {
      headline = "현재 입수를 금지합니다.";
      detail = `${c.advisory ? c.advisory + " 발효, " : ""}파고 ${c.wave}m, 풍속 ${c.windSpeed}m/s로 매우 위험합니다. 해안 접근을 자제하세요.`;
    }
    document.getElementById("ai-headline").textContent = headline;
    document.getElementById("ai-detail").textContent = detail;
    document.getElementById("ai-report").innerHTML =
      `<div class="font-bold mb-1">📋 종합 안전 보고서 · 안전지수 ${ev.score}/100</div>` +
      ev.reasons.map((r) => `<div>• ${Common.escapeHtml(r)}</div>`).join("");
  }

  /* ── 제보 ── */
  function renderChips() {
    const box = document.getElementById("report-chips");
    box.innerHTML = REPORT_CHIPS.map((c) => {
      const danger = c.includes("통제") || c.includes("높아") || c.includes("해파리");
      return `<button data-chip="${Common.escapeHtml(c)}" class="chip px-3 py-1.5 bg-surface-container-low rounded-full text-xs hover:bg-secondary-container transition-colors ${danger ? "text-error" : ""}">${c}</button>`;
    }).join("");
    box.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
      selectedChip = selectedChip === b.dataset.chip ? "" : b.dataset.chip;
      box.querySelectorAll(".chip").forEach((x) => {
        const on = x.dataset.chip === selectedChip;
        x.classList.toggle("bg-secondary-container", on);
        x.classList.toggle("ring-2", on);
        x.classList.toggle("ring-secondary", on);
      });
    }));
  }

  async function loadReports() {
    const list = document.getElementById("report-list");
    list.innerHTML = `<div class="text-center text-outline text-xs py-4">불러오는 중…</div>`;
    const reports = await API.listReports(beach.name);
    if (!reports.length) { list.innerHTML = `<div class="text-center text-outline text-xs py-6">아직 제보가 없습니다. 첫 제보를 남겨보세요!</div>`; return; }
    list.innerHTML = reports.map(reportCard).join("");
    list.querySelectorAll("[data-like]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      await API.likeReport(b.dataset.like);
      loadReports();
    }));
    list.querySelectorAll("[data-abuse]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("이 제보를 신고하시겠습니까?")) return;
      await API.abuseReport(b.dataset.abuse);
      Common.toast("신고가 접수되었습니다.", "success");
      loadReports();
    }));
  }

  function reportCard(r) {
    const cat = r.category ? `<span class="font-bold text-secondary">${Common.escapeHtml(r.category)}</span> ` : "";
    return `<div class="bg-white p-4 rounded-xl border border-surface-variant shadow-sm">
      <div class="flex justify-between items-start mb-2">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-bold text-primary">${Common.escapeHtml(r.nickname)}</span>
          <span class="text-[10px] text-outline">${Common.hhmm(r.time)} | ${Common.timeAgo(r.time)}</span>
        </div>
        <button data-abuse="${r.id}" class="text-[10px] text-outline hover:text-error">신고</button>
      </div>
      <p class="text-sm mb-3">${cat}${Common.escapeHtml(r.content)}</p>
      ${r.photoUrl ? `<img src="${Common.escapeHtml(r.photoUrl)}" class="rounded-lg mb-3 max-h-40 w-full object-cover" onerror="this.remove()"/>` : ""}
      <div class="flex gap-2">
        <button data-like="${r.id}" class="flex items-center gap-1 px-3 py-1.5 bg-surface-container-low rounded-lg text-[11px] font-medium active:scale-95 transition-transform">
          <span class="material-symbols-outlined text-[14px]">thumb_up</span> 도움이 되었어요 <span class="font-bold text-secondary">${r.likes || 0}</span>
        </button>
      </div>
    </div>`;
  }

  async function submitReport() {
    const content = document.getElementById("report-content").value.trim();
    const nick = document.getElementById("report-nick").value.trim() || "익명";
    const photo = document.getElementById("report-photo").value.trim();
    if (!content && !selectedChip) { Common.toast("제보 내용 또는 카테고리를 선택하세요.", "error"); return; }
    const btn = document.getElementById("report-submit");
    btn.disabled = true; btn.textContent = "전송 중…";
    try {
      await API.addReport({ nickname: nick, beach: beach.name, category: selectedChip, content: content || selectedChip, photoUrl: photo });
      document.getElementById("report-content").value = "";
      document.getElementById("report-photo").value = "";
      selectedChip = ""; renderChips();
      Common.toast("제보가 등록되었습니다. 감사합니다!", "success");
      loadReports();
    } catch (e) {
      Common.toast("전송 실패: " + e.message, "error");
    } finally {
      btn.disabled = false; btn.textContent = "제보하기";
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.title = beach.name + " | 바당타임";
    // 히어로 배경/이름은 API 응답을 기다리지 않고 즉시 세팅 → 이미지가 데이터 fetch와 병렬로 다운로드됨
    document.getElementById("hero-bg").style.backgroundImage = `url('${beach.image}')`;
    document.getElementById("hero-name").textContent = beach.name;
    // 담당기관 전화 & 길찾기
    document.getElementById("call-btn").href = "tel:" + beach.phone;
    document.getElementById("nav-btn").addEventListener("click", async () => {
      const pos = await Common.getPosition();
      Common.kakaoDirections(beach, pos);
    });
    document.getElementById("photo-btn").addEventListener("click", () =>
      document.getElementById("report-photo").classList.toggle("hidden"));
    document.getElementById("report-submit").addEventListener("click", submitReport);
    document.getElementById("report-content").addEventListener("keydown", (e) => { if (e.key === "Enter") submitReport(); });

    renderChips();
    loadReports();
    Common.startAutoRefresh(load); // 5분 자동 갱신
  });
})();
