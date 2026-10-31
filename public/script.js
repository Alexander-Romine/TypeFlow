"use strict";

/* ============================================================
   typeflow — typing engine
   modes: time / words / daily
   ============================================================ */

const $ = (s) => document.querySelector(s);

/* ---------- word data ---------- */
const WORDS = (
  "the be of and a to in he have it that for they i with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line river boat sea fire land animal mother father home song run walk throw hear music teacher water paper story women road city power"
).split(/\s+/);

/* ---------- elements ---------- */
const el = {
  modes: $("#modes"),
  subbar: $("#subbar"),
  optPunct: $("#opt-punct"),
  optNums: $("#opt-nums"),
  liveWpm: $("#live-wpm"),
  liveAcc: $("#live-acc"),
  liveTime: $("#live-time"),
  livePb: $("#live-pb"),
  timeLabel: $("#time-label"),
  weakstrip: $("#weakstrip"),
  typewrap: $("#typewrap"),
  words: $("#words"),
  caret: $("#caret"),
  focusnote: $("#focusnote"),
  livegraph: $("#livegraph"),
  input: $("#mobile-input"),
  testView: $("#test-view"),
  resultsView: $("#results-view"),
  resWpm: $("#res-wpm"),
  resAcc: $("#res-acc"),
  resCons: $("#res-cons"),
  resRaw: $("#res-raw"),
  resTime: $("#res-time"),
  resChars: $("#res-chars"),
  resGraph: $("#resgraph"),
  graphTooltip: $("#graph-tooltip"),
  resultMeta: $("#result-meta"),
  pbBadge: $("#pb-badge"),
  weakPanel: $("#weak-panel"),
  heatmap: $("#heatmap"),
  practiceBtn: $("#practice-btn"),
  nextBtn: $("#next-btn"),
  repeatBtn: $("#repeat-btn"),
  modeNote: $("#modenote"),
  statStreak: $("#stat-streak"),
  liveStreak: $("#live-streak"),
  liveLeft: $("#live-left"),
  statTime: $("#stat-time"),
  statLeft: $("#stat-left"),
  resKpm: $("#res-kpm"),
  resUncorr: $("#res-uncorr"),
  optCaps: $("#opt-caps"),
  optSound: $("#opt-sound"),
  optLofi: $("#opt-lofi"),
  lofiPop: $("#lofi-pop"),
  lofiMount: $("#lofi-mount"),
  lofiBar: $("#lofi-bar"),
  lofiMin: $("#lofi-min"),
  lofiNote: $("#lofi-note"),
  lofiVolume: $("#lofi-volume"),
  lofiVolVal: $("#lofi-vol-val"),
  optTheme: $("#opt-theme"),
  soundVolume: $("#sound-volume"),
  volumeValue: $("#volume-value"),
  btnStats: $("#btn-stats"),
  btnSettings: $("#btn-settings"),
  settingsPop: $("#settings-pop"),
  logo: $("#logo"),
  dailyResult: $("#daily-result"),
  dailyStreak: $("#daily-streak"),
  shareBtn: $("#share-btn"),
  statsView: $("#stats-view"),
  statsClose: $("#stats-close"),
  statsTotals: $("#stats-totals"),
  histGraph: $("#histgraph"),
  histTooltip: $("#hist-tooltip"),
  pbCategories: $("#pb-categories"),
  pbCustomWrap: $("#pb-custom-wrap"),
  pbTable: $("#pbtable"),
  clearHistory: $("#clear-history"),
  cmdOverlay: $("#cmd-overlay"),
  cmdInput: $("#cmd-input"),
  cmdList: $("#cmd-list"),
  endBtn: $("#end-btn")
};

/* ---------- state ---------- */
const S = {
  mode: "time",
  limit: 30,
  punct: false,
  nums: false,
  caps: false,
  words: [],
  input: [],
  wordEls: [],
  boundaryOk: [],
  wi: 0,
  LH: 58,
  started: false,
  finished: false,
  startTime: 0,
  timer: null,
  keystrokes: 0,
  correctKeystrokes: 0,
  correctInText: 0,
  typedChars: 0,
  keys: {},          // per-key {t: attempts, e: errors}
  samples: [],       // per-second {wpm, raw, err}
  errsThisSec: 0,
  lastSec: 0,
  lastConfig: null,
  paused: false,
  pauseAt: 0
};

const ENDLESS = "∞";
const LIMITS = { time: [15, 30, 60, 120, ENDLESS], words: [10, 25, 50, 100, ENDLESS] };
const PB_PREFIX = "typeflow_pb_";
const HIST_KEY = "typeflow_history";
const DAILY_KEY = "typeflow_daily";
const SETTINGS_KEY = "typeflow_settings";
const SOUND_KEY = "typeflow_sound";

/* ---------- storage (safe on file://) ---------- */
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}
function pbKey() {
  const limited = LIMITS[S.mode] ? "_" + S.limit : "";
  const flags = (S.mode === "time" || S.mode === "words")
    ? ((S.punct ? "p" : "") + (S.nums ? "n" : "") + (S.caps ? "c" : "")) : "";
  return PB_PREFIX + S.mode + limited + flags;
}
function getPb() { return load(pbKey(), 0); }

/* ---------- daily challenge ---------- */
function dateKey(d) {
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}
function todayKey() { return dateKey(new Date()); }
function yesterdayKey() {
  const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d);
}
// FNV-1a string hash → 32-bit seed
function seedFromStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// mulberry32 — tiny deterministic PRNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genDaily() {
  const rng = mulberry32(seedFromStr("typeflow-" + todayKey()));
  const out = [];
  let prev = "";
  for (let i = 0; i < 50; i++) {
    let w;
    do { w = WORDS[Math.floor(rng() * WORDS.length)]; } while (w === prev);
    out.push(w); prev = w;
  }
  return out;
}
function getDailyState() {
  const st = load(DAILY_KEY, { streak: 0, last: "", best: 0, count: 0 });
  // a streak breaks if the last completed day wasn't yesterday or today
  if (st.last !== todayKey() && st.last !== yesterdayKey()) st.streak = 0;
  return st;
}
function recordDaily(wpm) {
  const st = load(DAILY_KEY, { streak: 0, last: "", best: 0, count: 0 });
  if (st.last !== todayKey()) {
    st.streak = (st.last === yesterdayKey()) ? st.streak + 1 : 1;
    st.last = todayKey();
    st.count = (st.count || 0) + 1;
  }
  if (wpm > st.best) st.best = wpm;
  save(DAILY_KEY, st);
  return st;
}

/* ---------- word generation ---------- */
function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }

function decorate(word) {
  if (S.nums && Math.random() < 0.15) {
    return String(1 + rand(9999));
  }
  if (S.caps && Math.random() < 0.18) {
    word = word[0].toUpperCase() + word.slice(1);
  }
  if (S.punct) {
    if (Math.random() < 0.12) word = word[0].toUpperCase() + word.slice(1);
    if (Math.random() < 0.22) word += pick([".", ",", "!", "?", '"', "'", "-", ";"]);
  }
  return word;
}

function genWord(previous) {
  // avoid the same word 3x in a row
  let w;
  do { w = pick(WORDS); } while (w === previous);
  return decorate(w);
}

function weakKeyList() {
  return Object.entries(S.keys)
    .filter(([, v]) => v.t >= 6 && v.e / v.t >= 0.3)
    .sort((a, b) => b[1].e / b[1].t - a[1].e / a[1].t)
    .map(([k]) => k);
}

function genWords(count) {
  const out = [];
  let prev = "";
  for (let i = 0; i < count; i++) {
    // adaptive: inject words with weak letters periodically
    if (i > 0 && i % 12 === 0) {
      const wk = weakKeyList();
      if (wk.length) {
        const key = pick(wk);
        const pool = WORDS.filter((w) => w.includes(key));
        if (pool.length) { out.push(decorate(pick(pool))); prev = out[out.length - 1]; continue; }
      }
    }
    const w = genWord(prev);
    out.push(w);
    prev = w;
  }
  return out;
}

function genPractice() {
  const wk = weakKeyList();
  const out = [];
  if (wk.length) {
    for (let i = 0; i < 30; i++) {
      const key = pick(wk);
      const pool = WORDS.filter((w) => w.includes(key));
      out.push(pool.length ? pick(pool) : pick(WORDS));
    }
  } else {
    for (let i = 0; i < 30; i++) out.push(pick(WORDS));
  }
  return out;
}

/* ---------- rendering ---------- */
function buildWordEl(word) {
  const d = document.createElement("div");
  d.className = "word";
  for (const ch of word) {
    const s = document.createElement("span");
    s.className = "letter";
    s.textContent = ch;
    d.appendChild(s);
  }
  return d;
}

function renderAll() {
  el.words.innerHTML = "";
  S.wordEls = [];
  const frag = document.createDocumentFragment();
  for (const w of S.words) {
    const d = buildWordEl(w);
    frag.appendChild(d);
    S.wordEls.push(d);
  }
  el.words.appendChild(frag);
  el.words.style.transition = "none";
  el.words.style.transform = "translateY(0)";
  // position synchronously (rAF can be throttled in background/hidden contexts),
  // then re-sync once more after layout settles (e.g. webfont swap)
  updateScroll();
  setCaret();
  requestAnimationFrame(() => {
    el.words.style.transition = "";
    S.LH = S.wordEls[0] ? S.wordEls[0].getBoundingClientRect().height : 58;
    updateScroll();
    setCaret();
  });
}

function setCaret() {
  const w = S.wordEls[S.wi];
  if (!w) return;
  for (let i = 0; i < S.wordEls.length; i++) {
    S.wordEls[i].classList.toggle("active", i === S.wi);
  }
  const ci = S.input[S.wi].length;
  const spans = w.children;
  const wrapRect = el.typewrap.getBoundingClientRect();
  let x, y, h;
  if (ci < spans.length) {
    const r = spans[ci].getBoundingClientRect();
    x = r.left - wrapRect.left;
    y = r.top - wrapRect.top;
    h = r.height;
  } else if (spans.length) {
    const r = spans[spans.length - 1].getBoundingClientRect();
    x = r.right - wrapRect.left;
    y = r.top - wrapRect.top;
    h = r.height;
  } else {
    const r = w.getBoundingClientRect();
    x = r.left - wrapRect.left;
    y = r.top - wrapRect.top;
    h = r.height;
  }
  const maxX = Math.max(0, wrapRect.width - 4);
  x = Math.max(0, Math.min(x, maxX));
  el.caret.style.height = h + "px";
  el.caret.style.transform = `translate(${x}px, ${y}px)`;
}

