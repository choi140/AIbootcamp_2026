/* =============================================================================
 *  charts.js — 순수 SVG 차트 (외부 라이브러리 없음)
 *  - 조석 그래프: 만조/간조 이벤트를 부드러운 스플라인으로 (Deep Ocean Blue + Sky 그라데이션)
 *  - 파고 그래프: 시간대별 막대
 * =========================================================================== */

const Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";

  /* 조석 곡선 — events[{time,height}] 를 24시간 코사인 보간으로 그림 */
  function renderTide(container, cond) {
    const W = 400, H = 120;
    const events = (cond.events || []).slice().sort((a, b) => a.time.localeCompare(b.time));
    if (events.length < 2) { container.innerHTML = '<div class="text-xs text-outline p-4">조석 데이터 없음</div>'; return; }

    const minH = Math.min(...events.map((e) => e.height));
    const maxH = Math.max(...events.map((e) => e.height));
    const range = Math.max(1, maxH - minH);
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

    // 24시간을 촘촘히 샘플링하여 이벤트 사이 코사인 보간
    const pts = [];
    const evs = events.map((e) => ({ min: toMin(e.time), h: e.height, type: e.type }));
    for (let x = 0; x <= 1440; x += 20) {
      let prev = evs[0], next = evs[evs.length - 1];
      for (let i = 0; i < evs.length; i++) {
        if (evs[i].min <= x) prev = evs[i];
        if (evs[i].min > x) { next = evs[i]; break; }
      }
      let h;
      if (prev.min === next.min) h = prev.h;
      else {
        const f = (x - prev.min) / (next.min - prev.min);
        const cf = (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, f)))) / 2; // 코사인 이징
        h = prev.h + (next.h - prev.h) * cf;
      }
      const px = (x / 1440) * W;
      const py = H - 12 - ((h - minH) / range) * (H - 30);
      pts.push([px, py]);
    }

    const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const area = line + ` L${W},${H} L0,${H} Z`;

    // 현재 시각 마커
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const nowX = (nowMin / 1440) * W;
    const nowPt = pts.reduce((best, p) => (Math.abs(p[0] - nowX) < Math.abs(best[0] - nowX) ? p : best), pts[0]);

    container.innerHTML =
      `<svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 ${W} ${H}">
        <defs><linearGradient id="tideGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(12,103,128,0.28)"/>
          <stop offset="100%" stop-color="rgba(12,103,128,0.02)"/>
        </linearGradient></defs>
        <path d="${area}" fill="url(#tideGrad)"/>
        <path d="${line}" fill="none" stroke="#0c6780" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="${nowX}" y1="6" x2="${nowX}" y2="${H}" stroke="#0c6780" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>
        <circle class="animate-pulse" cx="${nowPt[0].toFixed(1)}" cy="${nowPt[1].toFixed(1)}" r="5" fill="#0c6780"/>
      </svg>`;
  }

  /* 파고 시간대별 막대 (현재 시각 강조) */
  function renderWave(container, cond) {
    const W = 400, H = 120;
    const base = num(cond.wave) || 0.5;
    const nowHour = new Date().getHours();
    // 09~21시 3시간 간격 예측(현재값 중심의 자연스러운 변동)
    const hours = [9, 12, 15, 18, 21];
    const bars = hours.map((hr, i) => {
      const delta = Math.sin((hr - 6) / 4) * 0.35 * base;
      let v = Math.max(0.1, base + delta - 0.15 + (i % 2) * 0.1);
      return { hr, v: Math.round(v * 10) / 10, current: Math.abs(hr - nowHour) <= 1 };
    });
    const maxV = Math.max(...bars.map((b) => b.v), base) * 1.2;
    const bw = 34, gap = (W - bars.length * bw) / (bars.length + 1);

    const rects = bars.map((b, i) => {
      const bh = (b.v / maxV) * (H - 30);
      const x = gap + i * (bw + gap);
      const y = H - 12 - bh;
      const fill = b.current ? "#0c6780" : "#9ccbfb";
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="4" fill="${fill}"/>
              <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#42474e" font-weight="700">${b.v}</text>`;
    }).join("");

    container.innerHTML = `<svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 ${W} ${H}">${rects}</svg>`;
  }

  function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
  return { renderTide, renderWave };
})();

if (typeof window !== "undefined") window.Charts = Charts;
