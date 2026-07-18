/* =============================================================================
 *  api.js — 데이터 계층
 *  - Apps Script 게이트웨이로 조석/기상/제보 요청
 *  - APPS_SCRIPT_URL 미설정 시 실서비스 형태의 "샘플 데이터"로 자동 대체
 *  - 조석/기상 결과는 세션 내 캐시(2분) + 5분 자동 갱신 지원
 * =========================================================================== */

const API = (() => {
  const hasBackend = () => !!(window.CONFIG && CONFIG.APPS_SCRIPT_URL);
  const cache = new Map();
  const CACHE_TTL = 2 * 60 * 1000;
  const FETCH_TIMEOUT = 8 * 1000; // 백엔드 무응답 시 8초 후 중단 → 샘플로 폴백

  // 타임아웃이 걸린 fetch (Apps Script가 느리거나 응답 없을 때 무한 대기 방지)
  async function fetchWithTimeout(url, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function callGet(params) {
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetchWithTimeout(url.toString(), { method: "GET" });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "API error");
    return j.data;
  }

  async function callPost(payload) {
    // text/plain → CORS 프리플라이트 회피 (Apps Script 권장 패턴)
    const res = await fetchWithTimeout(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "API error");
    return j.data;
  }

  /* 세션스토리지 캐시 — 페이지 이동/새로고침 간에도 최근 데이터를 공유해 재요청을 줄임 */
  function sessionRead(k) {
    try { const s = sessionStorage.getItem(k); return s ? JSON.parse(s) : null; }
    catch (_) { return null; }
  }
  function sessionWrite(k, obj) { try { sessionStorage.setItem(k, JSON.stringify(obj)); } catch (_) {} }

  // 개장 시간 판정용(요구사항: 운영 시간 외 입수 불가) — 항상 최신 설정값 부여
  function withOpenHours(beach, cond) { cond.openHours = beach.openHours; return cond; }

  // 백엔드에서 라이브 데이터 수신 (실패 시 샘플로 대체)
  async function fetchLive(beach) {
    try {
      const bundle = await callGet({
        action: "bundle", idx: beach.idx,
        nx: beach.grid.nx, ny: beach.grid.ny,
      });
      return normalizeConditions(beach, bundle);
    } catch (err) {
      console.warn("[API] 백엔드 실패, 샘플로 대체:", err.message);
      return sampleConditions(beach);
    }
  }

  /* ── 해안별 실시간 조석+기상 번들 ───────────────────────────────────────
   *  Stale-While-Revalidate:
   *   · 캐시/샘플을 "즉시" 반환해 화면이 곧바로 뜨게 하고,
   *   · 백엔드 라이브 데이터가 도착하면 opts.onLive(cond)로 화면을 갱신한다.
   *  → 백엔드가 느리거나(Apps Script) 응답이 없어도 로딩이 8초씩 멈추지 않는다.
   *  opts.onLive 미지정 시에는 기존처럼 라이브(실패 시 샘플)를 기다려 반환(하위 호환). */
  async function getConditions(beach, opts = {}) {
    const key = "cond_" + beach.id;
    const skey = "badatime:" + key;

    // 세션 캐시를 메모리로 승격 → 페이지를 새로 열어도 즉시 표시
    if (!cache.has(key)) {
      const s = sessionRead(skey);
      if (s) cache.set(key, s);
    }
    const hit = cache.get(key);
    const fresh = hit && Date.now() - hit.t < CACHE_TTL;

    // 백엔드 미연결 → 샘플만 사용
    if (!hasBackend()) {
      if (hit) return withOpenHours(beach, hit.v);
      const v = sampleConditions(beach);
      cache.set(key, { t: Date.now(), v });
      sessionWrite(skey, { t: Date.now(), v });
      return withOpenHours(beach, v);
    }

    // 캐시가 신선하고 강제 갱신이 아니면 즉시 반환 (네트워크 요청 없음)
    if (fresh && !opts.force) return withOpenHours(beach, hit.v);

    // 라이브 데이터 요청 (백그라운드) → 도착 시 캐시 갱신
    const livePromise = fetchLive(beach).then((v) => {
      cache.set(key, { t: Date.now(), v });
      sessionWrite(skey, { t: Date.now(), v });
      return v;
    });

    // 즉시 보여줄 기준값: 이전 캐시 > 샘플
    const baseline = hit ? hit.v : sampleConditions(beach);

    if (opts.onLive) {
      // 화면을 막지 않고, 라이브가 도착하면 콜백으로 갱신
      livePromise.then((v) => opts.onLive(withOpenHours(beach, v)));
      return withOpenHours(beach, baseline);
    }
    // 콜백이 없으면 라이브(실패 시 샘플)를 기다려 반환
    return withOpenHours(beach, await livePromise);
  }

  function normalizeConditions(beach, bundle) {
    const tide = bundle.tide || {};
    const weather = (bundle.weather && bundle.weather.available) ? bundle.weather : null;
    const sample = sampleConditions(beach); // 결측 보강용

    return {
      beachId: beach.id,
      live: true,
      // 조석
      mul: tide.mul || sample.mul,
      phase: tide.phase || sample.phase,
      currentHeight: tide.currentHeight != null ? tide.currentHeight : sample.currentHeight,
      highTides: (tide.highTides && tide.highTides.length) ? tide.highTides : sample.highTides,
      lowTides: (tide.lowTides && tide.lowTides.length) ? tide.lowTides : sample.lowTides,
      events: (tide.events && tide.events.length) ? tide.events : sample.events,
      nextEvent: tide.nextEvent || sample.nextEvent,
      sunrise: tide.sunrise || sample.sunrise,
      sunset: tide.sunset || sample.sunset,
      station: tide.station || beach.name,
      // 기상 (기상청 우선, 없으면 badatime/샘플)
      waterTemp: (tide.waterTemp != null) ? tide.waterTemp : sample.waterTemp,
      temp: weather && weather.temp != null ? weather.temp : sample.temp,
      windSpeed: weather && weather.windSpeed != null ? weather.windSpeed : sample.windSpeed,
      windDir: weather && weather.windDir ? weather.windDir : sample.windDir,
      wave: sample.wave,            // 파고: 공공 파고API 연동 전까지 추정치
      waveTrend: sample.waveTrend,
      advisory: sample.advisory,    // 기상특보
      source: tide.source ? (tide.source + (weather ? " · 기상청" : "")) : sample.source,
      fetchedAt: new Date().toISOString(),
    };
  }

  /* ── 제보 ───────────────────────────────────────────────────────────── */
  async function listReports(beachName) {
    if (!hasBackend()) return sampleReports(beachName);
    try {
      return await callGet({ action: "reports", beach: beachName || "" });
    } catch (err) {
      console.warn("[API] 제보 조회 실패:", err.message);
      return sampleReports(beachName);
    }
  }

  async function addReport(report) {
    if (!hasBackend()) {
      const stored = JSON.parse(localStorage.getItem("localReports") || "[]");
      const rec = Object.assign({ id: "local_" + Date.now(), time: new Date().toISOString(), likes: 0, abuse: 0 }, report);
      stored.unshift(rec);
      localStorage.setItem("localReports", JSON.stringify(stored));
      return rec;
    }
    return callPost(Object.assign({ action: "addReport" }, report));
  }

  async function likeReport(id) {
    if (!hasBackend() || String(id).startsWith("local_")) return bumpLocal(id, "likes");
    return callPost({ action: "likeReport", id });
  }
  async function abuseReport(id) {
    if (!hasBackend() || String(id).startsWith("local_")) return bumpLocal(id, "abuse");
    return callPost({ action: "reportAbuse", id });
  }
  function bumpLocal(id, field) {
    const stored = JSON.parse(localStorage.getItem("localReports") || "[]");
    const r = stored.find((x) => x.id === id);
    if (r) { r[field] = (r[field] || 0) + 1; localStorage.setItem("localReports", JSON.stringify(stored)); }
    return r || { id };
  }

  /* ── 샘플(폴백) 데이터 생성 — 해안별로 결정론적이라 새로고침해도 일관됨 ── */
  function seeded(id) {
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
    const hour = new Date().getHours();
    return { h: Math.abs(h), hour };
  }

  function sampleConditions(beach) {
    const { h, hour } = seeded(beach.id);
    // 해안별 특성 (디자인 시안 값 반영)
    const profiles = {
      hamdeok:      { wave: 0.8, wind: 3.2, temp: 26, water: 24.2, phase: "밀물", mul: "8물", advisory: "" },
      hyeopjae:     { wave: 0.4, wind: 3.2, temp: 25, water: 19.2, phase: "썰물", mul: "11물", advisory: "" },
      jungmun:      { wave: 2.8, wind: 12.0, temp: 24, water: 22.0, phase: "만조", mul: "9물", advisory: "풍랑주의보" },
      jusangjeolli: { wave: 1.2, wind: 8.5, temp: 24, water: 21.5, phase: "간조", mul: "9물", advisory: "" },
      yongmeori:    { wave: 1.5, wind: 9.0, temp: 23, water: 21.0, phase: "간조", mul: "10물", advisory: "" },
      sagye:        { wave: 1.0, wind: 6.5, temp: 25, water: 21.0, phase: "썰물", mul: "11물", advisory: "" },
    };
    const p = profiles[beach.id] || { wave: 1.0, wind: 6, temp: 24, water: 21, phase: "밀물", mul: "7물", advisory: "" };

    // 오늘 만조/간조 시각 (관측소 공통 근사 + 해안별 소폭 편차)
    const off = (h % 40) - 20; // -20~19분
    const shift = (t) => {
      let [hh, mm] = t.split(":").map(Number);
      let total = hh * 60 + mm + off;
      total = (total + 1440) % 1440;
      return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
    };
    const highTides = [{ type: "high", time: shift("00:09"), height: 309 }, { type: "high", time: shift("11:56"), height: 247 }];
    const lowTides  = [{ type: "low",  time: shift("06:31"), height: 87 },  { type: "low",  time: shift("18:20"), height: 23 }];
    const events = [...highTides, ...lowTides].sort((a, b) => a.time.localeCompare(b.time));

    // 다음 이벤트
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const withMin = events.map((e) => { const [hh, mm] = e.time.split(":").map(Number); return { ...e, min: hh * 60 + mm }; });
    let next = withMin.find((e) => e.min > nowMin) || withMin[0];

    // 현재 조위 근사
    const curHeight = Math.round(50 + 120 * (0.5 + 0.5 * Math.sin((nowMin / 1440) * Math.PI * 4)));

    return {
      beachId: beach.id, live: false,
      mul: p.mul, phase: p.phase, currentHeight: curHeight,
      highTides, lowTides, events,
      nextEvent: { type: next.type, time: next.time, height: next.height },
      sunrise: "05:38", sunset: "19:44",
      station: beach.name,
      waterTemp: p.water, temp: p.temp, windSpeed: p.wind,
      windDir: ["북서풍", "북동풍", "남서풍", "서풍"][h % 4],
      wave: p.wave, waveTrend: p.wave >= 2 ? "up" : "flat",
      advisory: p.advisory,
      source: "샘플 데이터 (백엔드 미연결)",
      fetchedAt: new Date().toISOString(),
    };
  }

  function sampleReports(beachName) {
    const now = Date.now();
    const local = JSON.parse(localStorage.getItem("localReports") || "[]")
      .filter((r) => !beachName || r.beach === beachName);
    const base = [
      { id: "s1", time: new Date(now - 5 * 60000).toISOString(), nickname: "제주바다지킴이", beach: beachName || "협재 해수욕장",
        category: "🌊 파도가 높아요", content: "파도가 생각보다 높습니다. 조심하세요!", photoUrl: "", likes: 12, abuse: 0 },
      { id: "s2", time: new Date(now - 60 * 60000).toISOString(), nickname: "해루질러", beach: beachName || "협재 해수욕장",
        category: "🐟 해루질 최적", content: "지금 해루질하기 좋습니다. 물이 많이 빠졌네요.", photoUrl: "", likes: 8, abuse: 0 },
    ];
    return [...local, ...base].filter((r) => now - new Date(r.time).getTime() < CONFIG.REPORT_HIDE_AFTER_MS);
  }

  return { getConditions, listReports, addReport, likeReport, abuseReport, hasBackend, _sampleConditions: sampleConditions };
})();

if (typeof window !== "undefined") window.API = API;