function updateScroll() {
  const w = S.wordEls[S.wi];
  if (!w) return;
  const target = Math.max(0, w.offsetTop - S.LH);
  el.words.style.transform = `translateY(${-target}px)`;
}

/* ---------- live stats ---------- */
function elapsedSec() {
  if (!S.started) return 0;
  return (performance.now() - S.startTime) / 1000;
}

function isEndless() { return S.limit === ENDLESS; }
function trunc1(v) { return (Math.floor(v * 10) / 10).toFixed(1); }

/* ---------- live values ---------- */
/* WPM is the real cumulative figure: correct characters / 5 / minutes typed.
   The 1.5s floor only tames the impossible opening spike before any time has
   passed; after that it's the true number, shown as a whole figure. */
function liveWpmValue() {
  const secs = elapsedSec();
  if (secs < 0.4) return 0;
  return (S.correctInText / 5) / (secs / 60);
}

function updateLive() {
  el.liveWpm.textContent = Math.round(liveWpmValue());
  if ((S.mode === "words" || S.mode === "practice" || S.mode === "daily") && el.liveLeft) {
    el.liveLeft.textContent = isEndless() ? "∞" : Math.max(0, S.words.length - S.wi);
  }
}

function updateWeakStrip() {
  const wk = weakKeyList().slice(0, 2);
  el.weakstrip.innerHTML = "";
  for (const k of wk) {
    const v = S.keys[k];
    const chip = document.createElement("span");
    chip.className = "weakchip";
    chip.textContent = `${k} ${Math.round((v.e / v.t) * 100)}%`;
    el.weakstrip.appendChild(chip);
  }
}

/* ---------- canvas helpers ---------- */
function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function themeAccent() {
  return getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#7aa2ff";
}

function themeAccentRgba(alpha) {
  const rgb = getComputedStyle(document.body).getPropertyValue("--accent-rgb").trim() || "122, 162, 255";
  return `rgba(${rgb},${alpha})`;
}

function drawSeries(ctx, pts, w, h, maxV, pad) {
  if (pts.length < 2) return;
  const step = w / Math.max(pts.length - 1, 1);
  ctx.beginPath();
  pts.forEach((v, i) => {
    const x = i * step;
    const y = h - pad - (v / maxV) * (h - pad * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
}

function drawLive() {
  const graph = el.livegraph;
  if (S.samples.length < 2) { graph.hidden = true; return; }
  graph.hidden = false;
  const { ctx, w, h } = fitCanvas(graph);
  const maxV = Math.max(60, ...S.samples.map((s) => Math.max(s.wpm, s.raw))) * 1.15;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  drawSeries(ctx, S.samples.map((s) => s.raw), w, h, maxV, 10);
  ctx.strokeStyle = themeAccentRgba(0.25);
  ctx.lineWidth = 2;
  ctx.stroke();
  drawSeries(ctx, S.samples.map((s) => s.wpm), w, h, maxV, 10);
  ctx.strokeStyle = themeAccent();
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

let hoveredGraphIndex = -1;

function drawResults(hoverIdx = hoveredGraphIndex) {
  if (!el.resGraph) return;
  el.resGraph.style.display = "";
  const { ctx, w, h } = fitCanvas(el.resGraph);
  const samples = S.samples;
  if (!samples || samples.length < 2) { el.resGraph.style.display = "none"; return; }

  const padLeft = 46;
  const padRight = 36;
  const padTop = 24;
  const padBottom = 28;

  const plotW = Math.max(10, w - padLeft - padRight);
  const plotH = Math.max(10, h - padTop - padBottom);

  const maxValRaw = Math.max(40, ...samples.map((s) => Math.max(s.wpm, s.raw)));
  const yMax = Math.ceil(maxValRaw / 20) * 20;
  const maxErr = Math.max(1, ...samples.map((s) => s.err || 0));

  const xOf = (i) => padLeft + (i / Math.max(samples.length - 1, 1)) * plotW;
  const yOf = (val) => padTop + plotH - (val / yMax) * plotH;

  const isLight = document.body.classList.contains("light");

  // Grid lines & Left Y-axis (WPM)
  ctx.strokeStyle = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.font = "10px monospace";
  ctx.fillStyle = isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.35)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const numGridLines = 4;
  for (let i = 0; i <= numGridLines; i++) {
    const v = Math.round((yMax / numGridLines) * i);
    const y = yOf(v);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    ctx.fillText(v, padLeft - 8, y);
  }

  // Left vertical label: "Words per Minute"
  ctx.save();
  ctx.translate(13, padTop + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)";
  ctx.font = "9.5px sans-serif";
  ctx.fillText("Words per Minute", 0, 0);
  ctx.restore();

  // Right vertical label: "Errors" and ticks (0, maxErr)
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 107, 129, 0.65)";
  ctx.fillText("0", w - padRight + 7, padTop + plotH);
  ctx.fillText(maxErr, w - padRight + 7, padTop + 4);

  ctx.save();
  ctx.translate(w - 7, padTop + plotH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = "center";
  ctx.font = "9.5px sans-serif";
  ctx.fillText("Errors", 0, 0);
  ctx.restore();

  // X-axis: Second markers (1, 2, 3...)
  ctx.fillStyle = isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "10px monospace";
  const stepX = Math.max(1, Math.ceil(samples.length / 25));
  for (let i = 0; i < samples.length; i += stepX) {
    ctx.fillText(i + 1, xOf(i), h - padBottom + 8);
  }
  if ((samples.length - 1) % stepX !== 0) {
    ctx.fillText(samples.length, xOf(samples.length - 1), h - padBottom + 8);
  }

  const endX = w - padRight;

  // Draw smooth curve helper
  function drawSmooth(points, strokeStyle, lineWidth) {
    if (points.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, (p0.y + p1.y) / 2);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    if (last.x < endX) ctx.lineTo(endX, last.y);
    ctx.stroke();
    ctx.restore();
  }

  const rawPts = samples.map((s, i) => ({ x: xOf(i), y: yOf(s.raw) }));
  const wpmPts = samples.map((s, i) => ({ x: xOf(i), y: yOf(s.wpm) }));

  // Soft gradient area under WPM line - reaches to the very end of the plot
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wpmPts[0].x, wpmPts[0].y);
  for (let i = 0; i < wpmPts.length - 1; i++) {
    const midX = (wpmPts[i].x + wpmPts[i + 1].x) / 2;
    ctx.quadraticCurveTo(wpmPts[i].x, wpmPts[i].y, midX, (wpmPts[i].y + wpmPts[i + 1].y) / 2);
  }
  const lastWpm = wpmPts[wpmPts.length - 1];
  ctx.lineTo(lastWpm.x, lastWpm.y);
  if (lastWpm.x < endX) ctx.lineTo(endX, lastWpm.y);
  ctx.lineTo(endX, padTop + plotH);
  ctx.lineTo(padLeft, padTop + plotH);
  ctx.lineTo(padLeft, wpmPts[0].y);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  grad.addColorStop(0, themeAccentRgba(0.20));
  grad.addColorStop(0.65, themeAccentRgba(0.06));
  grad.addColorStop(1, themeAccentRgba(0));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Draw Raw line (subtle secondary curve)
  drawSmooth(rawPts, isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.28)", 1.8);
  ctx.fillStyle = isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.35)";
  rawPts.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw WPM line (primary accent curve)
  drawSmooth(wpmPts, themeAccent(), 2.5);
  ctx.fillStyle = themeAccent();
  wpmPts.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Error markers: red ✕ at top
  samples.forEach((s, i) => {
    if (s.err > 0) {
      const x = xOf(i);
      ctx.fillStyle = "#ff6b81";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✕", x, padTop - 8);
    }
  });

  // Hover indicator line and highlighted points
  if (hoverIdx >= 0 && hoverIdx < samples.length) {
    const x = xOf(hoverIdx);
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.moveTo(x, padTop - 12);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();

    // WPM point highlight
    const pyWpm = yOf(samples[hoverIdx].wpm);
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.arc(x, pyWpm, 5, 0, Math.PI * 2);
    ctx.fillStyle = themeAccent();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Raw point highlight
    const pyRaw = yOf(samples[hoverIdx].raw);
    ctx.beginPath();
    ctx.arc(x, pyRaw, 4, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? "#111" : "#ffffff";
    ctx.fill();

    ctx.restore();
  }
}

if (el.resGraph) {
  el.resGraph.addEventListener("mousemove", (e) => {
    const samples = S.samples;
    if (!samples || samples.length < 2) return;
    const rect = el.resGraph.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 46;
    const padRight = 36;
    const plotW = Math.max(10, rect.width - padLeft - padRight);
    const frac = Math.max(0, Math.min(1, (mouseX - padLeft) / plotW));
    const idx = Math.round(frac * (samples.length - 1));
    if (idx >= 0 && idx < samples.length) {
      hoveredGraphIndex = idx;
      drawResults(idx);

      const s = samples[idx];
      const tip = el.graphTooltip;
      if (tip) {
        tip.hidden = false;
        const xPos = padLeft + (idx / (samples.length - 1)) * plotW;
        tip.style.left = xPos + "px";
        tip.style.top = "65px";
        tip.innerHTML = `
          <div class="tip-header">${idx + 1}s</div>
          <div class="tip-row"><span class="tip-dot" style="background:#ff6b81"></span>errors:<span class="tip-val">${s.err || 0}</span></div>
          <div class="tip-row"><span class="tip-dot" style="background:${themeAccent()}"></span>wpm:<span class="tip-val">${Math.round(s.wpm)}</span></div>
          <div class="tip-row"><span class="tip-dot" style="background:${isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.6)"}"></span>raw:<span class="tip-val">${Math.round(s.raw)}</span></div>
        `;
      }
    }
  });

  el.resGraph.addEventListener("mouseleave", () => {
    hoveredGraphIndex = -1;
    if (el.graphTooltip) el.graphTooltip.hidden = true;
    drawResults(-1);
  });
}

/* ---------- typing sounds: real mechanical-keyboard recordings with Web Audio normalization & boost ---------- */
const SAMPLE_PROFILES = ["cream", "boxnavy", "topre", "alpaca", "turquoise", "off"];
const SAMPLE_CONFIG = {};
let soundOn = load(SOUND_KEY, false);
let soundProfile = load(SOUND_KEY + "_profile", "cream");
let soundVolume = load(SOUND_KEY + "_volume", 0.7); // Default to 70% (2:1 loudness ratio vs 35% lofi)
if (soundVolume === 1.0 && !localStorage.getItem(SOUND_KEY + "_user_adjusted")) {
  soundVolume = 0.7;
}

let audioCtx = null;
let soundCompressor = null;
let soundBoostGain = null;
let soundMasterGain = null;
const audioBufferCache = new Map();
const audioBufferLoading = new Map();

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();

      // Dynamics Compressor: normalizes click levels, boosts punch and prevents distortion
      soundCompressor = audioCtx.createDynamicsCompressor();
      soundCompressor.threshold.value = -14;
      soundCompressor.knee.value = 10;
      soundCompressor.ratio.value = 4.5;
      soundCompressor.attack.value = 0.002;
      soundCompressor.release.value = 0.12;

      // Boost Gain: makes click sounds louder in general (2.3x gain multiplier)
      soundBoostGain = audioCtx.createGain();
      soundBoostGain.gain.value = 2.3;

      // Master Gain: tied directly to the volume slider
      soundMasterGain = audioCtx.createGain();
      soundMasterGain.gain.value = soundVolume;

      // Routing: Source -> Compressor -> Boost -> Master -> Destination
      soundCompressor.connect(soundBoostGain);
      soundBoostGain.connect(soundMasterGain);
      soundMasterGain.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function loadAudioBuffer(path) {
  if (audioBufferCache.has(path)) return Promise.resolve(audioBufferCache.get(path));
  if (audioBufferLoading.has(path)) return audioBufferLoading.get(path);

  const promise = fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.arrayBuffer();
    })
    .then((buf) => {
      const ctx = getAudioContext();
      if (!ctx) throw new Error("No AudioContext");
      return ctx.decodeAudioData(buf);
    })
    .then((decoded) => {
      audioBufferCache.set(path, decoded);
      audioBufferLoading.delete(path);
      return decoded;
    })
    .catch(() => {
      audioBufferLoading.delete(path);
      return null;
    });

  audioBufferLoading.set(path, promise);
  return promise;
}

