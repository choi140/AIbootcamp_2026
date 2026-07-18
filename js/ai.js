/* ai.js — AI 실시간 입수 최적지 추천 (ai.html) */
(() => {
  let userPos = null;
  let rec = null;
  let entries = [];

  async function analyze(force = false) {
    entries = await Promise.all(
      CONFIG.BEACHES.map(async (beach) => {
        // 라이브 데이터가 도착하면 해당 해안만 갱신하고 추천/화면 재계산
        const conditions = await API.getConditions(beach, {
          force,
          onLive: (live) => {
            const e = entries.find((x) => x.beach.id === beach.id);
            if (!e) return;
            e.conditions = live;
            e.evalResult = Safety.evaluate(live);
            rec = Safety.recommend(entries);
            render();
          },
        });
        return { beach, conditions, evalResult: Safety.evaluate(conditions) };
      })
    );
    rec = Safety.recommend(entries);
    render();
  }

  function distText(beach) {
    const d = Common.haversine(userPos, beach);
    return d != null ? `현재 위치에서 ${d}km` : beach.shortRegion;
  }

  function render() {
    const best = rec.best, c = best.conditions, ev = best.evalResult;

    // 상단 요약 문장
    document.getElementById("ai-quote").textContent = `"${rec.sentence}"`;
    document.getElementById("ai-basis").textContent =
      `기준: 조위 ${c.currentHeight ?? "–"}cm, ${c.windDir} ${c.windSpeed}m/s, 수온 ${c.waterTemp}°C`;
    document.getElementById("source-label").textContent = c.source;

    // Best 카드
    document.getElementById("best-card").innerHTML = `
      <div class="relative h-48 w-full bg-cover bg-center" style="background-image:url('${best.beach.image}')">
        <div class="absolute top-3 left-3 bg-secondary text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' 1;">check_circle</span>입수 최적
        </div>
      </div>
      <div class="p-5">
        <div class="flex justify-between items-start mb-2">
          <span class="text-on-surface-variant text-xs">${distText(best.beach)}</span>
          <span class="text-secondary font-bold text-xs">안전지수: ${ev.score}/100</span>
        </div>
        <h3 class="font-title-md text-primary text-xl mb-2">${Common.escapeHtml(best.beach.name)}</h3>
        <p class="text-on-surface-variant text-base leading-relaxed">${Common.escapeHtml(bestReason(best))}</p>
        <div class="flex gap-2 mt-4">
          <a href="detail.html?beach=${best.beach.id}" class="flex-1 border border-secondary text-secondary py-3.5 rounded-xl text-base font-bold text-center">상세 보기</a>
          <button id="best-nav" class="flex-1 bg-secondary text-white py-3.5 rounded-xl text-base font-bold shadow-sm flex items-center justify-center gap-2"><span class="material-symbols-outlined">directions</span>길 찾기</button>
        </div>
      </div>`;
    document.getElementById("best-nav").addEventListener("click", () => Common.kakaoDirections(best.beach, userPos));

    // Danger 카드
    const d = rec.danger;
    if (d && d.evalResult.level.key !== "safe") {
      const dc = d.conditions;
      document.getElementById("danger-card").classList.remove("hidden");
      document.getElementById("danger-card").innerHTML = `
        <div class="flex items-center gap-3 mb-3">
          <div class="bg-error/10 p-2 rounded-full"><span class="material-symbols-outlined text-error text-3xl" style="font-variation-settings:'FILL' 1;">warning</span></div>
          <div><h3 class="font-title-md text-error text-lg leading-none">주의: ${Common.escapeHtml(d.beach.name)}</h3><span class="text-error/70 text-[10px] font-bold uppercase mt-1 block">위험 지수 높음 · 안전지수 ${d.evalResult.score}/100</span></div>
        </div>
        <p class="text-on-surface-variant text-base mb-5 leading-relaxed"><strong class="text-on-surface">${Common.escapeHtml(rec.dangerSentence)}</strong> 인근 서핑 숙련자 외에는 접근을 자제해 주세요.</p>
        <div class="flex gap-2">
          <a href="detail.html?beach=${d.beach.id}" class="flex-1 border border-error text-error py-3 rounded-xl text-sm font-bold text-center">위험 데이터 보기</a>
          <a href="detail.html?beach=${best.beach.id}" class="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-bold text-center">안전한 대체지 확인</a>
        </div>`;
    } else {
      document.getElementById("danger-card").classList.add("hidden");
    }
  }

  function bestReason(e) {
    const c = e.conditions;
    const wind = /간조|썰물/.test(c.phase) ? `${c.windDir}을(를) 막아주는 지형 덕분에 파도가 잔잔하며, 현재 ${c.phase}으로 수심이 적당해` : `현재 파고 ${c.wave}m로 안정적이고 ${c.phase} 상태로`;
    return `${wind} 초보자 입수에 가장 좋습니다.`;
  }

  /* 질문 → 특정 해변 상태 또는 전체 순위 응답 */
  function ask(q) {
    const box = document.getElementById("ranking");
    q = (q || "").trim();
    // 특정 해변 언급 시 그 해변 답변
    const matched = CONFIG.BEACHES.find((b) => q && (q.includes(b.name) || q.includes(b.name.split(" ")[0])));
    let html = "";
    if (matched) {
      const e = [rec.best, ...rec.others].find((x) => x.beach.id === matched.id);
      const c = e.conditions, ev = e.evalResult, st = Common.levelStyle(ev.level);
      html = `<div class="flex gap-3 items-start">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-white text-lg" style="font-variation-settings:'FILL' 1;">auto_awesome</span></div>
        <div class="chat-bubble-ai p-4 rounded-2xl shadow-sm border border-outline-variant/50 max-w-[85%] bg-white">
          <p class="text-sm text-on-surface leading-relaxed"><b>${Common.escapeHtml(matched.name)}</b>은(는) 현재 <b style="color:${st.hex}">${ev.headline}</b> 상태입니다. 파고 ${c.wave}m · 풍속 ${c.windSpeed}m/s · ${c.phase}. 안전지수 ${ev.score}/100.
          <a href="detail.html?beach=${matched.id}" class="text-secondary font-bold">상세 보기 →</a></p>
        </div></div>`;
    } else {
      const ranked = [rec.best, ...rec.others].sort((a, b) => b.evalResult.score - a.evalResult.score);
      html = `<div class="flex gap-3 items-start">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-white text-lg" style="font-variation-settings:'FILL' 1;">auto_awesome</span></div>
        <div class="chat-bubble-ai p-4 rounded-2xl shadow-sm border border-outline-variant/50 max-w-[90%] bg-white w-full">
          <p class="text-sm font-bold text-primary mb-2">현재 조건 안전 순위</p>
          ${ranked.map((e, i) => {
            const st = Common.levelStyle(e.evalResult.level);
            return `<a href="detail.html?beach=${e.beach.id}" class="flex items-center justify-between py-2 border-b border-surface-variant/60 last:border-0">
              <span class="text-sm"><b>${i + 1}.</b> ${Common.escapeHtml(e.beach.name)}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="color:${st.hex};background:${st.light}">${e.evalResult.score}점 · ${e.evalResult.level.short}</span>
            </a>`;
          }).join("")}
        </div></div>`;
    }
    box.insertAdjacentHTML("beforeend", html);
    box.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // 위치 조회(최대 6초)가 AI 분석을 막지 않도록 병렬 처리 — 위치가 도착하면 거리만 다시 렌더
    Common.getPosition().then((pos) => { userPos = pos; if (rec) render(); });
    await analyze();
    const input = document.getElementById("ai-input");
    const send = () => { const v = input.value; if (!v.trim()) return; ask(v); input.value = ""; };
    document.getElementById("ai-send").addEventListener("click", send);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    Common.startAutoRefresh(analyze);
  });
})();
