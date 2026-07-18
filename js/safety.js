/* =============================================================================
 *  safety.js — 입수 가능 판단 엔진 + AI 추천
 *  판단 기준은 CONFIG.SAFETY_THRESHOLDS 상수에서만 조정합니다. (요구사항 3)
 * =========================================================================== */

const Safety = (() => {
  const T = () => CONFIG.SAFETY_THRESHOLDS;

  /**
   * 종합 안전 판정.
   * 입력: conditions {wave, windSpeed, phase, mul, advisory, ...}
   * 출력: { level(SAFETY_LEVEL), score(0~100), headline, reasons[], factors{} }
   */
  function evaluate(c) {
    const th = T();

    // 0) 운영(개장) 시간 확인 — 최우선. 시간 외에는 기상과 무관하게 입수 불가.
    // 0-a) 시각 범위형("10:00 - 19:00")
    const openInfo = checkOpen(c.openHours);
    if (openInfo && !openInfo.open) {
      return closedResult(
        openInfo.beforeOpen ? "운영 시작 전 · 입수 불가" : "운영 종료 · 입수 불가",
        [
          `운영 시간(${c.openHours}) 외 — 입수 불가능`,
          openInfo.beforeOpen ? `${openInfo.openText}부터 개장합니다.` : `${openInfo.closeText}에 운영이 종료되었습니다.`,
        ],
        openInfo
      );
    }

    // 0-b) 물때형("간조 시 개방") — 만조·밀물이면 탐방로 침수/고립으로 통제
    const tideInfo = checkTideOpen(c.openHours, c.phase);
    if (tideInfo && !tideInfo.open) {
      return closedResult(
        "만조 · 탐방로 통제(입수 불가)",
        [
          `${c.phase || "만조"} — 만조 시 탐방로가 잠겨 통제됩니다.`,
          "간조(썰물) 시각에 맞춰 방문하세요.",
        ],
        tideInfo
      );
    }

    const reasons = [];
    let danger = false, caution = false;

    // 1) 기상특보 — 최우선
    const adv = (c.advisory || "").trim();
    if (adv) {
      if (th.dangerAdvisories.some((k) => adv.includes(k))) {
        danger = true; reasons.push(`${adv} 발효 — 입수 금지`);
      } else if (th.cautionAdvisories.some((k) => adv.includes(k))) {
        caution = true; reasons.push(`${adv} 발효 — 주의 필요`);
      }
    }

    // 2) 파고
    const wave = num(c.wave);
    let waveState = "safe";
    if (wave != null) {
      if (wave > th.wave.cautionMax) { danger = true; waveState = "danger"; reasons.push(`파고 ${wave}m — 매우 높음(위험)`); }
      else if (wave > th.wave.safeMax) { caution = true; waveState = "caution"; reasons.push(`파고 ${wave}m — 다소 높음`); }
      else { reasons.push(`파고 ${wave}m — 잔잔함`); }
    }

    // 3) 풍속
    const wind = num(c.windSpeed);
    let windState = "safe";
    if (wind != null) {
      if (wind > th.wind.cautionMax) { danger = true; windState = "danger"; reasons.push(`풍속 ${wind}m/s — 강풍(위험)`); }
      else if (wind > th.wind.safeMax) { caution = true; windState = "caution"; reasons.push(`풍속 ${wind}m/s — 다소 강함`); }
      else { reasons.push(`풍속 ${wind}m/s — 양호`); }
    }

    // 4) 물때 — 간조/썰물은 수심 얕아 유리, 만조는 주의 가점
    const phase = c.phase || "";
    const isHigh = /만조|밀물/.test(phase);
    if (isHigh) { reasons.push(`${phase} — 수심 상승, 유의`); }
    else { reasons.push(`${phase || "간조"} — 수심 낮아 입수 유리`); }

    // 최종 등급
    let level;
    if (danger) level = SAFETY_LEVEL.DANGER;
    else if (caution) level = SAFETY_LEVEL.CAUTION;
    else level = SAFETY_LEVEL.SAFE;

    // 점수화 (0~100) — 파고·풍속·물때 가중
    const score = computeScore(wave, wind, isHigh, adv, th);

    return {
      level, score,
      headline: buildHeadline(level, wave, wind, adv),
      reasons,
      factors: { wave: waveState, wind: windState, tide: isHigh ? "caution" : "safe", advisory: adv ? (danger ? "danger" : "caution") : "safe" },
    };
  }

  function computeScore(wave, wind, isHigh, adv, th) {
    let s = 100;
    if (wave != null) s -= Math.min(45, (wave / th.wave.cautionMax) * 45);
    if (wind != null) s -= Math.min(35, (wind / th.wind.cautionMax) * 35);
    if (isHigh) s -= 8;
    if (adv) s -= th.dangerAdvisories.some((k) => adv.includes(k)) ? 40 : 15;
    return Math.max(1, Math.min(100, Math.round(s)));
  }

  function buildHeadline(level, wave, wind, adv) {
    if (level.key === "danger") {
      if (adv) return `위험: ${adv}`;
      if (wave != null && wave > T().wave.cautionMax) return "입수 금지: 높은 파고";
      return "입수 금지: 위험 조건";
    }
    if (level.key === "caution") {
      if (wave != null && wave > T().wave.safeMax) return "주의: 높은 파고";
      if (wind != null && wind > T().wind.safeMax) return "주의: 강한 바람";
      return "주의: 조건 변화";
    }
    return "입수 가능: 안전 조건";
  }

  /**
   * AI 추천 (요구사항 4) — 여러 해안 conditions 중 최적/위험 선정 + 사유 문장.
   * 입력: [{ beach, conditions, evalResult }]
   * 출력: { best, danger, sentence, others }
   */
  function recommend(entries) {
    const scored = entries
      .map((e) => ({ ...e, evalResult: e.evalResult || evaluate(e.conditions) }))
      .sort((a, b) => b.evalResult.score - a.evalResult.score);

    const best = scored[0];
    const danger = [...scored].reverse().find((e) => e.evalResult.level.key !== "safe") || scored[scored.length - 1];

    return {
      best,
      danger: danger && danger.beach.id !== best.beach.id ? danger : scored[scored.length - 1],
      sentence: bestSentence(best),
      dangerSentence: dangerSentence(danger),
      others: scored.slice(1),
    };
  }

  function bestSentence(e) {
    const c = e.conditions;
    const tidePart = /간조|썰물/.test(c.phase || "") ? "현재 간조로 수심이 적당하고" : `현재 ${c.phase || "물때"} 상태이며`;
    const wavePart = `파고가 ${c.wave}m로 ${c.wave <= 1 ? "낮아" : "안정적이어서"}`;
    return `${tidePart} ${wavePart} ${e.beach.name}을(를) 추천합니다.`;
  }

  function dangerSentence(e) {
    if (!e) return "";
    const c = e.conditions;
    const cause = c.advisory ? `${c.advisory} 발효 및 ` : "";
    return `${e.beach.name}은(는) ${cause}높은 파도(${c.wave}m)와 강풍(${c.windSpeed}m/s)으로 입수를 권장하지 않습니다.`;
  }

  function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

  /* CLOSED(입수 불가능) 판정 결과 공통 생성기 */
  function closedResult(headline, reasons, openInfo) {
    return {
      level: SAFETY_LEVEL.CLOSED,
      score: 0,
      headline,
      reasons,
      factors: { wave: "safe", wind: "safe", tide: "safe", advisory: "safe" },
      openInfo,
    };
  }

  /**
   * 물때형 개방 판정.
   * openHours 에 "간조"가 포함된(예: "간조 시 개방 (물때별 변동)") 장소는
   * 만조·밀물 때 탐방로가 침수되어 통제 → open:false.
   * 해당 표기가 아니면 null(물때 제한 없음).
   */
  function checkTideOpen(openHours, phase) {
    if (!openHours || !/간조/.test(String(openHours))) return null;
    const isHighTide = /만조|밀물/.test(phase || "");
    return { open: !isHighTide, tide: true, phase: phase || "" };
  }

  /**
   * 개장 시간 판정.
   * "10:00 - 19:00" 같이 시각 범위가 있으면 현재 시각과 비교해 open 여부를 반환.
   * "상시 개방", "간조 시 개방(물때별 변동)" 처럼 시각을 특정할 수 없으면 null → 시간 제한 없음.
   * 반환: { open, beforeOpen, openText, closeText } | null
   */
  function checkOpen(openHours, now = new Date()) {
    if (!openHours) return null;
    const m = String(openHours).match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);
    if (!m) return null; // 시각 범위 표기가 아니면 판정하지 않음(상시/물때별 등)

    const openMin  = (+m[1]) * 60 + (+m[2]);
    const closeMin = (+m[3]) * 60 + (+m[4]);
    const cur = now.getHours() * 60 + now.getMinutes();
    const open = cur >= openMin && cur < closeMin;

    return {
      open,
      beforeOpen: cur < openMin,
      openText:  `${m[1].padStart(2, "0")}:${m[2]}`,
      closeText: `${m[3].padStart(2, "0")}:${m[4]}`,
    };
  }

  return { evaluate, recommend, checkOpen, checkTideOpen };
})();

if (typeof window !== "undefined") window.Safety = Safety;