const sampleCache = new Map();
function samplePath(profile, kind, variation = 0) {
  const config = SAMPLE_CONFIG[profile] || { extension: "mp3", variations: 5 };
  const file = kind === "space" || kind === "backspace" ? kind : `key-${variation}`;
  return `/sounds/${profile}/${file}.${config.extension}`;
}
function getSample(path) {
  const pool = sampleCache.get(path) || [];
  let audio = pool.find((item) => item.paused || item.ended);
  if (!audio) {
    audio = new Audio(path);
    audio.preload = "auto";
    pool.push(audio);
    sampleCache.set(path, pool);
  }
  return audio;
}
function preloadSamples(profile) {
  if (profile === "off") return;
  const variations = (SAMPLE_CONFIG[profile] || { variations: 5 }).variations;
  for (let i = 0; i < variations; i++) {
    const p = samplePath(profile, "key", i);
    getSample(p);
    loadAudioBuffer(p);
  }
  const spacePath = samplePath(profile, "space");
  getSample(spacePath);
  loadAudioBuffer(spacePath);

  const backspacePath = samplePath(profile, "backspace");
  getSample(backspacePath);
  loadAudioBuffer(backspacePath);
}

function playKeySound(ok, isSpace, isBackspace) {
  if (!soundOn || soundProfile === "off") return;
  const ctx = getAudioContext();
  const kind = isSpace ? "space" : isBackspace ? "backspace" : "key";
  const variations = (SAMPLE_CONFIG[soundProfile] || { variations: 5 }).variations;
  const path = samplePath(soundProfile, kind, Math.floor(Math.random() * variations));

  const buffer = audioBufferCache.get(path);
  if (ctx && buffer) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.97 + Math.random() * 0.06;

    if (!ok) {
      const errGain = ctx.createGain();
      errGain.gain.value = 0.88;
      src.connect(errGain);
      errGain.connect(soundCompressor);
    } else {
      src.connect(soundCompressor);
    }

    src.start(0);
  } else {
    loadAudioBuffer(path);
    const audio = getSample(path);
    audio.currentTime = 0;
    audio.volume = Math.min(1, soundVolume * (ok ? 1 : 0.88));
    audio.playbackRate = 0.97 + Math.random() * 0.06;
    audio.play().catch(() => {});
  }
}

function setProfile(name) {
  if (!SAMPLE_PROFILES.includes(name)) name = "cream";
  soundProfile = name;
  save(SOUND_KEY + "_profile", name);
  const box = $("#sound-profiles");
  if (box) for (const b of box.children) b.classList.toggle("active", b.dataset.p === name);
  preloadSamples(name);
}
function setSound(on) {
  if (on && soundProfile === "off") setProfile("cream");
  soundOn = on;
  save(SOUND_KEY, on);
  el.optSound.classList.toggle("active", on);
  if (on) preloadSamples(soundProfile);
}
function setVolume(value) {
  soundVolume = Math.max(0, Math.min(1, value));
  save(SOUND_KEY + "_volume", soundVolume);
  if (soundMasterGain) {
    soundMasterGain.gain.value = soundVolume;
  }
  el.soundVolume.value = Math.round(soundVolume * 100);
  el.volumeValue.textContent = Math.round(soundVolume * 100) + "%";
}

let previewTimers = [];
function playPreviewHit(profile, kind = "key") {
  const ctx = getAudioContext();
  const variations = (SAMPLE_CONFIG[profile] || { variations: 5 }).variations;
  const path = samplePath(profile, kind, Math.floor(Math.random() * variations));

  const buffer = audioBufferCache.get(path);
  if (ctx && buffer) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    src.connect(soundCompressor);
    src.start(0);
  } else {
    loadAudioBuffer(path);
    const audio = getSample(path);
    audio.currentTime = 0;
    audio.volume = Math.min(1, Math.max(0.15, soundVolume));
    audio.playbackRate = 0.97 + Math.random() * 0.06;
    audio.play().catch(() => {});
  }
}

function previewProfile(profile) {
  for (const timer of previewTimers) clearTimeout(timer);
  previewTimers = [];
  if (profile === "off") return;
  getAudioContext();
  playPreviewHit(profile);
  const rhythm = [0, 82, 148, 245, 316, 392, 505];
  rhythm.slice(1).forEach((delay, index) => {
    const timer = setTimeout(() => {
      playPreviewHit(profile, index === rhythm.length - 2 ? "space" : "key");
    }, delay);
    previewTimers.push(timer);
  });
}

function unlockSoundPreviews() {
  getAudioContext();
}

window.addEventListener("keydown", () => getAudioContext(), { once: true });
window.addEventListener("mousedown", () => getAudioContext(), { once: true });

/* ---------- lofi girl live stream (mini player) ---------- */
const LOFI_STREAM_ID = "rFZHOHl-L8A"; // Lofi Girl — "lofi hip hop radio 📚 beats to relax/study to" (live, embeddable)
const LOFI_WATCH_URL = "https://www.youtube.com/watch?v=" + LOFI_STREAM_ID;
let lofiApiPromise = null;
let lofiPlayer = null;
let lofiWanted = false;
// last minimize state, remembered across restarts of the stream and page reloads
let lofiMinimized = load("typeflow_lofi_min", false);
let lofiVolume = load("typeflow_lofi_volume", 70);
// If user had unadjusted 35 or 18 from previous builds, reset default to 70
if ((lofiVolume === 35 || lofiVolume === 18) && !localStorage.getItem("typeflow_lofi_user_adjusted")) {
  lofiVolume = 70;
}

function getActualLofiVolume(vol = lofiVolume) {
  // Slider displays 0-100% (default 70%), but actual audio piped to the tab is halved again (0.25x, max 25)
  return Math.max(0, Math.min(100, Math.round(vol * 0.25)));
}

function lofiApiReady() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!lofiApiPromise) {
    lofiApiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previous === "function") previous();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
  }
  return lofiApiPromise;
}

function renderLofiState() {
  el.optLofi.classList.toggle("active", lofiWanted);
  el.lofiPop.classList.toggle("open", lofiWanted);
  el.lofiPop.classList.toggle("min", lofiMinimized);
  el.lofiMin.textContent = "─";
  el.lofiMin.title = lofiMinimized ? "expand" : "minimize";
  if (el.lofiBar) {
    el.lofiBar.title = lofiMinimized ? "click to expand" : "click to minimize";
  }
}

function startLofi() {
  lofiWanted = true;
  el.lofiNote.hidden = true;
  renderLofiState(); // opens in whatever state was last used (saved preference)

  const apiReady = Promise.race([
    lofiApiReady(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("youtube api timeout")), 10000))
  ]);

  apiReady.then(() => {
    if (!lofiWanted) return; // toggled back off while the API was loading
    if (lofiPlayer) {
      if (typeof lofiPlayer.setVolume === "function") lofiPlayer.setVolume(getActualLofiVolume(lofiVolume));
      lofiPlayer.playVideo();
      return;
    }
    lofiPlayer = new window.YT.Player(el.lofiMount, {
      videoId: LOFI_STREAM_ID,
      playerVars: {
        autoplay: 1,
        controls: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        disablekb: 1
      },
      events: {
        onReady: (e) => {
          if (typeof e.target.setVolume === "function") e.target.setVolume(getActualLofiVolume(lofiVolume));
          if (lofiWanted) e.target.playVideo();
        },
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.PLAYING) el.lofiNote.hidden = true;
        },
        onError: (e) => {
          el.lofiNote.textContent = "open on youtube ↗";
          el.lofiNote.title = "youtube error " + e.data; // 101/150 = embedding blocked, 153 = player config
          el.lofiNote.hidden = false;
        }
      }
    });
  }, () => {
    el.lofiNote.textContent = "couldn't load";
    el.lofiNote.title = "the youtube player api did not load";
    el.lofiNote.hidden = false;
  });
}

function stopLofi() {
  lofiWanted = false;
  // Intentionally keep lofiMinimized: removing .min in the same frame as .open would
  // pop the collapsed pill back open and flash the video during the fade-out.
  // It also doubles as the remembered preference for the next open.
  renderLofiState();
  if (lofiPlayer) lofiPlayer.pauseVideo();
}

el.lofiNote.href = LOFI_WATCH_URL;
lofiApiReady(); // warm up the player API so the first click starts immediately

/* ---------- typing input handling ---------- */
function handleChar(ch) {
  if (S.finished || S.paused) return;
  if (!el.settingsPop.hidden || !el.cmdOverlay.hidden || !el.statsView.hidden || !el.resultsView.hidden) return;
  if (el.focusnote.classList.contains("visible") || el.typewrap.classList.contains("unfocused") || document.activeElement !== el.input) return;
  if (ch === "\n" || ch === "\r") return; // mobile enter

  const w = S.words[S.wi];
  const inp = S.input[S.wi];
  if (ch === " " && inp.length === 0 && !S.started) return; // stray space: don't start
  if (!S.started) startTest();
  if (ch === " ") {
    if (inp.length === 0) return;
    S.keystrokes++;
    S.typedChars++;           // the space is a keystroke/character like any other
    const ok = inp === w;
    if (ok) { S.correctKeystrokes++; S.correctInText++; }
    S.boundaryOk[S.wi] = ok;
    if (!ok) S.errsThisSec++;
    playKeySound(ok, true);
    markWordComplete(S.wi, inp, w);
    S.wi++;
    if (S.wi >= S.words.length) { finish(); return; } // space past the last word
    if (S.input[S.wi] === undefined) S.input[S.wi] = "";
    ensureMore();
    updateScroll();
    setCaret();
    updateLive();
    return;
  }

  const MAX_EXTRA = 25;
  if (inp.length >= w.length + MAX_EXTRA) {
    const wordEl = S.wordEls[S.wi];
    if (wordEl) {
      wordEl.classList.remove("shake");
      void wordEl.offsetWidth;
      wordEl.classList.add("shake");
    }
    playKeySound(false);
    return;
  }

  S.keystrokes++;
  S.typedChars++;
  const expected = inp.length < w.length ? w[inp.length] : null;
  const ok = expected === ch;
  if (expected) {
    const st = (S.keys[expected] = S.keys[expected] || { t: 0, e: 0 });
    st.t++;
    if (!ok) st.e++;
  }
  if (ok) {
    S.correctKeystrokes++;
    S.correctInText++;
  }
  if (!ok) S.errsThisSec++;
  playKeySound(ok);

  const wordEl = S.wordEls[S.wi];
  const ci = inp.length;
  if (ci < w.length) {
    wordEl.children[ci].classList.add(ok ? "done" : "bad");
  } else {
    const span = document.createElement("span");
    span.className = "letter extra";
    span.textContent = ch;
    wordEl.appendChild(span);
  }
  S.input[S.wi] = inp + ch;

  updateWeakStrip();
  setCaret();
  updateLive();

  // finite modes end when the last char of the last word is typed
  if (S.mode !== "time" && S.wi === S.words.length - 1 && S.input[S.wi].length >= w.length) {
    finish();
  }
}

function markWordComplete(wi, inp, w) {
  if (inp !== w) {
    const wordEl = S.wordEls[wi];
    wordEl.classList.add("wrong");
    for (let j = inp.length; j < w.length; j++) {
      wordEl.children[j].classList.add("missed");
    }
  }
}

function unmarkWord(wi) {
  const wordEl = S.wordEls[wi];
  wordEl.classList.remove("wrong");
  for (const s of wordEl.children) s.classList.remove("missed");
}

function handleBackspace() {
  if (S.finished || S.paused) return;
  if (!el.settingsPop.hidden || !el.cmdOverlay.hidden || !el.statsView.hidden || !el.resultsView.hidden) return;
  if (el.focusnote.classList.contains("visible") || el.typewrap.classList.contains("unfocused") || document.activeElement !== el.input) return;
  if (S.input[S.wi].length === 0) {
    if (S.wi === 0) return;
    // only step back into a word that had errors
    if (S.input[S.wi - 1] === S.words[S.wi - 1]) return;
    if (S.boundaryOk[S.wi - 1]) S.correctInText--;
    S.wi--;
    unmarkWord(S.wi);
  }
  const w = S.words[S.wi];
  const inp = S.input[S.wi];
  const ci = inp.length - 1;
  const ch = inp[ci];
  if (ci < w.length && w[ci] === ch) S.correctInText--;
  playKeySound(true, false, true);

  const wordEl = S.wordEls[S.wi];
  if (ci >= w.length) {
    wordEl.lastChild.remove();
  } else {
    wordEl.children[ci].classList.remove("done", "bad");
  }
  unmarkWord(S.wi);
  S.input[S.wi] = inp.slice(0, ci);
  setCaret();
  updateLive();
}

/* ---------- test lifecycle ---------- */
function perf() { return performance.now() - S.startTime; }

function startTest() {
  S.started = true;
  S.startTime = performance.now();
  el.caret.classList.remove("idle");
  S.timer = setInterval(tick, 100);
  el.endBtn.hidden = !isEndless();
  if (el.settingsPop) el.settingsPop.hidden = true;
  if (el.btnSettings) el.btnSettings.classList.remove("active");
  document.body.classList.add("typing-focus");
}

function pushSample() {
  const mins = Math.max(perf() / 60000, 1 / 6000);
  const charsDelta = S.typedChars - (S.prevSecChars || 0);
  S.prevSecChars = S.typedChars;
  const burst = (charsDelta / 5) * 60;
  S.samples.push({
    wpm: S.correctInText / 5 / mins,
    raw: S.typedChars / 5 / mins,
    burst: Math.max(0, burst),
    err: S.errsThisSec
  });
  S.errsThisSec = 0;
  drawLive();
}

function tick() {
  if (S.paused) return;
  const el0 = elapsedSec();
  if (S.mode === "time" && !isEndless()) {
    const rem = Math.max(0, S.limit - el0);
    el.liveTime.textContent = Math.ceil(rem);
    if (rem <= 0) { finish(); return; }
  } else if (S.mode === "time" && isEndless()) {
    el.liveTime.textContent = Math.floor(el0);
  }
  const sec = Math.floor(el0);
  while (S.lastSec < sec) { pushSample(); S.lastSec++; }
  updateLive();
}

function ensureMore() {
  // time mode grows forever; words mode only when it's endless
  const wantsMore = S.mode === "time" || (S.mode === "words" && isEndless());
  if (!wantsMore) return;
  if (S.wi > S.words.length - 45) {
    const more = genWords(50);
    for (const w of more) {
      S.words.push(w);
      S.input.push("");
      const d = buildWordEl(w);
      el.words.appendChild(d);
      S.wordEls.push(d);
    }
  }
}

function finish() {
  if (S.finished) return;
  S.finished = true;
  document.body.classList.remove("typing-focus");
  clearInterval(S.timer);
  // final partial second sample
  const sec = Math.floor(elapsedSec());
  while (S.lastSec < sec) { pushSample(); S.lastSec++; }
  if (S.typedChars > 0) {
    const finalSec = (S.mode === "time" && !isEndless()) ? S.limit : Math.max(elapsedSec(), 0.5);
    const mins = Math.max(finalSec / 60, 1 / 6000);
    const charsDelta = S.typedChars - (S.prevSecChars || 0);
    const burst = (charsDelta / 5) * 60;
    S.samples.push({
      wpm: S.correctInText / 5 / mins,
      raw: S.typedChars / 5 / mins,
      burst: Math.max(0, burst),
      err: S.errsThisSec
    });
    S.errsThisSec = 0;
  }
  el.caret.style.opacity = "0";
  document.activeElement && document.activeElement.blur();
  showResults();
}

function computeResults() {
  const timeSec = (S.mode === "time" && !isEndless()) ? S.limit : Math.max(elapsedSec(), 1);
  const mins = timeSec / 60;

  let correct = 0, incorrect = 0, extra = 0;
  for (let i = 0; i < S.words.length; i++) {
    const w = S.words[i];
    const inp = S.input[i] || "";
    for (let j = 0; j < Math.max(w.length, inp.length); j++) {
      if (j >= inp.length) incorrect++;        // missed letter
      else if (j >= w.length) extra++;          // overflow letter
      else if (w[j] === inp[j]) correct++;
      else incorrect++;
    }
    // the space you typed to leave this word is a character too — counting it
    // keeps the final wpm in step with the live counter and the standard
    // chars/5/minutes formula. S.boundaryOk[i] is only set once that space is
    // actually pressed, so untyped trailing words are skipped.
    if (S.boundaryOk[i] === true) correct++;
    else if (S.boundaryOk[i] === false) incorrect++;
  }

  const wpm = Math.round(correct / 5 / mins);
  const raw = Math.round((correct + incorrect + extra) / 5 / mins);
  const acc = S.keystrokes ? Math.round((S.correctKeystrokes / S.keystrokes) * 100) : 100;
  const kpm = Math.round(S.keystrokes / mins);

  // consistency (kogasa): 100 * (1 - tanh(std/mean)) over per-second raw wpm
  let cons = 100;
  if (S.samples.length >= 2) {
    const vals = S.samples.map((s) => s.raw);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (mean > 0) {
      const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
      cons = Math.round(100 * (1 - Math.tanh(std / mean)));
    }
  }

  return { wpm, raw, acc, cons, kpm, correct, incorrect, extra, timeSec };
}

function showResults() {
  const r = computeResults();
  window.__lastResult = r; // used by the share button
  el.resWpm.textContent = r.wpm;
  el.resAcc.textContent = r.acc + "%";
  if (el.resCons) el.resCons.textContent = r.cons + "%";
  el.resRaw.textContent = r.raw;
  if (el.resKpm) el.resKpm.textContent = r.kpm;
  el.resTime.textContent = trunc1(r.timeSec) + "s";
  if (el.resUncorr) el.resUncorr.textContent = r.incorrect;
  el.resChars.innerHTML =
    `<span class="c-ok" data-tip="correct: ${r.correct}" title="correct characters: ${r.correct}">${r.correct}</span>` +
    `<span class="c-sep">/</span>` +
    `<span class="c-bad" data-tip="incorrect: ${r.incorrect}" title="incorrect characters: ${r.incorrect}">${r.incorrect}</span>` +
    `<span class="c-sep">/</span>` +
    `<span class="c-extra" data-tip="extra: ${r.extra}" title="extra characters: ${r.extra}">${r.extra}</span>`;

  const meta = modeLabel();
  el.resultMeta.textContent = meta;

  // personal best
  const pb = getPb();
  if (r.wpm > pb) {
    save(pbKey(), r.wpm);
    el.pbBadge.hidden = false;
    el.pbBadge.textContent = pb > 0 ? `new personal best (+${r.wpm - pb})` : "new personal best";
  } else {
    el.pbBadge.hidden = true;
  }
  if (el.livePb) el.livePb.textContent = getPb() || "—";

  // daily challenge: update streak + show share bar
  if (S.mode === "daily") {
    const st = recordDaily(r.wpm);
    el.dailyResult.hidden = false;
    el.dailyStreak.innerHTML =
      `streak <b>${st.streak}</b> day${st.streak === 1 ? "" : "s"} · best <b>${st.best}</b> wpm`;
  } else {
    el.dailyResult.hidden = true;
  }

  // history log (skip practice runs — they're drills, not real tests)
  if (S.mode !== "practice") {
    const h = load(HIST_KEY, []);
    h.push({ t: Date.now(), wpm: r.wpm, acc: r.acc, cons: r.cons, mode: S.mode, lim: S.limit, sec: r.timeSec });
    if (h.length > 400) h.splice(0, h.length - 400);
    save(HIST_KEY, h);
  }

  el.testView.hidden = true;
  el.resultsView.hidden = false;

  drawResults();
  buildHeatmap();
}

/* ---------- weak keys heatmap ---------- */
function buildHeatmap() {
  const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  el.heatmap.innerHTML = "";
  let any = false;
  for (const row of rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "kb-row";
    for (const k of row) {
      const key = document.createElement("div");
      key.className = "key";
      key.textContent = k;
      const st = S.keys[k];
      if (st && st.t) {
        any = true;
        const rate = st.e / st.t;
        if (rate === 0) {
          key.style.background = "rgba(126,231,135,0.12)";
        } else {
          key.style.background = `rgba(255,107,129,${(0.1 + rate * 0.55).toFixed(2)})`;
          if (rate >= 0.25) key.style.color = "#ff6b81";
        }
        key.title = `${k}: ${st.e}/${st.t} errors`;
      }
      rowEl.appendChild(key);
    }
    el.heatmap.appendChild(rowEl);
  }
  el.weakPanel.hidden = !any;
}

/* ---------- restart / mode plumbing ---------- */
function stopTimers() {
  clearInterval(S.timer);
  S.timer = null;
  document.body.classList.remove("typing-focus");
}

function restart(sameWords) {
  stopTimers();
  hideFocus();
  document.body.classList.remove("typing-focus");
  Object.assign(S, {
    started: false, finished: false, startTime: 0,
    wi: 0, keystrokes: 0, correctKeystrokes: 0, correctInText: 0, typedChars: 0,
    keys: {}, samples: [], errsThisSec: 0, lastSec: 0,
    boundaryOk: [], paused: false, pauseAt: 0, prevSecChars: 0
  });

  if (sameWords && S.lastConfig) {
    S.words = S.lastConfig.slice();
  } else {
    if (S.mode === "time") S.words = genWords(150); // endless keeps topping up via ensureMore
    else if (S.mode === "words") S.words = genWords(isEndless() ? 100 : S.limit);
    else if (S.mode === "practice") S.words = genPractice();
    else if (S.mode === "daily") S.words = genDaily();
  }
  S.lastConfig = S.words.slice();
  S.input = S.words.map(() => "");

  el.resultsView.hidden = true;
  el.testView.hidden = false;
  el.caret.style.opacity = "";
  el.caret.classList.add("idle");
  el.weakstrip.innerHTML = "";
  el.liveWpm.textContent = "0";
  if (el.liveAcc) el.liveAcc.textContent = "100%";
  if (el.livePb) el.livePb.textContent = getPb() || "—";
  const isTimeMode = S.mode === "time";
  const isWordsMode = S.mode === "words" || S.mode === "practice" || S.mode === "daily";
  if (el.statTime) {
    el.statTime.hidden = !isTimeMode;
    el.statTime.style.display = isTimeMode ? "" : "none";
  }
  if (el.statLeft) {
    el.statLeft.hidden = !isWordsMode;
    el.statLeft.style.display = isWordsMode ? "" : "none";
  }

  if (isTimeMode) {
    el.liveTime.textContent = isEndless() ? "0" : S.limit;
  } else if (isWordsMode) {
    el.liveLeft.textContent = isEndless() ? "∞" : S.words.length;
  }
  el.endBtn.hidden = true; // appears when an endless test starts
  el.dailyResult.hidden = true;

  // Hide streak in livestats during typing so only words left and wpm are shown
  if (el.statStreak) {
    el.statStreak.hidden = true;
    el.statStreak.style.display = "none";
  }
  if (el.modeNote) el.modeNote.textContent = "";
  el.livegraph.hidden = true; // reveals itself once the first samples land

  el.input.value = "";
  lastVal = "";
  renderAll();
  if (window.matchMedia("(pointer: fine)").matches) el.input.focus();
}

function buildSubbar() {
  el.subbar.innerHTML = "";
  if (S.mode === "daily") {
    const b = document.createElement("button");
    b.className = "limit active";
    b.textContent = "50";
    b.title = "daily challenge: 50 words";
    b.addEventListener("click", () => restart());
    el.subbar.appendChild(b);
    return;
  }
  if (!LIMITS[S.mode]) return; // practice mode
  for (const v of LIMITS[S.mode]) {
    const b = document.createElement("button");
    b.className = "limit" + (v === S.limit ? " active" : "");
    b.textContent = v;
    b.addEventListener("click", () => {
      S.limit = v;
      buildSubbar();
      restart();
    });
    el.subbar.appendChild(b);
  }
}

function setMode(mode) {
  S.mode = mode;
  for (const b of el.modes.children) b.classList.toggle("active", b.dataset.mode === mode);
  // daily & practice must be identical for everyone, so the toggles are locked there too
  const dim = mode === "practice" || mode === "daily";
  for (const t of [el.optPunct, el.optNums, el.optCaps]) {
    t.style.opacity = dim ? "0.35" : "";
    t.style.pointerEvents = dim ? "none" : "";
  }

  if (LIMITS[mode] && !LIMITS[mode].includes(S.limit)) S.limit = LIMITS[mode][1];
  buildSubbar();
  restart();
}

/* ---------- events ---------- */
for (const b of el.modes.children) {
  b.addEventListener("click", () => setMode(b.dataset.mode));
}

el.optPunct.addEventListener("click", togglePunct);
el.optNums.addEventListener("click", toggleNums);
el.optCaps.addEventListener("click", toggleCaps);
el.optSound.addEventListener("click", () => setSound(!soundOn));
el.optLofi.addEventListener("click", () => (lofiWanted ? stopLofi() : startLofi()));
function toggleLofiMinimize() {
  if (!lofiWanted) return;
  lofiMinimized = !lofiMinimized;
  save("typeflow_lofi_min", lofiMinimized); // next open (even after a reload) uses this state
  renderLofiState(); // collapses or expands the video — stream keeps playing
}

if (el.lofiBar) {
  el.lofiBar.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing test focused
  el.lofiBar.addEventListener("click", (e) => {
    if (e.target.closest("a")) return; // ignore links
    toggleLofiMinimize();
  });
}

el.lofiMin.addEventListener("mousedown", (e) => e.preventDefault()); // keep test focused
el.lofiMin.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleLofiMinimize();
});

if (el.lofiVolume) {
  el.lofiVolume.value = lofiVolume;
  if (el.lofiVolVal) el.lofiVolVal.textContent = lofiVolume + "%";
  el.lofiVolume.addEventListener("mousedown", (e) => e.stopPropagation());
  el.lofiVolume.addEventListener("input", (e) => {
    lofiVolume = Number(e.target.value);
    if (el.lofiVolVal) el.lofiVolVal.textContent = lofiVolume + "%";
    save("typeflow_lofi_volume", lofiVolume);
    localStorage.setItem("typeflow_lofi_user_adjusted", "1");
    if (lofiPlayer && typeof lofiPlayer.setVolume === "function") {
      lofiPlayer.setVolume(getActualLofiVolume(lofiVolume));
      if (typeof lofiPlayer.isMuted === "function" && lofiPlayer.isMuted()) lofiPlayer.unMute();
    }
  });
}

el.nextBtn.addEventListener("click", () => restart());
el.repeatBtn.addEventListener("click", () => restart(true));
el.practiceBtn.addEventListener("click", () => setMode("practice"));

/* endless mode: end the run manually */
el.endBtn.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing input focused — no pause glitch
el.endBtn.addEventListener("click", () => {
  if (S.started && isEndless() && !S.finished) { resumeTest(); finish(); }
});

/* ---------- command palette ---------- */
function modeLabel() {
  if (isEndless()) return `endless ${S.mode}`;
  if (S.mode === "time" || S.mode === "words") return `${S.mode} ${S.limit}`;
  if (S.mode === "daily") return "daily 50";
  return S.mode; // practice
}

function togglePunct() { S.punct = !S.punct; el.optPunct.classList.toggle("active", S.punct); restart(); }
function toggleNums() { S.nums = !S.nums; el.optNums.classList.toggle("active", S.nums); restart(); }
function toggleCaps() { S.caps = !S.caps; el.optCaps.classList.toggle("active", S.caps); restart(); }
function toggleTheme() {
  const on = !document.body.classList.contains("light");
  document.body.classList.toggle("light", on);
  el.optTheme.checked = on;
  save("typeflow_theme", on);
  requestAnimationFrame(() => {
    if (S.samples && S.samples.length >= 2) drawLive();
    if (el.resultsView && !el.resultsView.hidden) drawResults();
    if (el.statsView && !el.statsView.hidden) renderStats();
  });
}

const ACCENT_THEMES = ["blue", "mint", "violet", "orange", "black", "nord", "coffee", "sakura", "crimson"];
let currentSavedAccent = "blue";
let isPreviewingAccent = false;

function previewAccent(accent) {
  if (!ACCENT_THEMES.includes(accent)) return;
  isPreviewingAccent = true;
  document.body.classList.add("previewing-theme");
  document.body.dataset.accent = accent;
  const opts = $("#accent-options");
  if (opts) {
    for (const b of opts.children) {
      b.classList.toggle("previewing", b.dataset.accent === accent);
    }
  }
  requestAnimationFrame(() => {
    if (S.samples && S.samples.length >= 2) drawLive();
    if (el.resultsView && !el.resultsView.hidden) drawResults();
    if (el.statsView && !el.statsView.hidden) renderStats();
  });
}

function clearAccentPreview() {
  if (!isPreviewingAccent && document.body.dataset.accent === currentSavedAccent) return;
  isPreviewingAccent = false;
  document.body.classList.remove("previewing-theme");
  document.body.dataset.accent = currentSavedAccent;
  const opts = $("#accent-options");
  if (opts) {
    for (const b of opts.children) {
      b.classList.remove("previewing");
      b.classList.toggle("active", b.dataset.accent === currentSavedAccent);
    }
  }
  requestAnimationFrame(() => {
    if (S.samples && S.samples.length >= 2) drawLive();
    if (el.resultsView && !el.resultsView.hidden) drawResults();
    if (el.statsView && !el.statsView.hidden) renderStats();
  });
}

function setAccent(accent) {
  if (!ACCENT_THEMES.includes(accent)) accent = "blue";
  currentSavedAccent = accent;
  isPreviewingAccent = false;
  document.body.classList.remove("previewing-theme");
  document.body.dataset.accent = accent;
  save("typeflow_accent", accent);
  const opts = $("#accent-options");
  if (opts) {
    for (const b of opts.children) {
      b.classList.remove("previewing");
      b.classList.toggle("active", b.dataset.accent === accent);
    }
  }
  requestAnimationFrame(() => {
    if (S.samples && S.samples.length >= 2) drawLive();
    if (el.resultsView && !el.resultsView.hidden) drawResults();
    if (el.statsView && !el.statsView.hidden) renderStats();
  });
}

let currentSavedTypeSize = "standard";
let isPreviewingTypeSize = false;

function applyTypeSizeClass(size) {
  document.body.classList.remove("type-compact", "type-large");
  if (size === "compact" || size === "large") document.body.classList.add("type-" + size);
  requestAnimationFrame(() => {
    S.LH = S.wordEls[0] ? S.wordEls[0].getBoundingClientRect().height : S.LH;
    updateScroll();
    setCaret();
  });
}

function previewTypeSize(size) {
  if (!["compact", "standard", "large"].includes(size)) return;
  isPreviewingTypeSize = true;
  applyTypeSizeClass(size);
  const sizesEl = $("#type-sizes");
  if (sizesEl) {
    for (const b of sizesEl.children) {
      b.classList.toggle("previewing", b.dataset.size === size);
    }
  }
}

function clearTypeSizePreview() {
  if (!isPreviewingTypeSize) return;
  isPreviewingTypeSize = false;
  applyTypeSizeClass(currentSavedTypeSize);
  const sizesEl = $("#type-sizes");
  if (sizesEl) {
    for (const b of sizesEl.children) {
      b.classList.remove("previewing");
      b.classList.toggle("active", b.dataset.size === currentSavedTypeSize);
    }
  }
}

function setTypeSize(size) {
  if (!["compact", "standard", "large"].includes(size)) size = "standard";
  currentSavedTypeSize = size;
  isPreviewingTypeSize = false;
  applyTypeSizeClass(size);
  save("typeflow_type_size", size);
  const sizesEl = $("#type-sizes");
  if (sizesEl) {
    for (const b of sizesEl.children) {
      b.classList.remove("previewing");
      b.classList.toggle("active", b.dataset.size === size);
    }
  }
}

const CMD_LIMITS = () => (LIMITS[S.mode] || []).map((v) => ({
  label: `${S.mode}: ${v}`,
  hint: v === ENDLESS ? "forever" : S.mode === "time" ? "seconds" : "words",
  run: () => { S.limit = v; buildSubbar(); restart(); }
}));

const THEME_NAMES = {
  blue: "ocean",
  mint: "mocha",
  violet: "nebula",
  orange: "sunset",
  black: "onyx",
  nord: "arctic",
  coffee: "latte",
  sakura: "sakura",
  crimson: "crimson"
};

const CMD_THEMES = () => ACCENT_THEMES.map((theme) => ({
  label: `theme — ${THEME_NAMES[theme] || theme}`,
  hint: theme === currentSavedAccent ? "active" : "preview on hover",
  theme: theme,
  run: () => setAccent(theme)
}));

const CMDS = () => [
  { label: "mode — time", hint: "15/30/60/120", run: () => setMode("time") },
  { label: "mode — words", hint: "10/25/50/100", run: () => setMode("words") },
  { label: "mode — daily challenge", hint: "same words for everyone", run: () => setMode("daily") },
  { label: "practice weak keys", hint: "drill your worst letters", run: () => setMode("practice") },
  { label: "restart test", hint: "tab + enter", run: () => restart() },
  { label: "open stats", hint: "progress & personal bests", run: openStats },
  { label: "toggle punctuation", hint: S.punct ? "on" : "off", run: togglePunct },
  { label: "toggle numbers", hint: S.nums ? "on" : "off", run: toggleNums },
  { label: "toggle capitalization", hint: S.caps ? "on" : "off", run: toggleCaps },
  { label: "toggle typing sounds", hint: soundOn ? "on" : "off", run: () => setSound(!soundOn) },
  { label: "cycle sound profile", hint: soundProfile, run: () => setProfile(SAMPLE_PROFILES[(SAMPLE_PROFILES.indexOf(soundProfile) + 1) % SAMPLE_PROFILES.length]) },
  { label: "toggle light mode", hint: document.body.classList.contains("light") ? "on" : "off", run: toggleTheme },
  ...CMD_THEMES(),
  ...CMD_LIMITS()
];

let cmdSel = 0;
let cmdFiltered = [];

function renderCmd() {
  const q = el.cmdInput.value.trim().toLowerCase();
  cmdFiltered = CMDS().filter((c) => !q || c.label.toLowerCase().includes(q) || (c.hint || "").toLowerCase().includes(q));
  if (cmdSel >= cmdFiltered.length) cmdSel = Math.max(0, cmdFiltered.length - 1);
  el.cmdList.innerHTML = "";
  if (!cmdFiltered.length) {
    el.cmdList.innerHTML = `<div class="cmd-empty">no commands match "${q}"</div>`;
    clearAccentPreview();
    return;
  }
  const cur = cmdFiltered[cmdSel];
  if (cur && cur.theme) {
    previewAccent(cur.theme);
  } else {
    clearAccentPreview();
  }
  cmdFiltered.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "cmd-item" + (i === cmdSel ? " sel" : "");
    d.innerHTML = `<span>${c.label}</span>${c.hint ? `<span class="cmd-hint">${c.hint}</span>` : ""}`;
    d.addEventListener("mouseenter", () => {
      cmdSel = i;
      renderCmd();
    });
    d.addEventListener("click", () => { cmdSel = i; cmdRun(); });
    el.cmdList.appendChild(d);
  });
  const sel = el.cmdList.querySelector(".sel");
  if (sel) sel.scrollIntoView({ block: "nearest" });
}

function cmdMove(d) {
  cmdSel = Math.max(0, Math.min(cmdFiltered.length - 1, cmdSel + d));
  renderCmd();
}

function cmdRun() {
  const c = cmdFiltered[cmdSel];
  closeCmd();
  if (c) c.run();
}

function openCmd() {
  document.body.classList.remove("typing-focus");
  cmdSel = 0;
  el.cmdInput.value = "";
  el.cmdOverlay.hidden = false;
  renderCmd();
  el.cmdInput.focus();
}
function closeCmd() {
  clearAccentPreview();
  el.cmdOverlay.hidden = true;
  if (!el.statsView.hidden) return; // stats owns focus while it's open
  if (window.matchMedia("(pointer: fine)").matches) el.input.focus();
}

el.cmdInput.addEventListener("input", () => { cmdSel = 0; renderCmd(); });
el.cmdOverlay.addEventListener("mousedown", (e) => { if (e.target === el.cmdOverlay) closeCmd(); });

/* ---------- stats view ---------- */
function fmtDur(sec) {
  if (sec < 3600) return Math.round(sec / 60) + "m";
  return (sec / 3600).toFixed(1) + "h";
}

function allPbs() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PB_PREFIX)) continue;
      const v = load(k, 0);
      if (!v) continue;
      const rest = k.slice(PB_PREFIX.length);
      // flags are a trailing run of p(unctuation), n(umbers), c(aps) — any combo
      const m = rest.match(/^(.*?)([pnc]*)$/);
      const body = m[1];
      const flagStr = m[2].split("").map((f) => ({ p: ".", n: "#", c: "Aa" })[f]).join(" ");
      const parts = body.split("_");
      out.push({ mode: parts[0], limit: parts[1] || "", flags: flagStr, wpm: v });
    }
  } catch { /* ignore */ }
  return out.sort((a, b) => b.wpm - a.wpm);
}

let hoveredHistIndex = -1;

function drawHistGraph(hist, hoverIdx = hoveredHistIndex) {
  if (!el.histGraph) return;
  const { ctx, w, h } = fitCanvas(el.histGraph);
  const pts = hist.slice(-100);
  el.histGraph.style.display = pts.length >= 2 ? "" : "none";
  if (pts.length < 2) return;

  const padLeft = 48;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 28;
  const plotW = Math.max(10, w - padLeft - padRight);
  const plotH = Math.max(10, h - padTop - padBottom);

  const maxVal = Math.max(60, ...pts.map((p) => Math.max(p.wpm, (p.acc || 0))));
  const yMax = Math.ceil(maxVal / 20) * 20;

  const xOf = (i) => padLeft + (i / Math.max(pts.length - 1, 1)) * plotW;
  const yOf = (v) => padTop + plotH - (v / yMax) * plotH;

  const isLight = document.body.classList.contains("light");

  // grid
  ctx.strokeStyle = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.font = "10.5px monospace";
  ctx.fillStyle = isLight ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const numGridLines = 4;
  for (let i = 0; i <= numGridLines; i++) {
    const val = Math.round((yMax / numGridLines) * i);
    const y = yOf(val);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();
    ctx.fillText(val, padLeft - 8, y);
  }

  // Smooth curve helper
  function drawSmooth(points, strokeStyle, lineWidth, dashed = false) {
    if (points.length < 2) return;
    ctx.save();
    ctx.beginPath();
    if (dashed) ctx.setLineDash([4, 4]);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, (p0.y + p1.y) / 2);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  const wpmPoints = pts.map((p, i) => ({ x: xOf(i), y: yOf(p.wpm) }));
  const accPoints = pts.map((p, i) => ({ x: xOf(i), y: yOf(p.acc || 100) }));

  // underglow for wpm
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wpmPoints[0].x, wpmPoints[0].y);
  for (let i = 0; i < wpmPoints.length - 1; i++) {
    const midX = (wpmPoints[i].x + wpmPoints[i + 1].x) / 2;
    ctx.quadraticCurveTo(wpmPoints[i].x, wpmPoints[i].y, midX, (wpmPoints[i].y + wpmPoints[i + 1].y) / 2);
  }
  ctx.lineTo(wpmPoints[wpmPoints.length - 1].x, wpmPoints[wpmPoints.length - 1].y);
  ctx.lineTo(w - padRight, padTop + plotH);
  ctx.lineTo(padLeft, padTop + plotH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  grad.addColorStop(0, themeAccentRgba(0.22));
  grad.addColorStop(0.7, themeAccentRgba(0.06));
  grad.addColorStop(1, themeAccentRgba(0));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // accuracy trend line (dashed)
  const accColor = isLight ? "rgba(34, 139, 58, 0.75)" : "rgba(126, 231, 135, 0.55)";
  drawSmooth(accPoints, accColor, 1.8, true);

  // wpm line
  drawSmooth(wpmPoints, themeAccent(), 2.6);

  // dots
  ctx.fillStyle = themeAccent();
  wpmPoints.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // hover highlight and line
  if (hoverIdx >= 0 && hoverIdx < pts.length) {
    const x = xOf(hoverIdx);
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.moveTo(x, padTop - 6);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();

    const pyWpm = yOf(pts[hoverIdx].wpm);
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.arc(x, pyWpm, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = themeAccent();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    const pyAcc = yOf(pts[hoverIdx].acc || 100);
    ctx.beginPath();
    ctx.arc(x, pyAcc, 4, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? "#2f9e44" : "#7ee787";
    ctx.fill();
    ctx.restore();
  }
}

if (el.histGraph) {
  el.histGraph.addEventListener("mousemove", (e) => {
    const hist = load(HIST_KEY, []);
    const pts = hist.slice(-100);
    if (pts.length < 2) return;
    const rect = el.histGraph.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 48;
    const padRight = 24;
    const plotW = Math.max(10, rect.width - padLeft - padRight);
    const frac = Math.max(0, Math.min(1, (mouseX - padLeft) / plotW));
    const idx = Math.round(frac * (pts.length - 1));
    if (idx >= 0 && idx < pts.length) {
      hoveredHistIndex = idx;
      drawHistGraph(hist, idx);
      const tip = el.histTooltip;
      if (tip) {
        tip.hidden = false;
        const xPos = padLeft + (idx / (pts.length - 1)) * plotW;
        tip.style.left = xPos + "px";
        tip.style.top = "44px";
        const p = pts[idx];
        const isLight = document.body.classList.contains("light");
        const totalIdx = hist.length - pts.length + idx + 1;
        const modeDesc = p.mode + (p.lim ? " " + p.lim : "");
        tip.innerHTML = `
          <div class="tip-header">test #${totalIdx} · ${modeDesc}</div>
          <div class="tip-row"><span class="tip-dot" style="background:${themeAccent()}"></span>wpm:<span class="tip-val">${p.wpm}</span></div>
          <div class="tip-row"><span class="tip-dot" style="background:${isLight ? "#2f9e44" : "#7ee787"}"></span>accuracy:<span class="tip-val">${p.acc || 100}%</span></div>
          <div class="tip-row"><span class="tip-dot" style="background:var(--sub)"></span>time:<span class="tip-val">${p.sec ? Math.round(p.sec) + "s" : "—"}</span></div>
        `;
      }
    }
  });

  el.histGraph.addEventListener("mouseleave", () => {
    hoveredHistIndex = -1;
    if (el.histTooltip) el.histTooltip.hidden = true;
    const hist = load(HIST_KEY, []);
    drawHistGraph(hist, -1);
  });
}

function renderPersonalBests() {
  const pbs = allPbs();
  const standardTime = [15, 30, 60, 120];
  const standardWords = [10, 25, 50, 100];

  function getStandardPb(mode, limit) {
    if (mode === "daily") {
      return load("typeflow_pb_daily", 0) || load("typeflow_pb_daily_50", 0) || (getDailyState().best || 0);
    }
    return load(PB_PREFIX + mode + "_" + limit, 0);
  }

  function renderGroup(title, items) {
    return `
      <div class="pb-group">
        <div class="pb-group-title">${title}</div>
        <div class="pb-grid">
          ${items.map((item) => {
            const val = getStandardPb(item.mode, item.limit);
            const hasVal = val > 0;
            return `
              <div class="pb-card ${hasVal ? "" : "pb-card-empty"}">
                <span class="pb-card-header">${item.label}</span>
                <span class="pb-card-wpm">${hasVal ? `${val} <small>wpm</small>` : "—"}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  const timeItems = standardTime.map((s) => ({ mode: "time", limit: s, label: `${s} seconds` }));
  const wordsItems = standardWords.map((w) => ({ mode: "words", limit: w, label: `${w} words` }));
  const dailyItems = [{ mode: "daily", limit: 50, label: "50 words (daily)" }];

  if (el.pbCategories) {
    el.pbCategories.innerHTML =
      renderGroup("time", timeItems) +
      renderGroup("words", wordsItems) +
      renderGroup("daily", dailyItems);
  }

  // Filter any custom modifier configurations (e.g., punct, nums, caps, or endless)
  const customPbs = pbs.filter((p) => {
    const isBasicTime = p.mode === "time" && standardTime.includes(Number(p.limit)) && !p.flags;
    const isBasicWords = p.mode === "words" && standardWords.includes(Number(p.limit)) && !p.flags;
    const isBasicDaily = p.mode === "daily" && !p.flags;
    return !isBasicTime && !isBasicWords && !isBasicDaily;
  });

  if (el.pbCustomWrap) {
    if (customPbs.length > 0) {
      el.pbCustomWrap.hidden = false;
      if (el.pbTable) {
        el.pbTable.innerHTML =
          `<thead><tr><th>rank</th><th>configuration</th><th>top wpm</th></tr></thead>` +
          `<tbody>` +
          customPbs.map((p, idx) => {
            const configName = p.mode + (p.limit ? " " + p.limit : "") + (p.flags ? " · " + p.flags : "");
            return `<tr><td class="pb-rank">#${idx + 1}</td><td class="pb-mode"><span class="pb-pill">${configName}</span></td><td class="pb-wpm">${p.wpm} <small>wpm</small></td></tr>`;
          }).join("") +
          `</tbody>`;
      }
    } else {
      el.pbCustomWrap.hidden = true;
    }
  }
}

function renderStats() {
  const hist = load(HIST_KEY, []);
  const last10 = hist.slice(-10);
  const avg = last10.length ? Math.round(last10.reduce((a, b) => a + b.wpm, 0) / last10.length) : 0;
  const avgAcc = last10.length ? Math.round(last10.reduce((a, b) => a + (b.acc || 100), 0) / last10.length) : 100;
  const best = hist.reduce((m, r) => Math.max(m, r.wpm), 0);
  const totalSec = hist.reduce((a, b) => a + (b.sec || 0), 0);
  const daily = getDailyState();

  const cards = [
    ["tests taken", hist.length],
    ["avg wpm (last 10)", avg || "—"],
    ["best wpm", best || "—"],
    ["avg accuracy", hist.length ? `${avgAcc}%` : "—"],
    ["time typed", hist.length ? fmtDur(totalSec) : "—"],
    ["daily streak", `${daily.streak || 0} days`]
  ];
  el.statsTotals.innerHTML = cards
    .map(([label, v]) => `<div class="totalcard"><span>${v}</span><label>${label}</label></div>`)
    .join("");

  drawHistGraph(hist);
  renderPersonalBests();
}

function openStats() {
  document.body.classList.remove("typing-focus");
  el.statsView.hidden = false; // unhide first — a hidden canvas measures 0 wide
  el.btnStats.classList.add("active");
  renderStats();
  el.input.blur();
}
function closeStats() {
  el.statsView.hidden = true;
  el.btnStats.classList.remove("active");
  if (window.matchMedia("(pointer: fine)").matches) el.input.focus();
}

el.btnStats.addEventListener("click", () => {
  if (el.statsView.hidden) openStats();
  else closeStats();
});
el.statsClose.addEventListener("click", closeStats);

/* settings popover (light mode) */
el.btnSettings.addEventListener("click", (e) => {
  e.stopPropagation();
  unlockSoundPreviews();
  const willOpen = el.settingsPop.hidden;
  if (willOpen) hideFocus();
  el.settingsPop.hidden = !el.settingsPop.hidden;
  el.btnSettings.classList.toggle("active", !el.settingsPop.hidden);
  if (!willOpen && window.matchMedia("(pointer: fine)").matches) el.input.focus();
});
el.optTheme.addEventListener("change", toggleTheme);
el.soundVolume.addEventListener("input", () => {
  localStorage.setItem(SOUND_KEY + "_user_adjusted", "1");
  setVolume(Number(el.soundVolume.value) / 100);
  if (!soundOn && Number(el.soundVolume.value) > 0) setSound(true);
});
const accentOptionsEl = $("#accent-options");
if (accentOptionsEl) {
  accentOptionsEl.addEventListener("mouseover", (e) => {
    const b = e.target.closest(".segbtn");
    if (b && b.dataset.accent) {
      previewAccent(b.dataset.accent);
    }
  });
  accentOptionsEl.addEventListener("mouseleave", () => {
    clearAccentPreview();
  });
  accentOptionsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".segbtn");
    if (b && b.dataset.accent) {
      setAccent(b.dataset.accent);
    }
  });
}

const typeSizesEl = $("#type-sizes");
if (typeSizesEl) {
  typeSizesEl.addEventListener("mouseover", (e) => {
    const b = e.target.closest(".segbtn");
    if (b && b.dataset.size) {
      previewTypeSize(b.dataset.size);
    }
  });
  typeSizesEl.addEventListener("mouseleave", () => {
    clearTypeSizePreview();
  });
  typeSizesEl.addEventListener("click", (e) => {
    const b = e.target.closest(".segbtn");
    if (b && b.dataset.size) {
      setTypeSize(b.dataset.size);
    }
  });
}
$("#sound-profiles").addEventListener("click", (e) => {
  const b = e.target.closest(".segbtn");
  if (!b) return;
  setProfile(b.dataset.p);
  setSound(b.dataset.p !== "off");
  previewProfile(b.dataset.p);
});
for (const button of $("#sound-profiles").querySelectorAll(".segbtn")) {
  button.addEventListener("mouseenter", () => previewProfile(button.dataset.p));
}
document.addEventListener("click", (e) => {
  if (el.settingsPop.hidden) return;
  if (!el.settingsPop.contains(e.target) && e.target !== el.btnSettings) {
    clearAccentPreview();
    clearTypeSizePreview();
    el.settingsPop.hidden = true;
    el.btnSettings.classList.remove("active");
  }
});
el.clearHistory.addEventListener("click", () => {
  if (!confirm("Clear all history and personal bests? This cannot be undone.")) return;
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(PB_PREFIX) || k === HIST_KEY || k === DAILY_KEY)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  renderStats();
});

/* ---------- share ---------- */
function shareText() {
  const r = window.__lastResult;
  if (!r) return "";
  if (S.mode === "daily") {
    const st = getDailyState();
    return `typeflow daily ${todayKey()} — ${r.wpm} wpm, ${r.acc}% acc, ${r.cons}% cons 🔥${st.streak} day streak`;
  }
  return `typeflow ${modeLabel()} — ${r.wpm} wpm, ${r.acc}% acc, ${r.cons}% consistency`;
}

el.shareBtn.addEventListener("click", async () => {
  const txt = shareText();
  if (!txt) return;
  const done = () => {
    el.shareBtn.textContent = "copied!";
    setTimeout(() => { el.shareBtn.textContent = "copy result"; }, 1600);
  };
  try { await navigator.clipboard.writeText(txt); done(); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch { /* ignore */ }
    ta.remove();
  }
});

el.logo.addEventListener("click", () => { if (!el.statsView.hidden) closeStats(); });

/* focus handling — losing focus mid-test pauses the clock */
function showFocus(text) {
  if (S.finished) return;
  if (!el.resultsView.hidden || !el.statsView.hidden || !el.settingsPop.hidden || !el.cmdOverlay.hidden) return;
  if (text) el.focusnote.textContent = text;
  el.focusnote.classList.add("visible");
  el.typewrap.classList.add("unfocused");
}

function hideFocus() {
  el.focusnote.classList.remove("visible");
  el.typewrap.classList.remove("unfocused");
}

function pauseTest() {
  if (!S.started || S.finished || S.paused) return;
  S.paused = true;
  S.pauseAt = performance.now();
  document.body.classList.remove("typing-focus");
  showFocus("paused — click to resume");
}

function resumeTest() {
  if (!S.paused) return;
  S.paused = false;
  S.startTime += performance.now() - S.pauseAt; // shift the clock past the gap
  hideFocus();
  setCaret();
  if (el.settingsPop) el.settingsPop.hidden = true;
  if (el.btnSettings) el.btnSettings.classList.remove("active");
  document.body.classList.add("typing-focus");
}

el.typewrap.addEventListener("mousedown", (e) => {
  e.preventDefault();
  el.input.focus();
});
el.focusnote.addEventListener("click", () => el.input.focus());
el.input.addEventListener("focus", () => { hideFocus(); resumeTest(); });

// Prevent clicking topbar / subbar buttons from stealing focus and triggering focusnote
document.addEventListener("mousedown", (e) => {
  const isControl = e.target.closest(
    ".topbar button, .subbar button, .mode, .limit, .opt, .segbtn, #btn-settings, #btn-stats, #btn-lofi, .settings-pop"
  );
  if (isControl && document.activeElement === el.input) {
    e.preventDefault();
  }
});

let blurTimeout = null;
el.input.addEventListener("blur", (e) => {
  if (S.finished || !el.cmdOverlay.hidden || !el.statsView.hidden || !el.settingsPop.hidden) return;
  const rel = e.relatedTarget;
  if (rel && rel.closest(".topbar, .subbar, .settings-pop, .actions")) return;

  if (S.started) {
    pauseTest();
  } else {
    clearTimeout(blurTimeout);
    blurTimeout = setTimeout(() => {
      if (document.activeElement !== el.input && !S.started && !S.finished && el.settingsPop.hidden && el.statsView.hidden && el.cmdOverlay.hidden) {
        showFocus("click here to start typing");
      }
    }, 140);
  }
});

/* desktop keyboard */
let tabDown = false;
document.addEventListener("keydown", (e) => {
  // command palette swallows everything while it's open
  if (!el.cmdOverlay.hidden) {
    if (e.key === "Escape") { e.preventDefault(); closeCmd(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); cmdMove(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); cmdMove(-1); return; }
    if (e.key === "Enter") { e.preventDefault(); cmdRun(); return; }
    if (e.key === "Tab") { e.preventDefault(); return; }
    return; // let normal typing reach the filter field
  }

  if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    openCmd();
    return;
  }

  if (e.key === "Backspace" && (e.ctrlKey || e.altKey)) {
    e.preventDefault();
    if (resultsOpen || S.finished || S.paused) return;
    if (S.input[S.wi] && S.input[S.wi].length > 0) {
      while (S.input[S.wi] && S.input[S.wi].length > 0) {
        handleBackspace();
      }
    } else if (S.wi > 0 && S.input[S.wi - 1] !== S.words[S.wi - 1]) {
      handleBackspace();
      while (S.input[S.wi] && S.input[S.wi].length > 0) {
        handleBackspace();
      }
    }
    return;
  }

  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // settings popover: Escape closes it, blocks test typing
  if (!el.settingsPop.hidden) {
    if (e.key === "Escape") {
      clearAccentPreview();
      clearTypeSizePreview();
      el.settingsPop.hidden = true;
      el.btnSettings.classList.remove("active");
      if (window.matchMedia("(pointer: fine)").matches) el.input.focus();
    }
    return;
  }

  // stats view owns the keyboard while open
  if (!el.statsView.hidden) {
    if (e.key === "Escape") closeStats();
    return;
  }
  if (e.key === "Tab") { e.preventDefault(); tabDown = true; return; }
  const resultsOpen = !el.resultsView.hidden;

  if (e.key === "Enter") {
    if (resultsOpen) {
      const ae = document.activeElement;
      if (!(ae && ae.tagName === "BUTTON" && el.resultsView.contains(ae))) {
        e.preventDefault();
        restart();
      }
      return;
    }
    e.preventDefault(); // never insert a newline
    if (tabDown) { tabDown = false; restart(); }
    return;
  }
  if (e.key === "Escape") {
    if (resultsOpen) { restart(); return; }
    // in endless mode Esc ends the run instead of discarding it
    if (isEndless() && S.started && !S.finished) finish();
    else restart();
    return;
  }
  if (resultsOpen) return;

  // Fix being able to type while blurred:
  const isBlurred = el.focusnote.classList.contains("visible") ||
                    el.typewrap.classList.contains("unfocused") ||
                    document.activeElement !== el.input;
  if (isBlurred || S.paused) {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      el.input.focus();
      hideFocus();
      resumeTest();
      return; // Do NOT register the wake-up key into the words!
    }
  }

  if (e.key === "Backspace") { e.preventDefault(); handleBackspace(); return; }
  if (e.key.length === 1) { e.preventDefault(); handleChar(e.key); }
});
document.addEventListener("keyup", (e) => {
  if (e.key === "Tab") tabDown = false;
});

/* mobile input: diff-based */
let lastVal = "";
el.input.addEventListener("input", () => {
  const v = el.input.value;
  if (v.length > lastVal.length) {
    for (let i = lastVal.length; i < v.length; i++) handleChar(v[i]);
  } else if (v.length < lastVal.length) {
    for (let i = 0; i < lastVal.length - v.length; i++) handleBackspace();
  }
  lastVal = v;
});
el.input.addEventListener("focus", () => { lastVal = el.input.value; });

/* resize */
window.addEventListener("resize", () => {
  if (el.statsView && !el.statsView.hidden) {
    const hist = load(HIST_KEY, []);
    drawHistGraph(hist);
  }
  if (el.testView.hidden) return;
  S.LH = S.wordEls[0] ? S.wordEls[0].getBoundingClientRect().height : S.LH;
  updateScroll();
  setCaret();
  if (S.samples.length >= 2) drawLive();
});

/* ---------- init ---------- */
(function init() {
  const st = load("typeflow_settings", null);
  if (st) {
    S.mode = st.mode || "time";
    S.limit = st.limit || 30;
    S.punct = !!st.punct;
    S.nums = !!st.nums;
    S.caps = !!st.caps;
    // modes that no longer exist (quote/custom) fall back to time
    const valid = ["time", "words", "daily"];
    if (!valid.includes(S.mode)) S.mode = "time";
  }
  // theme
  const light = load("typeflow_theme", false);
  document.body.classList.toggle("light", !!light);
  el.optTheme.checked = !!light;
  const initialAccent = load("typeflow_accent", "blue");
  setAccent(initialAccent === "aurora" || initialAccent === "solar" ? "sakura" : initialAccent);
  setTypeSize(load("typeflow_type_size", "standard"));
  setVolume(soundVolume);

  el.optPunct.classList.toggle("active", S.punct);
  el.optNums.classList.toggle("active", S.nums);
  el.optCaps.classList.toggle("active", S.caps);
  el.optSound.classList.toggle("active", soundOn);
  setProfile(soundProfile);
  for (const b of el.modes.children) b.classList.toggle("active", b.dataset.mode === S.mode);
  if (LIMITS[S.mode] && !LIMITS[S.mode].includes(S.limit)) S.limit = LIMITS[S.mode][1];
  buildSubbar();
  restart();

  window.addEventListener("beforeunload", () => {
    save("typeflow_settings", { mode: S.mode, limit: S.limit, punct: S.punct, nums: S.nums, caps: S.caps });
  });
})();
