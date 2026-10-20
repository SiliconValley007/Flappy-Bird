(() => {
  "use strict";

  const crashEl = document.getElementById("crash");
  const reloadBtn = document.getElementById("reload");
  const srEl = document.getElementById("sr");
  function showCrash() {
    if (crashEl) crashEl.hidden = false;
  }
  window.onerror = function () {
    showCrash();
    return true;
  };
  window.onunhandledrejection = function () {
    showCrash();
  };
  if (reloadBtn)
    reloadBtn.addEventListener("click", function () {
      location.reload();
    });

  const C = document.getElementById("g");
  if (!C) return;
  let X = null;
  let ctxLost = false;
  function grabCtx() {
    let c = null;
    try {
      c = C.getContext("2d", { alpha: false, desynchronized: true });
    } catch (e) {}
    if (!c)
      try {
        c = C.getContext("2d", { alpha: false });
      } catch (e) {}
    if (!c)
      try {
        c = C.getContext("2d");
      } catch (e) {}
    X = c;
    if (X) {
      try {
        X.imageSmoothingEnabled = true;
        X.imageSmoothingQuality = "high";
      } catch (e) {}
    }
    return X;
  }
  if (!grabCtx()) {
    document.body.textContent = "FLAP needs a canvas-capable browser.";
    return;
  }

  const BUILD = "__BUILD__";
  const DEBUG_HOOK = (function () {
    try {
      return new URLSearchParams(location.search).get("debug") === "1";
    } catch (e) {
      return false;
    }
  })();
  function buildLabel() {
    if (!BUILD || BUILD.indexOf("__") === 0) return "dev";
    return BUILD.length > 7 ? BUILD.slice(0, 7) : BUILD;
  }

  const G = 0.52;
  const JMP = -8.15;
  const MF = 11.2;
  const BASE = 2.72;
  const STEP = 1 / 60;
  const SCHEMA = 3;
  const SAVE_KEY = "flap-save-v3";
  const LEGACY_BEST = "flap-best-v1";
  const LEGACY_SET = "flap-set-v2";
  const LEGACY_MUTE = "flap-mute-v1";
  const FONT_STACK = 'system-ui,-apple-system,"Segoe UI",sans-serif';
  const MODES = { classic: true, daily: true, practice: true };
  const SKINS = [
    {
      id: "sunny",
      name: "SUNNY",
      need: 0,
      body: "#F8D64E",
      wing: "#F0B429",
      wingDark: "#D89212",
      belly: "#F5C63A",
      beak: "#FF9F1C",
      beakDark: "#E8870A",
      eye: "#FFFDF2",
      pupil: "#1A1208",
      stripe: "rgba(255,255,255,0.3)",
      glow: "",
    },
    {
      id: "ember",
      name: "EMBER",
      need: 10,
      body: "#F26B38",
      wing: "#C84B1E",
      wingDark: "#A03812",
      belly: "#FFB07A",
      beak: "#FFD166",
      beakDark: "#E0A428",
      eye: "#FFF6EA",
      pupil: "#2A1208",
      stripe: "rgba(255,225,150,0.55)",
      glow: "rgba(255,120,40,0.35)",
    },
    {
      id: "frost",
      name: "FROST",
      need: 25,
      body: "#BFE9FF",
      wing: "#78C6E8",
      wingDark: "#4F9FC7",
      belly: "#E8F7FF",
      beak: "#FF9F1C",
      beakDark: "#D97706",
      eye: "#FFFFFF",
      pupil: "#123247",
      stripe: "rgba(255,255,255,0.8)",
      glow: "rgba(160,225,255,0.35)",
    },
    {
      id: "solar",
      name: "SOLAR",
      need: 50,
      body: "#FFE066",
      wing: "#FFB703",
      wingDark: "#D98E00",
      belly: "#FFF3B0",
      beak: "#FB8500",
      beakDark: "#C96A00",
      eye: "#FFFFFF",
      pupil: "#3A2400",
      stripe: "rgba(255,255,255,0.85)",
      glow: "rgba(255,220,90,0.45)",
    },
    {
      id: "void",
      name: "VOID",
      need: 100,
      body: "#8C7BFF",
      wing: "#5B45D6",
      wingDark: "#3E2EA8",
      belly: "#C6BBFF",
      beak: "#FFE066",
      beakDark: "#D4A800",
      eye: "#F4F0FF",
      pupil: "#1B123A",
      stripe: "rgba(255,230,110,0.8)",
      glow: "rgba(150,120,255,0.45)",
    },
  ];
  const SKIN_COUNT = SKINS.length;

  const xy = [0, 0];
  const spare = [];
  const padPrev = new Uint8Array(24);
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = mqReduce.matches;
  const fontCache = Object.create(null);

  function say(msg) {
    if (srEl) srEl.textContent = msg;
  }
  function clamp(n, a, b) {
    return n < a ? a : n > b ? b : n;
  }
  function clamp01(n) {
    n = +n;
    if (!isFinite(n)) return 0;
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function easeOutCubic(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return 1 - Math.pow(1 - t, 3);
  }
  function easeOutBack(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const r = ((pa >> 16) + (((pb >> 16) - (pa >> 16)) * t + 0.5)) | 0;
    const g = (((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t + 0.5)) | 0;
    const bl = ((pa & 255) + (((pb & 255) - (pa & 255)) * t + 0.5)) | 0;
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }
  function dayKey(d) {
    const t = d || new Date();
    return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate());
  }
  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch (e) {
      return false;
    }
  }
  function safeInt(n, d) {
    n = parseInt(n, 10);
    if (!isFinite(n) || n < 0) return d;
    return Math.min(n, 9007199254740991);
  }
  function fontFor(size) {
    const k = Math.max(8, Math.round(size));
    let f = fontCache[k];
    if (!f) {
      f = "800 " + k + "px " + FONT_STACK;
      fontCache[k] = f;
    }
    return f;
  }

  function defaultSave() {
    return {
      v: SCHEMA,
      best: 0,
      settings: { muted: false, sfx: 1, music: 0.4, haptics: true },
      stats: { flaps: 0, runs: 0, bestStreak: 0 },
      skins: { unlocked: [SKINS[0].id], selected: SKINS[0].id },
      history: [],
      daily: { date: "", best: 0 },
      tutorialSeen: false,
      mode: "classic",
    };
  }
  function skinById(id) {
    for (let i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }
  function sanitizeHistory(list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (let i = 0; i < list.length && out.length < 10; i++) {
      const e = list[i];
      if (!e || typeof e !== "object") continue;
      const s = safeInt(e.s, -1);
      if (s < 0) continue;
      const m = MODES[e.m] ? e.m : "classic";
      let d = typeof e.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.d) ? e.d : dayKey();
      let t = safeInt(e.t, 0);
      out.push({ s: s, m: m, d: d, t: t, k: typeof e.k === "string" ? e.k : "sunny" });
    }
    out.sort(function (a, b) {
      return b.s - a.s || b.t - a.t;
    });
    return out.slice(0, 10);
  }
  function unlockList(raw) {
    const out = [SKINS[0].id];
    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        const id = raw[i];
        for (let j = 0; j < SKINS.length; j++) {
          if (SKINS[j].id === id && out.indexOf(id) < 0) out.push(id);
        }
      }
    }
    return out;
  }
  function refreshUnlocks(s, announce) {
    const added = [];
    for (let i = 0; i < SKINS.length; i++) {
      const sk = SKINS[i];
      if (sk.need <= s.best && s.skins.unlocked.indexOf(sk.id) < 0) {
        s.skins.unlocked.push(sk.id);
        added.push(sk);
      }
    }
    if (added.length && announce) {
      scheduleSave();
      sfx("unlock");
      toast("SKIN UNLOCKED: " + added[0].name);
      if (bird && !reduce) burst(bird.x, bird.y, 16, ["#F8D64E", "#FFF7E0", "#8C7BFF"], 4 * U);
    }
    return added;
  }
  function loadSave() {
    const s = defaultSave();
    let hadNew = false;
    try {
      const raw = lsGet(SAVE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o === "object") {
          hadNew = o.v === SCHEMA;
          s.best = safeInt(o.best, 0);
          if (o.settings && typeof o.settings === "object") {
            s.settings.muted = !!o.settings.muted;
            s.settings.sfx = clamp01(o.settings.sfx == null ? 1 : o.settings.sfx);
            s.settings.music = clamp01(o.settings.music == null ? 0.4 : o.settings.music);
            s.settings.haptics = o.settings.haptics !== false;
          }
          if (o.stats && typeof o.stats === "object") {
            s.stats.flaps = safeInt(o.stats.flaps, 0);
            s.stats.runs = safeInt(o.stats.runs, 0);
            s.stats.bestStreak = safeInt(o.stats.bestStreak, 0);
          }
          if (o.skins && typeof o.skins === "object") {
            s.skins.unlocked = unlockList(o.skins.unlocked);
            s.skins.selected = typeof o.skins.selected === "string" ? o.skins.selected : s.skins.selected;
          }
          s.history = sanitizeHistory(o.history);
          if (o.daily && typeof o.daily === "object") {
            s.daily.date = typeof o.daily.date === "string" ? o.daily.date : "";
            s.daily.best = safeInt(o.daily.best, 0);
          }
          s.tutorialSeen = !!o.tutorialSeen;
          s.mode = MODES[o.mode] ? o.mode : s.mode;
        }
      }
    } catch (e) {}
    try {
      const b = safeInt(lsGet(LEGACY_BEST), 0);
      if (b > s.best) s.best = b;
    } catch (e) {}
    if (!hadNew) {
      try {
        const raw = lsGet(LEGACY_SET);
        if (raw) {
          const o = JSON.parse(raw);
          if (o && typeof o === "object") {
            if (typeof o.muted === "boolean") s.settings.muted = o.muted;
            if (o.sfx != null) s.settings.sfx = clamp01(o.sfx);
            if (o.music != null) s.settings.music = clamp01(o.music);
            if (o.haptics != null) s.settings.haptics = o.haptics !== false;
          }
        }
      } catch (e) {}
      if (lsGet(LEGACY_MUTE) === "1") s.settings.muted = true;
    }
    if (s.daily.best > s.best) s.best = s.daily.best;
    if (s.skins.unlocked.indexOf(s.skins.selected) < 0) s.skins.selected = SKINS[0].id;
    refreshUnlocks(s, false);
    return s;
  }

  let save = loadSave();
  let saveTimer = 0;
  function writeSave() {
    try {
      lsSet(SAVE_KEY, JSON.stringify(save));
    } catch (e) {}
    try {
      lsSet(LEGACY_BEST, String(save.best));
      lsSet(LEGACY_MUTE, save.settings.muted ? "1" : "0");
      lsSet(
        LEGACY_SET,
        JSON.stringify({
          v: 2,
          muted: save.settings.muted,
          sfx: save.settings.sfx,
          music: save.settings.music,
          haptics: save.settings.haptics,
        })
      );
    } catch (e) {}
  }
  function scheduleSave() {
    if (saveTimer) return;
    try {
      saveTimer = setTimeout(function () {
        saveTimer = 0;
        writeSave();
      }, 400);
    } catch (e) {}
  }
  function flushSave() {
    if (saveTimer) {
      try {
        clearTimeout(saveTimer);
      } catch (e) {}
      saveTimer = 0;
    }
    writeSave();
  }

  function ensureDaily() {
    const dk = dayKey();
    if (!save.daily || save.daily.date !== dk) {
      save.daily = { date: dk, best: 0 };
      scheduleSave();
    }
  }
  function modeFromLocation() {
    let m = "";
    try {
      const q = new URLSearchParams(location.search).get("mode");
      if (q) m = q.toLowerCase();
      if (!m) {
        const h = location.hash.replace(/^#\/?/, "").toLowerCase();
        if (MODES[h]) m = h;
      }
    } catch (e) {}
    return MODES[m] ? m : "";
  }
  const urlMode = modeFromLocation();
  let mode = urlMode || (MODES[save.mode] ? save.mode : "classic");
  if (urlMode) save.mode = urlMode;
  ensureDaily();
  let muted = save.settings.muted;
  let best = save.best;

  const toastObj = { text: "", at: 0, shown: 0, w: 0 };
  function toast(msg) {
    toastObj.text = msg;
    toastObj.at = performance.now() + 2100;
    toastObj.shown = performance.now();
    toastObj.w = 0;
    say(msg);
  }

  let W = 0;
  let H = 0;
  let DPR = 1;
  let U = 1;
  let UI = 1;
  let GH = 80;
  let SAT = 0;
  let SAB = 0;
  let SAL = 0;
  let SAR = 0;
  let last = 0;
  let acc = 0;
  let alpha = 1;
  let worldTime = 0;
  let st = "ready";
  let panel = "";
  let stateAt = 0;
  let transAt = 0;
  let died = 0;
  let score = 0;
  let bestStreakRun = 0;
  let runFlaps = 0;
  let runStreak = 0;
  let runStarted = false;
  let runRecorded = true;
  let preRunBest = 0;
  let newBestRun = false;
  let dailyNewBest = false;
  let tutorialUntil = 0;
  let shownScore = 0;
  let flash = 0;
  let shake = 0;
  let cam = 0;
  let punch = 1;
  let spd = 0;
  let bird = null;
  let pipes = [];
  let parts = [];
  let clouds = [];
  let hills = [];
  let groundX = 0;
  let groundPX = 0;
  let pipeRng = Math.random;
  let pipeSeed = 0;
  let quality = 2;
  let frameEMA = 16.7;
  let slowMs = 0;
  let raf = 0;
  let fitQueued = false;
  let renderedFrames = 0;

  if (!isFinite(best) || best < 0) best = 0;

  function isHttp() {
    try {
      const p = location.protocol;
      return p === "http:" || p === "https:";
    } catch (e) {
      return false;
    }
  }
  function isSecure() {
    try {
      return !!window.isSecureContext && isHttp();
    } catch (e) {
      return false;
    }
  }
  const fsSupported = (function () {
    try {
      if (!isHttp()) return false;
      const d = document;
      const en = d.fullscreenEnabled || d.webkitFullscreenEnabled;
      const el = d.documentElement;
      return !!(en && (el.requestFullscreen || el.webkitRequestFullscreen));
    } catch (e) {
      return false;
    }
  })();
  const shareSupported = (function () {
    try {
      if (!isHttp()) return false;
      if (isSecure() && navigator.share) return true;
      if (isSecure() && navigator.clipboard && navigator.clipboard.writeText) return true;
      if (document.queryCommandSupported && document.queryCommandSupported("copy")) return true;
      return typeof document.execCommand === "function";
    } catch (e) {
      return false;
    }
  })();
  function isFullscreen() {
    try {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    } catch (e) {
      return false;
    }
  }

  const MAX_SFX_VOICES = 8;
  const SFX_MIN_GAP = 0.04;
  const MASTER_LEVEL = 0.55;
  const MUSIC_SOFT = 0.55;
  const MUSIC_BEAT = { classic: 0.42, daily: 0.415, practice: 0.48 };
  const MUSIC_ROOT = { classic: 220, daily: 196, practice: 220 };
  const CHORDS = [
    [0, 4, 7, 11],
    [-3, 1, 4, 8],
    [-5, -1, 2, 7],
    [-4, 0, 3, 7],
  ];
  const MELODY_STEPS = [0, 2, 1, 3, 2, 1, 3, 2];

  let AC = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let limiter = null;
  let outGain = null;
  let musicDuck = null;
  let keepAlive = null;
  let keepGain = null;
  let buffers = {};
  let musicCache = {};
  let musicRaw = {};
  let sfxRaw = {};
  let sfxWarmTimer = 0;
  let audioPrewarmed = false;
  let musicSrc = null;
  let musicBufKey = "";
  let musicId = 0;
  let musicJobs = {};
  let bgTimer = 0;
  let lastSfxDuckAt = -1;
  let voices = [];
  let lastSfxAt = {};
  let duck = 1;
  let hadGesture = false;
  let ctxGen = 0;
  let pendingRebuild = false;
  let lastResumeAt = 0;
  let lastCtxTime = 0;
  let watchdog = 0;
  let stuckSilent = 0;
  let audioResumes = 0;
  let audioRebuilds = 0;
  let audioGlitches = 0;
  let lastMasterTarget = NaN;
  let lastSfxTarget = NaN;
  let lastMusicTarget = NaN;

  const TWO_PI = Math.PI * 2;
  function waveSample(type, cycle) {
    const p = cycle - Math.floor(cycle);
    if (type === "triangle") return 4 * Math.abs(p - 0.5) - 1;
    if (type === "square") return p < 0.5 ? 1 : -1;
    return Math.sin(p * TWO_PI);
  }
  function addTone(d, rate, t0, dur, type, f0, f1, vol) {
    const n0 = Math.max(0, Math.floor(t0 * rate));
    const ns = Math.max(1, Math.floor(dur * rate));
    const atk = Math.max(1, Math.floor(0.004 * rate));
    const rel = Math.max(1, Math.floor(0.02 * rate));
    const tau = Math.max(0.008, dur * 0.35);
    const decayMul = Math.exp(-1 / (tau * rate));
    let envDecay = 1;
    let phase = 0;
    for (let i = 0; i < ns; i++) {
      const idx = n0 + i;
      if (idx >= d.length) break;
      const f = f1 ? f0 + (f1 - f0) * (i / ns) : f0;
      phase += f / rate;
      const env =
        (i < atk ? i / atk : 1) *
        envDecay *
        Math.min(1, (ns - i) / rel);
      d[idx] += waveSample(type, phase) * vol * env;
      envDecay *= decayMul;
    }
  }
  function addMusicTone(d, rate, t0, dur, type, f, vol) {
    const n0 = Math.max(0, Math.floor(t0 * rate));
    const ns = Math.max(1, Math.floor(dur * rate));
    const atk = Math.max(1, Math.floor(0.02 * rate));
    const rel = Math.max(1, Math.floor(0.03 * rate));
    const decay = Math.max(0.05, dur * 0.5);
    const decayMul = Math.exp(-1 / (decay * rate));
    let envDecay = 1;
    let phase = 0;
    const step = f / rate;
    for (let i = 0; i < ns; i++) {
      const idx = n0 + i;
      if (idx >= d.length) break;
      const env =
        (i < atk ? i / atk : 1) *
        envDecay *
        Math.min(1, (ns - i) / rel);
      d[idx] += waveSample(type, phase) * vol * env;
      phase += step;
      envDecay *= decayMul;
    }
  }
  function addNoise(d, rate, t0, dur, vol, power) {
    const n0 = Math.max(0, Math.floor(t0 * rate));
    const ns = Math.max(1, Math.floor(dur * rate));
    for (let i = 0; i < ns; i++) {
      const idx = n0 + i;
      if (idx >= d.length) break;
      const u = i / ns;
      d[idx] += (Math.random() * 2 - 1) * vol * Math.pow(1 - u, power);
    }
  }
  function makeBuffer(d, rate) {
    const b = AC.createBuffer(1, d.length, rate);
    b.getChannelData(0).set(d);
    return b;
  }
  function warmSynth() {
    const d = new Float32Array(128);
    addTone(d, 22050, 0, 0.004, "sine", 440, 0, 0.1);
    addTone(d, 22050, 0, 0.004, "triangle", 440, 0, 0.1);
    addTone(d, 22050, 0, 0.004, "square", 440, 0, 0.1);
    d.fill(0);
    addMusicTone(d, 16000, 0, 0.004, "sine", 440, 0.1);
    d.fill(0);
    normalizePeak(d, 0.5);
  }
  function normalizePeak(d, peak) {
    let max = 0;
    for (let i = 0; i < d.length; i++) {
      const v = d[i] < 0 ? -d[i] : d[i];
      if (v > max) max = v;
    }
    if (max > 0) {
      const g = peak / max;
      for (let i = 0; i < d.length; i++) d[i] *= g;
    }
  }
  const SFX_SPEC = {
    jump: {
      dur: 0.15,
      peak: 0.5,
      build: function (d, r) {
        addTone(d, r, 0, 0.075, "sine", 620, 430, 1);
        addTone(d, r, 0, 0.05, "triangle", 1150, 900, 0.4);
      },
    },
    score: {
      dur: 0.85,
      peak: 0.55,
      build: function (d, r) {
        addTone(d, r, 0, 0.055, "triangle", 900, 0, 1);
        addTone(d, r, 0.055, 0.13, "sine", 1350, 0, 0.6);
        addTone(d, r, 0.12, 0.12, "sine", 523, 0, 0.7);
        addTone(d, r, 0.22, 0.12, "sine", 659, 0, 0.65);
        addTone(d, r, 0.32, 0.2, "sine", 784, 0, 0.6);
      },
    },
    hit: {
      dur: 0.42,
      peak: 0.6,
      build: function (d, r) {
        addTone(d, r, 0, 0.3, "square", 210, 48, 0.75);
        addNoise(d, r, 0, 0.18, 0.7, 1.7);
      },
    },
    unlock: {
      dur: 0.62,
      peak: 0.55,
      build: function (d, r) {
        addTone(d, r, 0, 0.12, "sine", 523, 0, 0.8);
        addTone(d, r, 0.1, 0.12, "triangle", 659, 0, 0.75);
        addTone(d, r, 0.2, 0.12, "sine", 784, 0, 0.75);
        addTone(d, r, 0.3, 0.24, "sine", 1046, 0, 0.7);
      },
    },
    best: {
      dur: 0.68,
      peak: 0.6,
      build: function (d, r) {
        addTone(d, r, 0, 0.12, "triangle", 523, 0, 0.8);
        addTone(d, r, 0.1, 0.12, "triangle", 659, 0, 0.8);
        addTone(d, r, 0.2, 0.12, "triangle", 784, 0, 0.8);
        addTone(d, r, 0.3, 0.3, "sine", 1046, 0, 0.9);
      },
    },
    ui: {
      dur: 0.09,
      peak: 0.35,
      build: function (d, r) {
        addTone(d, r, 0, 0.045, "triangle", 430, 300, 0.9);
      },
    },
  };
  const SFX_KINDS = Object.keys(SFX_SPEC);
  function nativeRate() {
    return Math.min(48000, AC ? AC.sampleRate : 48000);
  }
  function renderSfxRaw(kind) {
    const spec = SFX_SPEC[kind] || SFX_SPEC.ui;
    const rate = nativeRate();
    const d = new Float32Array(Math.max(1, Math.ceil(spec.dur * rate)));
    spec.build(d, rate);
    normalizePeak(d, spec.peak);
    sfxRaw[kind] = { rate: rate, data: d };
    return sfxRaw[kind];
  }
  function ensureSfx(kind) {
    if (!AC) return null;
    const key = SFX_SPEC[kind] ? kind : "ui";
    if (buffers[key]) return buffers[key];
    let raw = sfxRaw[key];
    if (!raw) raw = renderSfxRaw(key);
    if (!raw) return null;
    try {
      buffers[key] = makeBuffer(raw.data, raw.rate);
    } catch (e) {
      return null;
    }
    return buffers[key];
  }
  function warmSfx(kinds) {
    for (let i = 0; i < kinds.length; i++) {
      try {
        ensureSfx(kinds[i]);
      } catch (e) {}
    }
  }
  function warmSfxBackground() {
    if (sfxWarmTimer || !AC) return;
    const step = function () {
      sfxWarmTimer = 0;
      if (!AC) return;
      for (let i = 0; i < SFX_KINDS.length; i++) {
        if (!sfxRaw[SFX_KINDS[i]]) {
          try {
            ensureSfx(SFX_KINDS[i]);
          } catch (e) {}
          sfxWarmTimer = setTimeout(step, 40);
          return;
        }
      }
    };
    sfxWarmTimer = setTimeout(step, 60);
  }
  function activeMusicKey() {
    return MODES[mode] ? mode : "classic";
  }
  function shouldPlayMusic() {
    return hadGesture && !!AC && !!musicGain && save.settings.music > 0;
  }
  function createMusicJob(key) {
    const rate = nativeRate();
    const beat = MUSIC_BEAT[key] || 0.42;
    const root = MUSIC_ROOT[key] || 220;
    const loopN = Math.ceil(32 * beat * rate);
    return {
      key: key,
      rate: rate,
      beat: beat,
      root: root,
      loopN: loopN,
      tmp: new Float32Array(loopN + Math.ceil(beat * 2 * rate)),
      step: 0,
      gen: ctxGen,
      timer: 0,
    };
  }
  function renderMusicSlice(job) {
    if (job.step >= 32) return false;
    const i = job.step;
    const bar = i >> 3;
    const chord = CHORDS[bar];
    const barT = bar * 8 * job.beat;
    const note = chord[MELODY_STEPS[i & 7] % chord.length];
    const oct = (i & 7) === 5 ? 2 : (i & 7) === 7 ? 1.5 : 1;
    const f = job.root * Math.pow(2, note / 12) * oct;
    addMusicTone(
      job.tmp,
      job.rate,
      barT + (i & 7) * job.beat,
      job.beat * 0.9,
      i & 1 ? "triangle" : "sine",
      f,
      (i & 7) === 0 ? 0.16 : 0.1
    );
    if ((i & 1) === 0) {
      const bassI = (i & 7) >> 1;
      const bf = job.root * Math.pow(2, (chord[bassI] - 12) / 12) * 0.5;
      addMusicTone(job.tmp, job.rate, barT + bassI * job.beat * 2, job.beat * 1.5, "sine", bf, 0.14);
    }
    job.step++;
    return job.step < 32;
  }
  function finishMusicJob(job) {
    const loopN = job.loopN;
    const d = new Float32Array(loopN);
    for (let i = 0; i < loopN; i++) d[i] = job.tmp[i] + job.tmp[i + loopN];
    normalizePeak(d, 0.6);
    musicRaw[job.key] = { rate: job.rate, data: d };
    let b = null;
    try {
      b = makeBuffer(d, job.rate);
    } catch (e) {}
    if (b) musicCache[job.key] = b;
    delete musicJobs[job.key];
    if (job.key === activeMusicKey() && shouldPlayMusic()) {
      if (b) startMusicBuffer(job.key, b);
      else requestMusic(job.key);
    }
    scheduleMusicBackground();
  }
  function musicBufferFor(key) {
    if (!AC) return null;
    if (musicCache[key]) return musicCache[key];
    const raw = musicRaw[key];
    if (!raw) return null;
    try {
      musicCache[key] = makeBuffer(raw.data, raw.rate);
      return musicCache[key];
    } catch (e) {
      return null;
    }
  }
  function startMusicBuffer(key, buf) {
    if (!AC || !musicGain || !buf) return;
    if (musicSrc && musicBufKey === key) return;
    stopMusic();
    try {
      const src = AC.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(musicGain);
      src.onended = function () {
        if (musicSrc === src) {
          musicSrc = null;
          musicBufKey = "";
        }
      };
      src.start(0);
      musicSrc = src;
      musicBufKey = key;
      musicId++;
    } catch (e) {
      musicSrc = null;
      musicBufKey = "";
    }
  }
  function pumpMusicJob(job) {
    musicJobs[job.key] = job;
    const step = function () {
      job.timer = 0;
      if (job.gen !== ctxGen || !AC) {
        delete musicJobs[job.key];
        return;
      }
      let more = false;
      try {
        more = renderMusicSlice(job);
      } catch (e) {
        delete musicJobs[job.key];
        return;
      }
      if (more) {
        job.timer = setTimeout(step, 0);
      } else {
        try {
          finishMusicJob(job);
        } catch (e) {
          delete musicJobs[job.key];
        }
      }
    };
    step();
  }
  function requestMusic(key) {
    if (!AC || musicCache[key] || musicJobs[key]) return;
    pumpMusicJob(createMusicJob(key));
  }
  function scheduleMusicBackground() {
    if (!AC || bgTimer) return;
    if (Object.keys(musicJobs).length) return;
    const keys = Object.keys(MUSIC_BEAT);
    let key = "";
    for (let i = 0; i < keys.length; i++) {
      if (!musicRaw[keys[i]]) {
        key = keys[i];
        break;
      }
    }
    if (!key) return;
    const job = createMusicJob(key);
    musicJobs[key] = job;
    const step = function () {
      bgTimer = 0;
      if (job.gen !== ctxGen || !AC) {
        delete musicJobs[key];
        return;
      }
      let more = false;
      try {
        more = renderMusicSlice(job);
      } catch (e) {
        delete musicJobs[key];
        return;
      }
      if (more) {
        bgTimer = setTimeout(step, 20);
      } else {
        try {
          finishMusicJob(job);
        } catch (e) {
          delete musicJobs[key];
        }
      }
    };
    bgTimer = setTimeout(step, 90);
  }
  function stopMusic() {
    if (musicSrc) {
      try {
        musicSrc.onended = null;
      } catch (e) {}
      try {
        musicSrc.stop();
      } catch (e) {}
      try {
        musicSrc.disconnect();
      } catch (e) {}
      musicSrc = null;
    }
    musicBufKey = "";
  }
  function ensureMusic() {
    if (!AC || !musicGain) return;
    if (!shouldPlayMusic()) return;
    const key = activeMusicKey();
    if (musicSrc && musicBufKey === key) return;
    let buf = musicBufferFor(key);
    if (!buf) {
      if (musicJobs[key]) return;
      requestMusic(key);
      return;
    }
    startMusicBuffer(key, buf);
    scheduleMusicBackground();
  }

  function musicBase() {
    if (muted) return 0;
    if (document.hidden) return 0;
    return save.settings.music * MUSIC_SOFT * duck;
  }
  function applyGain() {
    if (!AC || !masterGain) return;
    const nextDuck = st === "paused" ? 0.5 : 1;
    duck = nextDuck;
    const masterT = muted ? 0 : MASTER_LEVEL;
    const sfxT = muted ? 0 : save.settings.sfx;
    const musicT = musicBase();
    try {
      if (masterT !== lastMasterTarget) {
        lastMasterTarget = masterT;
        const t = AC.currentTime;
        masterGain.gain.cancelScheduledValues(t);
        masterGain.gain.setValueAtTime(masterGain.gain.value, t);
        masterGain.gain.setTargetAtTime(masterT, t, 0.03);
      }
      if (sfxGain && sfxT !== lastSfxTarget) {
        lastSfxTarget = sfxT;
        const t = AC.currentTime;
        sfxGain.gain.cancelScheduledValues(t);
        sfxGain.gain.setValueAtTime(sfxGain.gain.value, t);
        sfxGain.gain.setTargetAtTime(sfxT, t, 0.03);
      }
      if (musicGain && musicT !== lastMusicTarget) {
        lastMusicTarget = musicT;
        const t = AC.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.setTargetAtTime(musicT, t, 0.08);
      }
    } catch (e) {}
    if (hadGesture) ensureMusic();
  }
  function resetMusicDuck() {
    if (!AC || !musicDuck) return;
    try {
      const now = AC.currentTime;
      const g = musicDuck.gain;
      if (g.value >= 0.98 && lastSfxDuckAt < 0) return;
      g.cancelScheduledValues(now);
      g.setValueAtTime(1, now);
    } catch (e) {}
    lastSfxDuckAt = -1;
  }
  function duckMusicForSfx() {
    if (!AC || !musicDuck || muted || document.hidden) return;
    const now = AC.currentTime;
    if (now - lastSfxDuckAt >= 0 && now - lastSfxDuckAt < 0.12) return;
    lastSfxDuckAt = now;
    try {
      const g = musicDuck.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.55, now + 0.02);
      g.setTargetAtTime(1, now + 0.12, 0.1);
    } catch (e) {}
  }
  function healMusic() {
    if (!hadGesture || !AC || muted || document.hidden) return;
    if (!shouldPlayMusic()) return;
    try {
      if (musicDuck && lastSfxDuckAt >= 0 && AC.currentTime - lastSfxDuckAt > 0.6) resetMusicDuck();
    } catch (e) {}
    const key = activeMusicKey();
    let ended = !musicSrc || musicBufKey !== key;
    try {
      if (musicSrc && musicSrc.playbackState === "finished") ended = true;
    } catch (e) {}
    if (ended) {
      const had = !!musicSrc || !!musicBufKey;
      ensureMusic();
      if (had) audioGlitches++;
    }
    try {
      if (musicGain && lastMusicTarget > 0.02 && musicGain.gain.value < 0.01) {
        lastMusicTarget = NaN;
        applyGain();
        audioGlitches++;
      }
    } catch (e) {}
  }

  function releaseVoice(v) {
    const i = voices.indexOf(v);
    if (i >= 0) voices.splice(i, 1);
    try {
      v.src.onended = null;
    } catch (e) {}
    try {
      v.src.disconnect();
    } catch (e) {}
    try {
      v.g.disconnect();
    } catch (e) {}
  }
  function stealVoice() {
    const v = voices.shift();
    if (!v) return;
    try {
      v.src.onended = null;
    } catch (e) {}
    try {
      v.src.stop();
    } catch (e) {}
    try {
      v.src.disconnect();
    } catch (e) {}
    try {
      v.g.disconnect();
    } catch (e) {}
  }
  function releaseAllVoices() {
    while (voices.length) stealVoice();
    lastSfxAt = {};
  }
  function playSfx(kind, buf, gain) {
    const a = audio();
    if (!a || !buf || !sfxGain) return;
    const now = a.currentTime;
    if (lastSfxAt[kind] != null && now - lastSfxAt[kind] < SFX_MIN_GAP) return;
    lastSfxAt[kind] = now;
    while (voices.length >= MAX_SFX_VOICES) stealVoice();
    let src = null;
    let g = null;
    try {
      src = a.createBufferSource();
      g = a.createGain();
      src.buffer = buf;
      g.gain.value = gain;
      src.connect(g);
      g.connect(sfxGain);
    } catch (e) {
      try {
        if (src) src.disconnect();
        if (g) g.disconnect();
      } catch (e2) {}
      return;
    }
    const voice = { src: src, g: g };
    src.onended = function () {
      releaseVoice(voice);
    };
    try {
      src.start(0);
    } catch (e) {
      releaseVoice(voice);
      return;
    }
    voices.push(voice);
    duckMusicForSfx();
  }
  function teardownGraph() {
    stopMusic();
    releaseAllVoices();
    if (bgTimer) {
      try {
        clearTimeout(bgTimer);
      } catch (e) {}
      bgTimer = 0;
    }
    if (sfxWarmTimer) {
      try {
        clearTimeout(sfxWarmTimer);
      } catch (e) {}
      sfxWarmTimer = 0;
    }
    const jobs = musicJobs;
    musicJobs = {};
    for (const k in jobs) {
      if (jobs[k] && jobs[k].timer) {
        try {
          clearTimeout(jobs[k].timer);
        } catch (e) {}
      }
    }
    lastSfxDuckAt = -1;
    lastMasterTarget = NaN;
    lastSfxTarget = NaN;
    lastMusicTarget = NaN;
    try {
      if (keepAlive) keepAlive.stop();
    } catch (e) {}
    try {
      if (keepAlive) keepAlive.disconnect();
    } catch (e) {}
    try {
      if (keepGain) keepGain.disconnect();
    } catch (e) {}
    try {
      if (musicDuck) musicDuck.disconnect();
    } catch (e) {}
    try {
      if (masterGain) masterGain.disconnect();
    } catch (e) {}
    try {
      if (sfxGain) sfxGain.disconnect();
    } catch (e) {}
    try {
      if (musicGain) musicGain.disconnect();
    } catch (e) {}
    try {
      if (limiter) limiter.disconnect();
    } catch (e) {}
    try {
      if (outGain) outGain.disconnect();
    } catch (e) {}
    keepAlive = null;
    keepGain = null;
    masterGain = null;
    sfxGain = null;
    musicGain = null;
    musicDuck = null;
    limiter = null;
    outGain = null;
    buffers = {};
    musicCache = {};
    musicSrc = null;
    musicBufKey = "";
  }
  function startKeepAlive() {
    if (!AC || keepAlive || !masterGain) return;
    try {
      const n = Math.max(256, Math.floor(AC.sampleRate * 0.5));
      const b = AC.createBuffer(1, n, AC.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      keepGain = AC.createGain();
      keepGain.gain.value = 0.00032;
      keepGain.connect(masterGain);
      keepAlive = AC.createBufferSource();
      keepAlive.buffer = b;
      keepAlive.loop = true;
      keepAlive.connect(keepGain);
      keepAlive.start(0);
    } catch (e) {
      keepAlive = null;
      keepGain = null;
    }
  }
  function resumeContext() {
    if (!AC) return;
    const now = Date.now();
    if (now - lastResumeAt < 250) return;
    try {
      const s = AC.state;
      if (s === "closed") {
        pendingRebuild = true;
        return;
      }
      if (s !== "suspended" && s !== "interrupted") return;
      lastResumeAt = now;
      audioResumes++;
      const p = AC.resume();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function buildContext() {
    if (AC && AC.state !== "closed") return AC;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      AC = new Ctor({ latencyHint: "playback" });
      masterGain = AC.createGain();
      sfxGain = AC.createGain();
      musicGain = AC.createGain();
      limiter = AC.createDynamicsCompressor();
      outGain = AC.createGain();
      musicDuck = AC.createGain();
      outGain.gain.value = 0.65;
      musicDuck.gain.value = 1;
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      lastMasterTarget = muted ? 0 : MASTER_LEVEL;
      lastSfxTarget = muted ? 0 : save.settings.sfx;
      lastMusicTarget = musicBase();
      masterGain.gain.value = lastMasterTarget;
      sfxGain.gain.value = lastSfxTarget;
      musicGain.gain.value = lastMusicTarget;
      sfxGain.connect(masterGain);
      musicGain.connect(musicDuck);
      musicDuck.connect(masterGain);
      masterGain.connect(limiter);
      limiter.connect(outGain);
      outGain.connect(AC.destination);
      buffers = {};
      musicCache = {};
      const gen = ++ctxGen;
      try {
        AC.onstatechange = function () {
          onCtxState(gen);
        };
      } catch (e) {}
      lastCtxTime = AC.currentTime;
      startKeepAlive();
      warmSynth();
      return AC;
    } catch (e) {
      AC = null;
      teardownGraph();
      return null;
    }
  }
  function onCtxState(gen) {
    if (gen !== ctxGen || !AC) return;
    try {
      const s = AC.state;
      if (s === "running") {
        lastCtxTime = AC.currentTime;
      } else if (s === "closed") {
        pendingRebuild = true;
        audioGlitches++;
      } else if (s === "suspended" || s === "interrupted") {
        if (hadGesture && !document.hidden) resumeContext();
      }
    } catch (e) {}
  }
  function rebuildAudio() {
    try {
      if (AC && AC.state !== "closed") return false;
    } catch (e) {}
    const old = AC;
    AC = null;
    ctxGen++;
    try {
      if (old) old.onstatechange = null;
    } catch (e) {}
    teardownGraph();
    lastCtxTime = 0;
    pendingRebuild = false;
    try {
      if (buildContext()) {
        audioRebuilds++;
        resumeContext();
        warmSfx(["jump", "ui"]);
        warmSfxBackground();
        applyGain();
        ensureMusic();
        return true;
      }
    } catch (e) {}
    return false;
  }
  function watchdogTick() {
    if (!hadGesture || !AC) return;
    try {
      const s = AC.state;
      if (s === "closed") {
        pendingRebuild = true;
        return;
      }
      if (s === "suspended" || s === "interrupted") {
        if (!document.hidden) resumeContext();
        return;
      }
      if (s === "running") {
        const t = AC.currentTime;
        if (t > lastCtxTime + 0.02) {
          lastCtxTime = t;
          stuckSilent = 0;
        } else if (!document.hidden && !muted && save.settings.music > 0) {
          stuckSilent++;
          if (stuckSilent >= 2) {
            stuckSilent = 0;
            resumeContext();
            pendingRebuild = true;
            audioGlitches++;
          }
        }
        if (!document.hidden && !muted && save.settings.music > 0) healMusic();
      }
    } catch (e) {}
  }
  function audio() {
    if (!hadGesture) return null;
    try {
      if (!AC || AC.state === "closed") {
        pendingRebuild = true;
        return null;
      }
    } catch (e) {
      pendingRebuild = true;
      return null;
    }
    resumeContext();
    return AC;
  }
  function unlockAudio(realGesture) {
    const isGesture = realGesture !== false;
    const wasGesture = hadGesture;
    if (isGesture) hadGesture = true;
    if (!hadGesture) return;
    let rebuilt = false;
    if (isGesture) {
      let closed = false;
      try {
        closed = !!(AC && AC.state === "closed");
      } catch (e) {
        closed = !!AC;
      }
      if (pendingRebuild || closed) rebuilt = rebuildAudio();
    }
    if (!AC) {
      if (!isGesture) return;
      buildContext();
    }
    if (!AC) return;
    resumeContext();
    startKeepAlive();
    if (!wasGesture || rebuilt) {
      warmSfx(["jump", "ui"]);
      warmSfxBackground();
      applyGain();
      ensureMusic();
    } else {
      healMusic();
    }
  }
  function sfx(kind) {
    if (muted || save.settings.sfx <= 0) return;
    if (!hadGesture || !AC) return;
    const buf = ensureSfx(kind) || ensureSfx("ui");
    if (!buf) return;
    const gain = kind === "hit" ? 0.95 : kind === "jump" ? 0.9 : 0.85;
    playSfx(kind, buf, gain);
  }
  function markGesture() {
    unlockAudio(true);
    healMusic();
  }
  try {
    document.addEventListener("pointerdown", markGesture, { capture: true, passive: true });
    document.addEventListener("touchstart", markGesture, { capture: true, passive: true });
    document.addEventListener("keydown", markGesture, { capture: true });
  } catch (e) {}
  if (typeof setInterval === "function") watchdog = setInterval(watchdogTick, 2000);

  function rumble(pat) {
    if (!save.settings.haptics || reduce) return;
    try {
      if (typeof navigator.vibrate === "function") navigator.vibrate(pat);
    } catch (e) {}
  }

  function cssPx(name) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  let skyCv = null;
  let skyX = null;
  let skyKey = "";
  let groundCv = null;
  let groundXctx = null;
  let groundKey = "";
  let cloudFill = "rgba(255,255,255,0.82)";
  let hillFillA = "#4E9A42";
  let hillFillB = "#5AAE4A";
  let pipeGrad = null;
  let pipeGradKey = "";
  let birdSprite = null;
  let birdSpriteKey = "";

  function dayT() {
    return 0.5 + 0.5 * Math.cos(score * 0.11);
  }
  function ensureSky() {
    const t = (dayT() * 8) | 0;
    const key = W + "x" + H + ":" + t;
    if (skyKey === key && skyCv) return;
    skyKey = key;
    if (!skyCv) {
      skyCv = document.createElement("canvas");
      skyX = skyCv.getContext("2d");
    }
    skyCv.width = Math.max(1, W);
    skyCv.height = Math.max(1, H);
    const d = dayT();
    const g = skyX.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mixHex("#1A2A58", "#4EB8D0", d));
    g.addColorStop(0.45, mixHex("#2A3A70", "#7ED4E6", d));
    g.addColorStop(0.78, mixHex("#3A4060", "#C8E8A8", d));
    g.addColorStop(1, mixHex("#4A4060", "#E8D98A", d));
    skyX.fillStyle = g;
    skyX.fillRect(0, 0, W, H);
    const sunX = W * 0.78;
    const sunY = Math.max(SAT + 36 * U, H * 0.16);
    const sr = 38 * U;
    const moonA = 1 - d;
    const sg = skyX.createRadialGradient(sunX, sunY, 2, sunX, sunY, sr * 3.2);
    sg.addColorStop(0, "rgba(255,236,150," + (0.95 * d + 0.2 * moonA) + ")");
    sg.addColorStop(0.35, "rgba(255,200,80," + 0.35 * d + ")");
    sg.addColorStop(1, "rgba(255,180,60,0)");
    skyX.fillStyle = sg;
    skyX.beginPath();
    skyX.arc(sunX, sunY, sr * 3.2, 0, 7);
    skyX.fill();
    skyX.fillStyle = d > 0.35 ? "#FFE99A" : "#E8ECF8";
    skyX.beginPath();
    skyX.arc(sunX, sunY, sr * (0.7 + 0.3 * d), 0, 7);
    skyX.fill();
    if (d < 0.45) {
      skyX.fillStyle = "rgba(255,255,255," + 0.55 * moonA + ")";
      for (let i = 0; i < 18; i++) {
        const sx = ((i * 97 + score * 13) % Math.max(1, W)) + 0.5;
        const sy = ((i * 53 + 20) % Math.max(1, (H - GH) * 0.55)) + SAT;
        skyX.fillRect(sx, sy, 2, 2);
      }
    }
    const night = 1 - d;
    cloudFill =
      "rgba(" +
      (255 - night * 40) +
      "," +
      (255 - night * 30) +
      "," +
      (255 - night * 10) +
      "," +
      (0.88 - night * 0.15) +
      ")";
    hillFillA = mixHex("#2E5A38", "#5AAE4A", d);
    hillFillB = mixHex("#244A30", "#4E9A42", d);
  }
  function ensureGround() {
    const key = W + ":" + ((U * 100) | 0) + ":" + ((GH * 10) | 0);
    if (groundKey === key && groundCv) return;
    groundKey = key;
    if (!groundCv) {
      groundCv = document.createElement("canvas");
      groundXctx = groundCv.getContext("2d");
    }
    const tw = Math.max(24, Math.round(24 * U));
    groundCv.width = tw;
    groundCv.height = Math.max(1, Math.round(GH));
    const gx = groundXctx;
    gx.clearRect(0, 0, tw, GH);
    gx.fillStyle = "#DED895";
    gx.fillRect(0, 0, tw, GH);
    gx.fillStyle = "#5EBF2A";
    gx.fillRect(0, 0, tw, 18 * U);
    gx.fillStyle = "#4AA01E";
    gx.fillRect(0, 18 * U, tw, 6 * U);
    gx.strokeStyle = "#3D7A14";
    gx.lineWidth = 2 * U;
    gx.beginPath();
    gx.moveTo(0, 0);
    gx.lineTo(8 * U, 18 * U);
    gx.stroke();
    gx.fillStyle = "#C9B56A";
    gx.fillRect(tw * 0.2, 32 * U, 10 * U, 5 * U);
  }
  function ensurePipeGrad() {
    const w = 68 * U;
    const key = Math.round(w * 100) + ":" + Math.round(U * 1000);
    if (pipeGradKey === key && pipeGrad) return;
    pipeGradKey = key;
    pipeGrad = X.createLinearGradient(0, 0, w, 0);
    pipeGrad.addColorStop(0, "#3D7A14");
    pipeGrad.addColorStop(0.18, "#8AD63A");
    pipeGrad.addColorStop(0.45, "#5BB01F");
    pipeGrad.addColorStop(0.82, "#3D7A14");
    pipeGrad.addColorStop(1, "#2E5C0E");
  }

  function fit() {
    const oldW = W;
    const oldH = H;
    const oldU = U;
    const oldGH = GH;
    const oldPlay = Math.max(1, oldH - oldGH);
    const vv = window.visualViewport;
    let w = innerWidth;
    let h = innerHeight;
    let ox = 0;
    let oy = 0;
    if (vv && vv.width && vv.height) {
      w = vv.width;
      h = vv.height;
      ox = vv.offsetLeft || 0;
      oy = vv.offsetTop || 0;
    }
    W = Math.max(1, Math.round(w));
    H = Math.max(1, Math.round(h));
    const cap = quality === 0 ? 1 : quality === 1 ? 1.5 : 2;
    DPR = Math.max(1, Math.min(devicePixelRatio || 1, cap));
    C.width = Math.max(1, Math.round(W * DPR));
    C.height = Math.max(1, Math.round(H * DPR));
    C.style.width = W + "px";
    C.style.height = H + "px";
    C.style.left = ox + "px";
    C.style.top = oy + "px";
    if (X) {
      X.setTransform(DPR, 0, 0, DPR, 0, 0);
      X.imageSmoothingEnabled = true;
      X.imageSmoothingQuality = "high";
    }
    SAT = cssPx("--sat");
    SAB = cssPx("--sab");
    SAL = cssPx("--sal");
    SAR = cssPx("--sar");
    U = Math.max(0.42, Math.min(H / 640, W / 390, 2.4));
    UI = Math.max(0.8, Math.min(1.45, Math.min(W / 390, H / 640)));
    GH = Math.max(72 * U, H * 0.12 + SAB);
    skyKey = "";
    groundKey = "";
    pipeGradKey = "";
    birdSpriteKey = "";
    if (bird && oldW > 0 && oldH > 0) {
      const play = Math.max(1, H - GH);
      const sx = W / oldW;
      const sy = play / oldPlay;
      const su = U / oldU;
      bird.x *= sx;
      bird.y = Math.min(play - 8, Math.max(8, bird.y * sy));
      bird.px = bird.x;
      bird.py = bird.y;
      bird.s = 42 * U;
      bird.vy *= su;
      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        p.x *= sx;
        p.px = p.x;
        p.w = 68 * U;
        p.gap *= sy;
        p.mid *= sy;
      }
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.x *= sx;
        c.px = c.x;
        c.y = Math.min(H * 0.5, c.y * sy);
        c.py = c.y;
        c.s *= su;
      }
      for (let i = 0; i < hills.length; i++) {
        const hi = hills[i];
        hi.x *= sx;
        hi.px = hi.x;
        hi.w *= sx;
        hi.h *= su;
      }
      spd = BASE * U;
    }
    layoutUI();
  }

  function mkBird() {
    const b = {
      x: Math.min(Math.max(72 * U, W * 0.18 + SAL), W * 0.28),
      y: (H - GH) * 0.42,
      vy: 0,
      s: 42 * U,
      sx: 1,
      sy: 1,
      rot: 0,
      wing: 0,
      px: 0,
      py: 0,
      prot: 0,
      psx: 1,
      psy: 1,
    };
    b.px = b.x;
    b.py = b.y;
    return b;
  }
  function resetPipeRandom() {
    if (mode === "daily") {
      pipeSeed = hashString("flap-daily:" + dayKey());
      pipeRng = mulberry32(pipeSeed);
    } else {
      pipeSeed = 0;
      pipeRng = Math.random;
    }
  }
  function prand() {
    return pipeRng();
  }
  function resetWorld() {
    if (mode === "daily") ensureDaily();
    if (!bird) bird = mkBird();
    else {
      bird.x = Math.min(Math.max(72 * U, W * 0.18 + SAL), W * 0.28);
      bird.y = (H - GH) * 0.42;
      bird.vy = 0;
      bird.s = 42 * U;
      bird.sx = 1;
      bird.sy = 1;
      bird.rot = 0;
      bird.wing = 0;
      bird.px = bird.x;
      bird.py = bird.y;
      bird.prot = 0;
      bird.psx = 1;
      bird.psy = 1;
    }
    pipes.length = 0;
    parts.length = 0;
    clouds.length = 0;
    hills.length = 0;
    groundX = 0;
    groundPX = 0;
    spd = BASE * U;
    score = 0;
    punch = 1;
    cam = 0;
    flash = 0;
    shake = 0;
    bestStreakRun = 0;
    runFlaps = 0;
    runStreak = 0;
    runStarted = false;
    runRecorded = false;
    preRunBest = best;
    newBestRun = false;
    dailyNewBest = false;
    resetPipeRandom();
    skyKey = "";
    const cloudN = quality === 0 ? 4 : 7;
    for (let i = 0; i < cloudN; i++) {
      const c = {
        x: Math.random() * W,
        y: (H - GH) * (0.08 + Math.random() * 0.42),
        s: (0.55 + Math.random() * 0.9) * U,
        v: 0.18 + Math.random() * 0.22,
        px: 0,
        py: 0,
      };
      c.px = c.x;
      c.py = c.y;
      clouds.push(c);
    }
    for (let i = 0; i < 5; i++) {
      const hi = {
        x: i * W * 0.46,
        w: W * 0.55,
        h: (40 + Math.random() * 50) * U,
        c: i & 1,
        px: 0,
      };
      hi.px = hi.x;
      hills.push(hi);
    }
  }
  function spawnPipe(first) {
    const practice = mode === "practice";
    const play = Math.max(80, H - GH);
    const birdH = bird.s * 0.72;
    const ease = Math.min(score, 40) / 40;
    let minGap = Math.max(
      birdH * 3.15,
      play * (practice ? 0.3 - ease * 0.025 : 0.24 - ease * 0.03),
      (practice ? 126 : 108 - ease * 6) * U
    );
    let maxGap = Math.min(play * (practice ? 0.46 : 0.4), minGap + 32 * U);
    if (maxGap < minGap) maxGap = minGap;
    let gap = minGap + prand() * Math.max(0, maxGap - minGap);
    const margin = Math.max(birdH * 1.15, play * 0.08, 28 * U);
    let lo = margin + gap * 0.5;
    let hi = play - margin - gap * 0.5;
    let mid;
    if (hi <= lo + 4) {
      gap = Math.min(Math.max(birdH * 2.9, play * 0.28), play - margin * 2);
      lo = margin + gap * 0.5;
      hi = play - margin - gap * 0.5;
      mid = play * 0.5;
    } else {
      if (first && mode !== "daily") {
        const prefer = Math.max(lo, Math.min(hi, bird.y));
        mid = prefer * 0.65 + (lo + prand() * (hi - lo)) * 0.35;
      } else {
        mid = lo + prand() * (hi - lo);
      }
    }
    const dist = first ? Math.max(260 * U, Math.min(340 * U, W * 0.55)) : 0;
    const x = first
      ? bird.x + dist
      : pipes.length
        ? pipes[pipes.length - 1].x + Math.max(210 * U, 248 * U)
        : W + 8 * U;
    pipes.push({ x: x, w: 68 * U, gap: gap, mid: mid, hit: 0, px: x });
  }
  function getPart() {
    if (spare.length) return spare.pop();
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 1,
      dec: 0.02,
      sz: 2,
      c: "#fff",
      g: 0.18,
      px: 0,
      py: 0,
    };
  }
  function particleCap() {
    if (reduce) return 24;
    return quality === 0 ? 34 : quality === 1 ? 62 : 96;
  }
  function burst(x, y, n, cols, pow) {
    if (reduce) n = Math.min(n, 6);
    const cap = particleCap();
    if (parts.length >= cap) return;
    if (n > cap - parts.length) n = cap - parts.length;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = pow * (0.35 + Math.random());
      const q = getPart();
      q.x = x;
      q.y = y;
      q.px = x;
      q.py = y;
      q.vx = Math.cos(a) * p;
      q.vy = Math.sin(a) * p - p * 0.3;
      q.life = 1;
      q.dec = 0.014 + Math.random() * 0.02;
      q.sz = (2.2 + Math.random() * 3.4) * U;
      q.c = cols[i % cols.length];
      q.g = 0.18;
      parts.push(q);
    }
  }

  function startRun() {
    if (runStarted) return;
    runStarted = true;
    preRunBest = best;
    save.stats.runs++;
    scheduleSave();
    if (!save.tutorialSeen) {
      tutorialUntil = performance.now() + 3600;
      save.tutorialSeen = true;
      scheduleSave();
    }
  }
  function finishRun() {
    if (!runStarted || runRecorded) return;
    runRecorded = true;
    if (runStreak > save.stats.bestStreak) save.stats.bestStreak = runStreak;
    if (mode === "daily" && score > save.daily.best) {
      save.daily.best = score;
      dailyNewBest = score > 0;
    }
    if (mode !== "practice" && score > 0) {
      save.history.push({
        s: score,
        m: mode,
        d: dayKey(),
        t: Date.now(),
        k: save.skins.selected,
      });
      save.history = sanitizeHistory(save.history);
    }
    flushSave();
  }

  function changeState(next) {
    st = next;
    stateAt = performance.now();
    transAt = stateAt;
    layoutUI();
    applyGain();
  }
  function pause() {
    if (st !== "play") return;
    changeState("paused");
    last = 0;
    acc = 0;
    flushSave();
    say("Paused. Score " + score + ". Best " + best + ".");
  }
  function resume() {
    if (st !== "paused") return;
    panel = "";
    changeState("play");
    last = 0;
    acc = 0;
    say("Resumed.");
  }
  function goMenu() {
    panel = "";
    resetWorld();
    changeState("ready");
    say("Main menu. Choose Classic, Daily, or Practice.");
  }
  function restart() {
    panel = "";
    resetWorld();
    spawnPipe(1);
    changeState("play");
    startRun();
    last = 0;
    acc = 0;
    flapPlay();
    say("Flying. Score " + score + ".");
  }
  function flapPlay() {
    if (!bird) return;
    bird.vy = JMP * U;
    bird.sx = 0.78;
    bird.sy = 1.26;
    bird.wing = 1;
    runFlaps++;
    save.stats.flaps++;
    scheduleSave();
    burst(
      bird.x - bird.s * 0.2,
      bird.y + bird.s * 0.15,
      quality === 0 ? 4 : 7,
      ["#fff", "#F8E08A", "#E8D5A3"],
      2.6 * U
    );
    sfx("jump");
    rumble(8);
  }
  function flap() {
    unlockAudio();
    if (st === "ready") {
      changeState("play");
      if (!pipes.length) spawnPipe(1);
      startRun();
      flapPlay();
      say("Flying. Tap, click, or Space to flap.");
      return;
    }
    if (st === "play") {
      flapPlay();
      return;
    }
    if (st === "over" && !panel && performance.now() - died > 480) restart();
  }
  function toggleMute() {
    muted = !muted;
    save.settings.muted = muted;
    scheduleSave();
    lsSet(LEGACY_MUTE, muted ? "1" : "0");
    applyGain();
    layoutUI();
    say(muted ? "Sound off." : "Sound on.");
    sfx("ui");
  }
  function cycleMusic() {
    save.settings.music = save.settings.music < 0.2 ? 0.4 : save.settings.music < 0.7 ? 1 : 0;
    scheduleSave();
    applyGain();
    layoutUI();
    say("Music " + Math.round(save.settings.music * 100) + " percent.");
    sfx("ui");
  }
  function toggleHaptics() {
    save.settings.haptics = !save.settings.haptics;
    scheduleSave();
    layoutUI();
    say(save.settings.haptics ? "Haptics on." : "Haptics off.");
    if (save.settings.haptics) rumble(12);
    sfx("ui");
  }
  function setMode(m) {
    if (!MODES[m] || st !== "ready") return;
    if (m === mode) return;
    mode = m;
    save.mode = m;
    ensureDaily();
    resetWorld();
    changeState("ready");
    scheduleSave();
    sfx("ui");
    toast(m === "daily" ? "DAILY CHALLENGE " + dayKey() : m.toUpperCase() + " MODE");
    say(m === "daily" ? "Daily challenge " + dayKey() + "." : m + " mode.");
  }
  function selectSkin(id) {
    const sk = skinById(id);
    if (save.skins.unlocked.indexOf(sk.id) < 0) {
      toast("LOCKED - REACH BEST " + sk.need);
      sfx("ui");
      return;
    }
    if (save.skins.selected === sk.id) {
      openPanel("");
      return;
    }
    save.skins.selected = sk.id;
    flushSave();
    birdSpriteKey = "";
    layoutUI();
    toast(sk.name + " SKIN EQUIPPED");
    sfx("ui");
    say(sk.name + " skin equipped.");
  }
  function openPanel(name) {
    panel = panel === name ? "" : name;
    changeState(st);
    if (panel) sfx("ui");
  }
  function toggleFullscreen() {
    if (!fsSupported || !isHttp()) return;
    try {
      if (isFullscreen()) {
        const ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) {
          const p = ex.call(document);
          if (p && p.catch) p.catch(function () {});
        }
      } else {
        const el = document.documentElement;
        const rq = el.requestFullscreen || el.webkitRequestFullscreen;
        if (rq) {
          const p = rq.call(el);
          if (p && p.catch)
            p.catch(function () {
              toast("FULLSCREEN UNAVAILABLE");
            });
        }
      }
    } catch (e) {
      toast("FULLSCREEN UNAVAILABLE");
    }
    sfx("ui");
  }
  function siteUrl() {
    try {
      return new URL("./", location.href).href;
    } catch (e) {
      return location.href;
    }
  }
  function copyText(str, ok, fail) {
    if (isSecure()) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(str).then(ok, fail);
          return;
        }
      } catch (e) {}
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = str;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      const done = document.execCommand("copy");
      document.body.removeChild(ta);
      if (done) ok();
      else fail();
    } catch (e) {
      fail();
    }
  }
  function shareScore() {
    if (!shareSupported || !isHttp()) {
      toast("SHARING UNAVAILABLE");
      return;
    }
    const label = mode === "daily" ? "Daily Challenge" : mode === "practice" ? "Practice" : "Classic";
    const text =
      "FLAP - " +
      label +
      " - score " +
      score +
      " (best " +
      best +
      ")" +
      (mode === "daily" ? " - " + dayKey() : "");
    const url = siteUrl();
    const payload = text + " " + url;
    const fail = function () {
      toast("SHARING UNAVAILABLE");
    };
    const copied = function () {
      toast("COPIED TO CLIPBOARD");
    };
    try {
      if (isSecure() && navigator.share) {
        const data = { title: "FLAP", text: text, url: url };
        let ok = true;
        try {
          if (typeof navigator.canShare === "function") ok = !!navigator.canShare(data);
        } catch (e) {
          ok = false;
        }
        if (ok) {
          const p = navigator.share(data);
          if (p && p.then)
            p.then(function () {
              say("Shared.");
            }).catch(function (err) {
              if (err && err.name === "AbortError") return;
              copyText(payload, copied, fail);
            });
          return;
        }
      }
    } catch (e) {}
    copyText(payload, copied, fail);
  }

  function hit() {
    if (st !== "play") return;
    const now = performance.now();
    newBestRun = mode !== "practice" && score > preRunBest && score > 0;
    changeState("over");
    died = now;
    flash = quality === 0 ? 0.5 : 1;
    shake = reduce ? 0 : 1;
    runStreak = 0;
    burst(
      bird.x,
      bird.y,
      quality === 0 ? 12 : 22,
      ["#F8D64E", "#F5A623", "#fff", "#E24B4B", "#FFD87A"],
      5.2 * U
    );
    sfx("hit");
    finishRun();
    refreshUnlocks(save, true);
    if (newBestRun || dailyNewBest) {
      if (!reduce) burst(W / 2, Math.min(H * 0.32, 160 * U), 18, ["#F8D64E", "#fff", "#8C7BFF"], 4.5 * U);
      sfx("best");
    }
    say(
      "Game over. Score " +
        score +
        ". Best " +
        best +
        ". " +
        (newBestRun || dailyNewBest ? "New best. " : "") +
        "Tap retry."
    );
    rumble([18, 30, 40]);
    flushSave();
  }

  function box(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function snap() {
    const b = bird;
    b.px = b.x;
    b.py = b.y;
    b.prot = b.rot;
    b.psx = b.sx;
    b.psy = b.sy;
    groundPX = groundX;
    for (let i = 0; i < pipes.length; i++) pipes[i].px = pipes[i].x;
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].px = clouds[i].x;
      clouds[i].py = clouds[i].y;
    }
    for (let i = 0; i < hills.length; i++) hills[i].px = hills[i].x;
    for (let i = 0; i < parts.length; i++) {
      parts[i].px = parts[i].x;
      parts[i].py = parts[i].y;
    }
  }
  function update(f) {
    const b = bird;
    worldTime += STEP * f;
    groundX = (groundX - spd * f) % (24 * U);
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.x -= spd * c.v * f;
      if (c.x < -140 * U) {
        c.x = W + 50 * U;
        c.px = c.x;
      }
    }
    for (let i = 0; i < hills.length; i++) {
      const h = hills[i];
      h.x -= spd * 0.35 * f;
      if (h.x < -h.w) {
        h.x += h.w * 5;
        h.px = h.x;
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.vy += p.g * U * f;
      p.life -= p.dec * f;
      if (p.life <= 0) {
        spare.push(parts[i]);
        parts.splice(i, 1);
      }
    }
    const cap = particleCap();
    if (parts.length > cap) {
      while (parts.length > cap) spare.push(parts.shift());
    }
    punch += (1 - punch) * 0.16 * f;
    flash = Math.max(0, flash - 0.045 * f);
    shake = Math.max(0, shake - 0.06 * f);
    cam += (b.vy * 0.08 - cam) * 0.14 * f;
    b.sx += (1 - b.sx) * 0.16 * f;
    b.sy += (1 - b.sy) * 0.16 * f;
    b.wing = Math.max(0, b.wing - 0.08 * f);

    if (st === "ready" || st === "paused") {
      if (st === "ready") {
        b.y = (H - GH) * 0.42 + Math.sin(worldTime * 5) * (reduce ? 0 : 7 * U);
        b.vy = 0;
        b.rot = 0;
        b.py = b.y;
        b.px = b.x;
      }
      return;
    }
    b.vy += G * U * f;
    if (b.vy > MF * U) b.vy = MF * U;
    b.y += b.vy * f;
    const tgt = Math.max(-0.85, Math.min(1.35, (b.vy / (MF * U)) * 1.55));
    b.rot += (tgt - b.rot) * 0.18 * f;
    if (b.vy > 4 * U) {
      b.sx += (1.14 - b.sx) * 0.08 * f;
      b.sy += (0.86 - b.sy) * 0.08 * f;
    }
    if (st === "over") {
      if (b.y + b.s * 0.38 > H - GH) {
        b.y = H - GH - b.s * 0.38;
        b.vy = 0;
        b.rot = 1.4;
      }
      return;
    }
    const practice = mode === "practice";
    spd = (BASE + Math.min(score, 50) * (practice ? 0.034 : 0.048)) * U * (practice ? 0.86 : 1);
    const spacing = Math.max(210 * U, 248 * U);
    if (!pipes.length || pipes[pipes.length - 1].x < W - spacing) spawnPipe(0);
    const hw = b.s * 0.33;
    const hh = b.s * 0.31;
    const hx = b.x - hw;
    const hy = b.y - hh;
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      p.x -= spd * f;
      const topH = p.mid - p.gap * 0.5;
      const botY = p.mid + p.gap * 0.5;
      const botH = H - GH - botY;
      if (
        box(hx, hy, hw * 2, hh * 2, p.x, 0, p.w, topH) ||
        (botH > 0 && box(hx, hy, hw * 2, hh * 2, p.x, botY, p.w, botH))
      )
        hit();
      if (!p.hit && p.x + p.w < b.x) {
        p.hit = 1;
        if (st !== "play") return;
        score++;
        runStreak++;
        if (runStreak > bestStreakRun) bestStreakRun = runStreak;
        if (runStreak > save.stats.bestStreak) {
          save.stats.bestStreak = runStreak;
          scheduleSave();
        }
        punch = 1.28;
        if (mode !== "practice" && score > best) {
          best = score;
          save.best = Math.max(save.best, best);
          newBestRun = score > preRunBest;
          scheduleSave();
          refreshUnlocks(save, true);
        }
        if (mode === "daily" && score > save.daily.best) {
          save.daily.best = score;
          dailyNewBest = true;
          scheduleSave();
        }
        sfx("score");
        skyKey = "";
      }
    }
    while (pipes.length && pipes[0].x + pipes[0].w < -40) pipes.shift();
    if (b.y + hh > H - GH || b.y - hh < 0) hit();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function text(str, x, y, size, fill, stroke, w, align) {
    X.font = fontFor(size);
    X.textAlign = align || "center";
    X.textBaseline = "middle";
    const px = Math.round(x * DPR) / DPR;
    const py = Math.round(y * DPR) / DPR;
    if (stroke) {
      X.lineJoin = "round";
      X.miterLimit = 2;
      X.strokeStyle = stroke;
      X.lineWidth = w || size * 0.14;
      X.strokeText(str, px, py);
    }
    X.fillStyle = fill;
    X.fillText(str, px, py);
  }

  const ui = {
    hud: [],
    readyModes: [],
    readySkins: [],
    pause: [],
    over: [],
    panel: [],
    card: null,
    overCard: null,
    pauseCard: null,
    panelCard: null,
    readyTitleY: 0,
    readyModeY: 0,
    readySkinY: 0,
    readyPromptY: 0,
    readyStatsY: 0,
    overRetry: 0,
  };

  function pushBtn(arr, id, x, y, w, h, label, tone) {
    arr.push({ id: id, x: x, y: y, w: w, h: h, label: label, tone: tone || "dark" });
  }
  function panelGeom(kind) {
    const pw = Math.min(W - 24 - SAL - SAR, Math.max(300, 340 * UI));
    const maxH = H - SAT - SAB - 12;
    const minH =
      kind === "pause" ? 330 : kind === "history" ? 330 : kind === "over" ? 285 : 270;
    const wantH =
      kind === "pause" ? 360 * UI : kind === "history" ? 350 * UI : kind === "over" ? 305 * UI : 285 * UI;
    const ph = Math.min(maxH, Math.max(minH, wantH));
    const x = (W - pw) / 2;
    const y = Math.max(SAT + 6, Math.min((H - ph) / 2, H - ph - SAB - 6));
    return { x: x, y: y, w: pw, h: ph };
  }
  function layoutUI() {
    ui.hud.length = 0;
    ui.readyModes.length = 0;
    ui.readySkins.length = 0;
    ui.pause.length = 0;
    ui.over.length = 0;
    ui.panel.length = 0;
    ui.card = null;
    ui.overCard = null;
    ui.pauseCard = null;
    ui.panelCard = null;
    const hs = Math.max(44, 44 * UI);
    const top = SAT + 8 * UI;
    if (st === "play" || st === "paused") pushBtn(ui.hud, "pause", 12 * UI + SAL, top, hs, hs, "", "icon");
    let rx = W - SAR - 12 * UI - hs;
    pushBtn(ui.hud, "mute", rx, top, hs, hs, "", "icon");
    rx -= hs + 8 * UI;
    if (fsSupported) {
      pushBtn(ui.hud, "fs", rx, top, hs, hs, "", "icon");
    }

    const panW = Math.min(W - 32 - SAL - SAR, Math.max(286, 340 * UI));
    const cx = W / 2;
    const titleY = SAT + Math.max(56 * UI, H * 0.15);
    const modeH = Math.max(44, 36 * UI);
    const modeGap = 6 * UI;
    const modeW = (panW - modeGap * 2) / 3;
    const maxModeY = H - GH - modeH - 128 * UI;
    const modeY = Math.max(titleY + 64 * UI, Math.min(H * 0.43, maxModeY));
    const modeX = cx - panW / 2;
    const modes = ["classic", "daily", "practice"];
    const labels = ["CLASSIC", "DAILY", "PRACTICE"];
    for (let i = 0; i < 3; i++)
      pushBtn(
        ui.readyModes,
        "mode:" + modes[i],
        modeX + i * (modeW + modeGap),
        modeY,
        modeW,
        modeH,
        labels[i],
        modes[i] === mode ? "accent" : "dark"
      );
    const tile = Math.max(44, 42 * UI);
    const gap = Math.max(6, 8 * UI);
    const skinTotal = SKIN_COUNT * tile + (SKIN_COUNT - 1) * gap;
    const skinY = Math.min(modeY + modeH + 18 * UI, H - GH - tile - 42 * UI);
    const skinX = cx - skinTotal / 2;
    for (let i = 0; i < SKIN_COUNT; i++)
      pushBtn(ui.readySkins, "skin:" + SKINS[i].id, skinX + i * (tile + gap), skinY, tile, tile, "", "skin");
    const promptY = Math.min(H - GH - 52 * UI, skinY + tile + 54 * UI);
    ui.readyTitleY = titleY;
    ui.readyModeY = modeY;
    ui.readySkinY = skinY;
    ui.readyPromptY = promptY;
    ui.readyStatsY = H - GH - 14 * UI;

    const cc = panelGeom("over");
    ui.overCard = cc;
    const pad = Math.max(12, 16 * UI);
    const gapY = Math.max(4, 6 * UI);
    let cy = cc.y + pad;
    const titleSize = Math.min(28 * UI, 26);
    cy += titleSize * 0.55;
    cy += titleSize * 0.45 + gapY;
    const scoreSize = Math.min(40 * UI, 38);
    cy += 11 * UI + scoreSize * 0.55;
    cy += gapY + 13 * UI;
    cy += gapY + 15 * UI;
    cy += gapY;
    const bh = 44;
    const retryY = cy + 2;
    ui.overRetry = retryY;
    pushBtn(ui.over, "retry", cc.x + pad, retryY, cc.w - pad * 2, bh, "RETRY", "primary");
    const rowGap = Math.max(5, 6 * UI);
    const r1 = retryY + bh + rowGap;
    const r2 = r1 + bh + rowGap;
    const bw = (cc.w - pad * 2 - rowGap) / 2;
    pushBtn(ui.over, "skins", cc.x + pad, r1, bw, bh, "SKINS", "dark");
    pushBtn(ui.over, "history", cc.x + pad + bw + rowGap, r1, bw, bh, "TOP 10", "dark");
    if (shareSupported) {
      pushBtn(ui.over, "share", cc.x + pad, r2, bw, bh, "SHARE", "blue");
      pushBtn(ui.over, "menu", cc.x + pad + bw + rowGap, r2, bw, bh, "MENU", "dark");
    } else {
      pushBtn(ui.over, "menu", cc.x + pad, r2, cc.w - pad * 2, bh, "MENU", "dark");
    }

    const pc = panelGeom("pause");
    ui.pauseCard = pc;
    const pPad = Math.max(12, 16 * UI);
    const pBh = 44;
    let py = pc.y + pPad;
    const pTitle = Math.min(26 * UI, 24);
    py += pTitle + 8;
    py += 14 * UI + 8;
    pushBtn(ui.pause, "resume", pc.x + pPad, py, pc.w - pPad * 2, pBh, "RESUME", "primary");
    py += pBh + Math.max(5, 6 * UI);
    const pGap = Math.max(5, 6 * UI);
    const pBw = (pc.w - pPad * 2 - pGap) / 2;
    const pRows = [
      ["restart", "RESTART", "skins", "SKINS"],
      ["history", "TOP 10", "menu", "MENU"],
      ["mute", muted ? "SOUND: OFF" : "SOUND: ON", "music", save.settings.music <= 0 ? "MUSIC: OFF" : save.settings.music < 0.7 ? "MUSIC: LOW" : "MUSIC: HIGH"],
      ["haptics", save.settings.haptics ? "HAPTICS: ON" : "HAPTICS: OFF", "fs", fsSupported ? (isFullscreen() ? "WINDOWED" : "FULLSCREEN") : "", ""],
    ];
    for (let r = 0; r < pRows.length; r++) {
      pushBtn(ui.pause, pRows[r][0], pc.x + pPad, py, pBw, pBh, pRows[r][1], "dark");
      if (pRows[r][3]) pushBtn(ui.pause, pRows[r][2], pc.x + pPad + pBw + pGap, py, pBw, pBh, pRows[r][3], "dark");
      py += pBh + pGap;
    }

    if (panel === "skins") {
      const sc = panelGeom("skins");
      ui.panelCard = sc;
      const sPad = Math.max(12, 16 * UI);
      const tileW = Math.min(60, (sc.w - sPad * 2 - 4 * Math.max(4, 6 * UI)) / SKIN_COUNT);
      const tileH = Math.max(52, 58 * UI);
      const sGap = Math.max(4, 6 * UI);
      const total = SKIN_COUNT * tileW + (SKIN_COUNT - 1) * sGap;
      const sx = sc.x + (sc.w - total) / 2;
      const sy = sc.y + Math.max(52, 64 * UI);
      for (let i = 0; i < SKIN_COUNT; i++)
        pushBtn(ui.panel, "pick:" + SKINS[i].id, sx + i * (tileW + sGap), sy, tileW, tileH, "", "skin");
      pushBtn(ui.panel, "close", sc.x + sPad, sc.y + sc.h - sPad - 44, sc.w - sPad * 2, 44, "BACK", "dark");
    } else if (panel === "history") {
      const hc = panelGeom("history");
      ui.panelCard = hc;
      const hPad = Math.max(12, 16 * UI);
      pushBtn(ui.panel, "close", hc.x + hPad, hc.y + hc.h - hPad - 44, hc.w - hPad * 2, 44, "BACK", "dark");
    }
  }

  function drawCloud(c, a) {
    const x = lerp(c.px, c.x, a);
    const y = lerp(c.py, c.y, a);
    X.fillStyle = cloudFill;
    const s = c.s * 42;
    X.beginPath();
    X.ellipse(x, y, s, s * 0.48, 0, 0, 7);
    X.ellipse(x + s * 0.55, y + s * 0.08, s * 0.72, s * 0.4, 0, 0, 7);
    X.ellipse(x - s * 0.5, y + s * 0.1, s * 0.62, s * 0.36, 0, 0, 7);
    X.fill();
  }
  function drawHills(a) {
    for (let i = 0; i < hills.length; i++) {
      const h = hills[i];
      const x = lerp(h.px, h.x, a);
      X.fillStyle = h.c ? hillFillA : hillFillB;
      X.beginPath();
      X.moveTo(x, H - GH + 4);
      X.quadraticCurveTo(x + h.w * 0.5, H - GH - h.h, x + h.w, H - GH + 4);
      X.fill();
    }
  }
  function pipeColumn(w, y, h, up, lip, cap) {
    if (h <= 1) return;
    X.fillStyle = pipeGrad;
    X.fillRect(2, y, w - 4, h);
    X.fillStyle = "#2E5C0E";
    X.fillRect(2, y, 2.2 * U, h);
    X.fillRect(w - 4.2 * U, y, 2.2 * U, h);
    const cy = up ? y + h - cap : y;
    roundRect(X, -lip * 0.35, cy, w + lip * 0.7, cap, 5 * U);
    X.fillStyle = "#8AD63A";
    X.fill();
    X.strokeStyle = "#2E5C0E";
    X.lineWidth = 2 * U;
    X.stroke();
    X.fillStyle = "rgba(0,0,0,0.18)";
    if (up) X.fillRect(3, y + h - cap - 6 * U, w - 6, 6 * U);
    else X.fillRect(3, y + cap, w - 6, 6 * U);
  }
  function drawPipe(p, a) {
    ensurePipeGrad();
    const x = Math.round(lerp(p.px, p.x, a) * DPR) / DPR;
    const w = p.w;
    const topH = p.mid - p.gap * 0.5;
    const botY = p.mid + p.gap * 0.5;
    const botH = H - GH - botY;
    const lip = 12 * U;
    const cap = 10 * U;
    X.save();
    X.translate(x, 0);
    pipeColumn(w, 0, topH, 1, lip, cap);
    pipeColumn(w, botY, botH, 0, lip, cap);
    if (p.markBest) {
      X.fillStyle = "#E0A428";
      X.fillRect(-4 * U, p.mid - 10 * U, 8 * U, 20 * U);
      X.beginPath();
      X.moveTo(4 * U, p.mid - 10 * U);
      X.lineTo(22 * U, p.mid);
      X.lineTo(4 * U, p.mid + 10 * U);
      X.closePath();
      X.fill();
    }
    X.restore();
  }
  function drawGround(a) {
    ensureGround();
    const gx = lerp(groundPX, groundX, a);
    X.fillStyle = "#DED895";
    X.fillRect(0, H - GH, W, GH);
    if (groundCv) {
      const tw = groundCv.width;
      const start = ((gx % tw) + tw) % tw;
      for (let x = start - tw; x < W; x += tw) X.drawImage(groundCv, x, H - GH);
    }
  }
  function drawWingShape(s, sk) {
    X.fillStyle = sk.wing;
    X.beginPath();
    X.ellipse(0, 0, s * 0.34, s * 0.22, 0, 0, 7);
    X.fill();
    X.fillStyle = sk.wingDark;
    X.beginPath();
    X.ellipse(-s * 0.04, s * 0.02, s * 0.22, s * 0.12, 0, 0, 7);
    X.fill();
  }
  function drawBirdStatic(g, s, sk) {
    g.fillStyle = sk.body;
    g.beginPath();
    g.ellipse(0, 0, s * 0.46, s * 0.4, 0, 0, 7);
    g.fill();
    const hg = g.createRadialGradient(-s * 0.16, -s * 0.16, 2, 0, 0, s * 0.5);
    hg.addColorStop(0, "rgba(255,255,255,0.42)");
    hg.addColorStop(0.45, "rgba(255,255,255,0)");
    hg.addColorStop(1, "rgba(60,40,10,0.18)");
    g.fillStyle = hg;
    g.beginPath();
    g.ellipse(0, 0, s * 0.46, s * 0.4, 0, 0, 7);
    g.fill();
    g.fillStyle = sk.belly;
    g.beginPath();
    g.ellipse(s * 0.06, s * 0.16, s * 0.28, s * 0.16, 0.15, 0, 7);
    g.fill();
    g.fillStyle = sk.stripe;
    g.beginPath();
    g.ellipse(-s * 0.1, -s * 0.16, s * 0.2, s * 0.07, -0.45, 0, 7);
    g.fill();
    g.fillStyle = sk.beak;
    g.beginPath();
    g.moveTo(s * 0.38, -s * 0.04);
    g.lineTo(s * 0.72, s * 0.02);
    g.lineTo(s * 0.38, s * 0.1);
    g.closePath();
    g.fill();
    g.fillStyle = sk.beakDark;
    g.fillRect(s * 0.4, s * 0.02, s * 0.28, 1.6);
    g.fillStyle = sk.eye;
    g.beginPath();
    g.arc(s * 0.16, -s * 0.1, s * 0.13, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(42,26,10,0.8)";
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = sk.pupil;
    g.beginPath();
    g.arc(s * 0.2, -s * 0.1, s * 0.055, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(s * 0.225, -s * 0.13, s * 0.022, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(42,26,10,0.42)";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, 0, s * 0.46, s * 0.4, 0, 0, 7);
    g.stroke();
  }
  function ensureBirdSprite() {
    if (!bird) return;
    const sk = skinById(save.skins.selected);
    const s = bird.s;
    const px = Math.max(32, Math.round(s * 1.9 * DPR));
    const key = sk.id + ":" + px;
    if (birdSpriteKey === key && birdSprite) return;
    birdSpriteKey = key;
    birdSprite = document.createElement("canvas");
    birdSprite.width = px;
    birdSprite.height = px;
    const g = birdSprite.getContext("2d");
    if (!g) return;
    const sc = px / (s * 1.9);
    g.setTransform(sc, 0, 0, sc, px / 2, px / 2);
    if (sk.glow) {
      g.shadowColor = sk.glow;
      g.shadowBlur = 10 * sc;
    }
    drawBirdStatic(g, s, sk);
  }
  function drawBird(a) {
    const b = bird;
    if (!b) return;
    const sk = skinById(save.skins.selected);
    const s = b.s;
    const x = lerp(b.px, b.x, a);
    const y = lerp(b.py, b.y, a);
    const rot = lerp(b.prot, b.rot, a);
    const sx = lerp(b.psx, b.sx, a);
    const sy = lerp(b.psy, b.sy, a);
    X.save();
    X.translate(x, y + (reduce ? 0 : cam * 0.35));
    X.rotate(rot);
    X.scale(sx, sy);
    X.fillStyle = "rgba(0,0,0,0.16)";
    X.beginPath();
    X.ellipse(2 * U, s * 0.28, s * 0.42, s * 0.18, 0, 0, 7);
    X.fill();
    const wing = reduce ? -0.2 : -0.55 + Math.sin(worldTime * 20) * 0.55 * (0.35 + b.wing * 1.4);
    X.save();
    X.translate(-s * 0.08, s * 0.04);
    X.rotate(wing);
    drawWingShape(s, sk);
    X.restore();
    ensureBirdSprite();
    if (birdSprite)
      X.drawImage(birdSprite, -s * 0.95, -s * 0.95, s * 1.9, s * 1.9);
    X.restore();
  }

  function drawBirdIcon(cx, cy, s, sk, locked) {
    X.save();
    X.translate(cx, cy);
    const body = locked ? "#6A6252" : sk.body;
    const belly = locked ? "#8A8272" : sk.belly;
    X.fillStyle = body;
    X.beginPath();
    X.ellipse(0, 0, s * 0.48, s * 0.42, 0, 0, 7);
    X.fill();
    X.fillStyle = belly;
    X.beginPath();
    X.ellipse(s * 0.08, s * 0.18, s * 0.28, s * 0.16, 0.15, 0, 7);
    X.fill();
    X.fillStyle = locked ? "#D9D0BC" : sk.eye;
    X.beginPath();
    X.arc(s * 0.16, -s * 0.12, s * 0.12, 0, 7);
    X.fill();
    X.fillStyle = "#2A1A0A";
    X.beginPath();
    X.arc(s * 0.2, -s * 0.12, s * 0.05, 0, 7);
    X.fill();
    X.fillStyle = locked ? "#A89A78" : sk.beak;
    X.beginPath();
    X.moveTo(s * 0.4, -s * 0.05);
    X.lineTo(s * 0.7, s * 0.02);
    X.lineTo(s * 0.4, s * 0.09);
    X.closePath();
    X.fill();
    X.restore();
  }
  function drawLock(cx, cy, s) {
    X.strokeStyle = "#F6F0D8";
    X.lineWidth = Math.max(2, s * 0.12);
    X.beginPath();
    X.arc(cx, cy - s * 0.12, s * 0.3, Math.PI, 0);
    X.stroke();
    X.fillStyle = "#F6F0D8";
    roundRect(X, cx - s * 0.42, cy - s * 0.12, s * 0.84, s * 0.56, s * 0.12);
    X.fill();
    X.fillStyle = "#2E2413";
    X.beginPath();
    X.arc(cx, cy + s * 0.1, s * 0.09, 0, 7);
    X.fill();
  }

  function drawButton(b) {
    const accent = b.tone === "accent";
    const primary = b.tone === "primary";
    const blue = b.tone === "blue";
    const skin = b.tone === "skin";
    if (skin) return drawSkinTile(b);
    const bg = accent ? "#F8D64E" : primary ? "#2E7D32" : blue ? "#2C6E9B" : "#2E2413";
    const fg = accent ? "#2A1A0A" : "#FFF7E0";
    roundRect(X, b.x, b.y, b.w, b.h, Math.min(12, b.h * 0.28));
    X.fillStyle = bg;
    X.fill();
    if (accent) {
      X.strokeStyle = "#FFF7E0";
      X.lineWidth = 3;
      X.stroke();
    }
    text(b.label, b.x + b.w / 2, b.y + b.h / 2, Math.min(15 * UI, b.h * 0.36), fg, accent ? null : "rgba(0,0,0,0.3)", 2);
  }
  function drawSkinTile(b) {
    const sk = skinById(b.id.slice(b.id.indexOf(":") + 1));
    const unlocked = save.skins.unlocked.indexOf(sk.id) >= 0;
    const selected = save.skins.selected === sk.id;
    roundRect(X, b.x, b.y, b.w, b.h, Math.min(12, b.w * 0.22));
    X.fillStyle = selected ? "#F8D64E" : "#2E2413";
    X.fill();
    if (selected) {
      X.strokeStyle = "#FFF7E0";
      X.lineWidth = 3;
      X.stroke();
    }
    const iconS = Math.min(b.w, b.h) * 0.52;
    drawBirdIcon(b.x + b.w / 2, b.y + b.h * 0.42, iconS, sk, !unlocked);
    if (unlocked) {
      text(sk.name, b.x + b.w / 2, b.y + b.h * 0.82, Math.max(8, Math.min(10 * UI, b.w * 0.18)), selected ? "#2A1A0A" : "#FFF7E0");
    } else {
      drawLock(b.x + b.w * 0.72, b.y + b.h * 0.3, Math.min(b.w, b.h) * 0.28);
      text(String(sk.need), b.x + b.w / 2, b.y + b.h * 0.82, Math.max(8, Math.min(10 * UI, b.w * 0.2)), "#FFF7E0");
    }
  }
  function drawIcon(b) {
    const s = b.w;
    roundRect(X, b.x, b.y, s, s, 10 * UI);
    X.fillStyle = "rgba(24,32,24,0.42)";
    X.fill();
    X.strokeStyle = "rgba(255,247,224,0.4)";
    X.lineWidth = 1.5;
    X.stroke();
    const cx = b.x + s / 2;
    const cy = b.y + s / 2;
    X.strokeStyle = "#FFF7E0";
    X.fillStyle = "#FFF7E0";
    X.lineWidth = Math.max(2, s * 0.075);
    X.lineCap = "round";
    X.lineJoin = "round";
    if (b.id === "pause") {
      X.beginPath();
      X.moveTo(cx - s * 0.12, cy - s * 0.18);
      X.lineTo(cx - s * 0.12, cy + s * 0.18);
      X.moveTo(cx + s * 0.12, cy - s * 0.18);
      X.lineTo(cx + s * 0.12, cy + s * 0.18);
      X.stroke();
    } else if (b.id === "mute") {
      X.beginPath();
      X.moveTo(cx - s * 0.22, cy - s * 0.07);
      X.lineTo(cx - s * 0.12, cy - s * 0.07);
      X.lineTo(cx, cy - s * 0.2);
      X.lineTo(cx, cy + s * 0.2);
      X.lineTo(cx - s * 0.12, cy + s * 0.07);
      X.lineTo(cx - s * 0.22, cy + s * 0.07);
      X.closePath();
      X.fill();
      X.beginPath();
      X.arc(cx + s * 0.02, cy, s * 0.15, -0.9, 0.9);
      X.stroke();
      if (muted) {
        X.strokeStyle = "#FF6B5E";
        X.lineWidth = Math.max(2, s * 0.09);
        X.beginPath();
        X.moveTo(cx - s * 0.2, cy + s * 0.2);
        X.lineTo(cx + s * 0.22, cy - s * 0.22);
        X.stroke();
      }
    } else if (b.id === "fs") {
      const d = s * 0.17;
      X.beginPath();
      if (isFullscreen()) {
        X.moveTo(cx - d, cy - d * 0.2);
        X.lineTo(cx - d, cy - d);
        X.lineTo(cx - d * 0.2, cy - d);
        X.moveTo(cx + d, cy - d * 0.2);
        X.lineTo(cx + d, cy - d);
        X.lineTo(cx + d * 0.2, cy - d);
        X.moveTo(cx - d, cy + d * 0.2);
        X.lineTo(cx - d, cy + d);
        X.lineTo(cx - d * 0.2, cy + d);
        X.moveTo(cx + d, cy + d * 0.2);
        X.lineTo(cx + d, cy + d);
        X.lineTo(cx + d * 0.2, cy + d);
      } else {
        X.moveTo(cx - d * 0.2, cy - d);
        X.lineTo(cx - d, cy - d);
        X.lineTo(cx - d, cy - d * 0.2);
        X.moveTo(cx + d * 0.2, cy - d);
        X.lineTo(cx + d, cy - d);
        X.lineTo(cx + d, cy - d * 0.2);
        X.moveTo(cx - d * 0.2, cy + d);
        X.lineTo(cx - d, cy + d);
        X.lineTo(cx - d, cy + d * 0.2);
        X.moveTo(cx + d * 0.2, cy + d);
        X.lineTo(cx + d, cy + d);
        X.lineTo(cx + d, cy + d * 0.2);
      }
      X.stroke();
    }
  }

  function drawHUD() {
    for (let i = 0; i < ui.hud.length; i++) drawIcon(ui.hud[i]);
  }
  function drawReady(now) {
    const intro = reduce ? 1 : easeOutCubic(Math.min(1, (now - stateAt) / 560));
    const cx = W / 2;
    const titleSize = Math.min(72 * U, W * 0.24, 82);
    X.globalAlpha = intro;
    text("FLAP", cx, ui.readyTitleY - (1 - intro) * 24, titleSize, "#FFF7E0", "#2A1A0A", 9);
    X.globalAlpha = 1;
    const modeLabel =
      mode === "daily"
        ? "DAILY " + dayKey()
        : mode === "practice"
          ? "PRACTICE - NO RECORDS"
          : "CLASSIC";
    text(modeLabel, cx, ui.readyModeY - 16 * UI, Math.max(10, 11 * UI), "#FFF7E0", "#2A1A0A", 3);
    for (let i = 0; i < ui.readyModes.length; i++) drawButton(ui.readyModes[i]);
    text("SKINS", cx, ui.readySkinY - 10 * UI, Math.max(9, 10 * UI), "#FFF7E0", "#2A1A0A", 2);
    for (let i = 0; i < ui.readySkins.length; i++) drawButton(ui.readySkins[i]);
    const pulse = reduce ? 1 : 0.9 + Math.sin(now * 0.005) * 0.1;
    X.globalAlpha = pulse;
    text("TAP TO FLY", cx, ui.readyPromptY, Math.min(24 * UI, 28), "#FFF7E0", "#2A1A0A", 6);
    X.globalAlpha = 1;
    const statLine =
      "BEST " + best + "   RUNS " + save.stats.runs + "   FLAPS " + save.stats.flaps;
    text(statLine, cx, ui.readyStatsY, Math.max(10, 10.5 * UI), "#FFF7E0", "#2A1A0A", 3);
    if (mode === "daily")
      text(
        "TODAY'S BEST " + save.daily.best,
        cx,
        ui.readyPromptY + 26 * UI,
        Math.max(10, 11 * UI),
        "#FFE99A",
        "#2A1A0A",
        3
      );
    if (!save.tutorialSeen) {
      const ringY = bird ? bird.y : ui.readyPromptY;
      const pulse2 = reduce ? 1 : 0.75 + Math.sin(now * 0.006) * 0.25;
      X.globalAlpha = pulse2;
      X.strokeStyle = "#FFF7E0";
      X.lineWidth = 3;
      X.beginPath();
      X.arc(bird ? bird.x : cx, ringY, (34 + (reduce ? 0 : Math.sin(now * 0.006) * 5)) * U, 0, 7);
      X.stroke();
      X.globalAlpha = 1;
      text("TAP ANYWHERE", bird ? bird.x : cx, ringY - 50 * U, Math.max(10, 12 * UI), "#FFF7E0", "#2A1A0A", 3);
    }
  }
  function drawOver(now) {
    const cc = ui.overCard;
    if (!cc) return;
    X.fillStyle = "rgba(8,18,24,0.48)";
    X.fillRect(0, 0, W, H);
    const intro = reduce ? 1 : easeOutBack(Math.min(1, (now - stateAt) / 480));
    const scale = 0.9 + 0.1 * intro;
    X.save();
    X.translate(cc.x + cc.w / 2, cc.y + cc.h / 2);
    X.scale(scale, scale);
    X.translate(-(cc.x + cc.w / 2), -(cc.y + cc.h / 2));
    X.fillStyle = "rgba(10,15,10,0.3)";
    roundRect(X, cc.x + 4, cc.y + 6, cc.w, cc.h, 18 * UI);
    X.fill();
    X.fillStyle = "#FFF6DC";
    roundRect(X, cc.x, cc.y, cc.w, cc.h, 18 * UI);
    X.fill();
    X.strokeStyle = "#D8B85C";
    X.lineWidth = 3;
    X.stroke();
    const pad = Math.max(12, 16 * UI);
    const cx = cc.x + cc.w / 2;
    const titleSize = Math.min(28 * UI, 26);
    text("GAME OVER", cx, cc.y + pad + titleSize * 0.55, titleSize, "#2A1A0A", "#FFF7E0", 5);
    const countT = reduce ? 1 : easeOutCubic(Math.min(1, (now - stateAt) / 680));
    const shown = Math.round(score * countT);
    shownScore = shown;
    const scoreSize = Math.min(40 * UI, 38);
    const colL = cc.x + cc.w * 0.28;
    const colR = cc.x + cc.w * 0.72;
    const labelY = cc.y + pad + titleSize + 12 * UI;
    text("SCORE", colL, labelY, Math.max(9, 10 * UI), "#7A6A40");
    text("BEST", colR, labelY, Math.max(9, 10 * UI), "#7A6A40");
    text(String(shown), colL, labelY + scoreSize * 0.72, scoreSize, "#C4382F", "#FFF7E0", 5);
    text(String(best), colR, labelY + scoreSize * 0.72, scoreSize, "#8A6208", "#FFF7E0", 5);
    const badgeY = labelY + scoreSize * 0.72 + 22 * UI;
    if (newBestRun || dailyNewBest) {
      const bp = reduce ? 1 : 0.94 + Math.sin(now * 0.009) * 0.06;
      X.save();
      X.translate(cx, badgeY);
      X.scale(bp, bp);
      roundRect(X, -62 * UI, -11 * UI, 124 * UI, 22 * UI, 11 * UI);
      X.fillStyle = "#F8D64E";
      X.fill();
      X.strokeStyle = "#8A6208";
      X.lineWidth = 2;
      X.stroke();
      text(dailyNewBest && !newBestRun ? "NEW DAILY BEST" : "NEW BEST", 0, 0, Math.max(10, 11 * UI), "#2A1A0A");
      X.restore();
    } else if (mode === "daily") {
      text("DAILY BEST " + save.daily.best, cx, badgeY, Math.max(10, 10.5 * UI), "#7A6A40");
    } else if (mode === "practice") {
      text("PRACTICE - NOT RECORDED", cx, badgeY, Math.max(9, 10 * UI), "#7A6A40");
    }
    const statsY = badgeY + 18 * UI;
    text(
      "FLAPS " + runFlaps + "   STREAK " + Math.max(runStreak, score) + "   RUNS " + save.stats.runs,
      cx,
      statsY,
      Math.max(9, 10 * UI),
      "#5E5034"
    );
    for (let i = 0; i < ui.over.length; i++) drawButton(ui.over[i]);
    X.restore();
  }
  function drawPause(now) {
    const pc = ui.pauseCard;
    if (!pc) return;
    X.fillStyle = "rgba(8,18,24,0.5)";
    X.fillRect(0, 0, W, H);
    const intro = reduce ? 1 : easeOutCubic(Math.min(1, (now - stateAt) / 260));
    X.globalAlpha = intro;
    X.fillStyle = "rgba(10,15,10,0.3)";
    roundRect(X, pc.x + 4, pc.y + 6, pc.w, pc.h, 18 * UI);
    X.fill();
    X.fillStyle = "#FFF6DC";
    roundRect(X, pc.x, pc.y, pc.w, pc.h, 18 * UI);
    X.fill();
    X.strokeStyle = "#D8B85C";
    X.lineWidth = 3;
    X.stroke();
    const pad = Math.max(12, 16 * UI);
    const titleSize = Math.min(26 * UI, 24);
    text("PAUSED", pc.x + pc.w / 2, pc.y + pad + titleSize * 0.6, titleSize, "#2A1A0A", "#FFF7E0", 5);
    text(
      "SCORE " + score + "   BEST " + best + "   " + (mode === "daily" ? "DAILY" : mode.toUpperCase()),
      pc.x + pc.w / 2,
      pc.y + pad + titleSize + 14 * UI,
      Math.max(9, 10.5 * UI),
      "#7A6A40"
    );
    for (let i = 0; i < ui.pause.length; i++) drawButton(ui.pause[i]);
    text(
      "ESC / P   TAP OUTSIDE   " + buildLabel(),
      pc.x + pc.w / 2,
      pc.y + pc.h - 9 * UI,
      Math.max(8, 9 * UI),
      "#8A7A50"
    );
    X.globalAlpha = 1;
  }
  function drawSkinsPanel(now) {
    const sc = ui.panelCard;
    if (!sc) return;
    X.fillStyle = "rgba(8,18,24,0.55)";
    X.fillRect(0, 0, W, H);
    X.fillStyle = "rgba(10,15,10,0.3)";
    roundRect(X, sc.x + 4, sc.y + 6, sc.w, sc.h, 18 * UI);
    X.fill();
    X.fillStyle = "#FFF6DC";
    roundRect(X, sc.x, sc.y, sc.w, sc.h, 18 * UI);
    X.fill();
    X.strokeStyle = "#D8B85C";
    X.lineWidth = 3;
    X.stroke();
    const pad = Math.max(12, 16 * UI);
    text("SKINS", sc.x + pad, sc.y + pad + 10, Math.min(24 * UI, 22), "#2A1A0A", "#FFF7E0", 4, "left");
    const next = (function () {
      for (let i = 0; i < SKINS.length; i++)
        if (save.skins.unlocked.indexOf(SKINS[i].id) < 0) return SKINS[i];
      return null;
    })();
    for (let i = 0; i < ui.panel.length; i++) {
      const b = ui.panel[i];
      if (b.tone === "skin") drawSkinTile(b);
      else drawButton(b);
    }
    const hint = next
      ? "NEXT UNLOCK: " + next.name + " AT BEST " + next.need
      : "ALL SKINS UNLOCKED";
    text(hint, sc.x + sc.w / 2, sc.y + sc.h - 78 * UI, Math.max(9, 10 * UI), "#7A6A40");
  }
  function drawHistoryPanel(now) {
    const hc = ui.panelCard;
    if (!hc) return;
    X.fillStyle = "rgba(8,18,24,0.55)";
    X.fillRect(0, 0, W, H);
    X.fillStyle = "rgba(10,15,10,0.3)";
    roundRect(X, hc.x + 4, hc.y + 6, hc.w, hc.h, 18 * UI);
    X.fill();
    X.fillStyle = "#FFF6DC";
    roundRect(X, hc.x, hc.y, hc.w, hc.h, 18 * UI);
    X.fill();
    X.strokeStyle = "#D8B85C";
    X.lineWidth = 3;
    X.stroke();
    const pad = Math.max(12, 16 * UI);
    text("TOP 10", hc.x + pad, hc.y + pad + 8, Math.min(24 * UI, 22), "#2A1A0A", "#FFF7E0", 4, "left");
    const top = hc.y + pad + 30 * UI;
    const bottom = hc.y + hc.h - pad - 52;
    const rowH = Math.max(14, Math.min(23, (bottom - top) / 10));
    const list = save.history;
    if (!list.length) {
      text("NO RUNS YET", hc.x + hc.w / 2, top + 30, Math.max(10, 12 * UI), "#7A6A40");
    } else {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const y = top + i * rowH + rowH / 2;
        if (i & 1) {
          X.fillStyle = "rgba(216,184,92,0.16)";
          X.fillRect(hc.x + pad, y - rowH / 2, hc.w - pad * 2, rowH);
        }
        text(String(i + 1), hc.x + pad + 10, y, Math.max(8, 9 * UI), "#7A6A40");
        text(String(e.s), hc.x + pad + 32 * UI, y, Math.max(10, 11 * UI), "#2A1A0A", null, 0, "left");
        text(
          e.m === "daily" ? "DAILY" : e.m === "practice" ? "PRACTICE" : "CLASSIC",
          hc.x + hc.w * 0.53,
          y,
          Math.max(8, 8.5 * UI),
          "#7A6A40"
        );
        text(e.d.slice(5), hc.x + hc.w - pad - 4, y, Math.max(8, 8.5 * UI), "#7A6A40", null, 0, "right");
      }
    }
    for (let i = 0; i < ui.panel.length; i++) drawButton(ui.panel[i]);
  }
  function drawTutorial(now) {
    if (st !== "play" || now >= tutorialUntil || score > 0 || !bird) return;
    const pulse = reduce ? 1 : 0.7 + Math.sin(now * 0.008) * 0.3;
    X.globalAlpha = pulse;
    X.strokeStyle = "#FFF7E0";
    X.lineWidth = 3;
    X.beginPath();
    X.arc(bird.x, bird.y, (30 + (reduce ? 0 : Math.sin(now * 0.008) * 5)) * U, 0, 7);
    X.stroke();
    X.globalAlpha = 1;
    text("TAP TO FLAP", bird.x, bird.y - 48 * U, Math.max(10, 12 * UI), "#FFF7E0", "#2A1A0A", 3);
  }
  function drawToast(now) {
    if (now >= toastObj.at || !toastObj.text) return;
    if (!toastObj.w) {
      X.font = fontFor(Math.max(10, 11 * UI));
      try {
        toastObj.w = X.measureText(toastObj.text).width;
      } catch (e) {
        toastObj.w = 180;
      }
    }
    const fadeIn = Math.min(1, (now - toastObj.shown) / 160);
    const fadeOut = Math.min(1, (toastObj.at - now) / 320);
    const a = Math.max(0, Math.min(fadeIn, fadeOut));
    X.globalAlpha = a;
    const pw = toastObj.w + 28;
    const ph = 30;
    const x = (W - pw) / 2;
    const y = H - GH - 48 * UI;
    roundRect(X, x, y, pw, ph, 15);
    X.fillStyle = "rgba(24,32,24,0.88)";
    X.fill();
    X.strokeStyle = "rgba(255,247,224,0.35)";
    X.lineWidth = 1.5;
    X.stroke();
    text(toastObj.text, W / 2, y + ph / 2, Math.max(10, 11 * UI), "#FFF7E0");
    X.globalAlpha = 1;
  }
  function drawUI(now) {
    if (!panel) drawHUD();
    if (st === "play" || st === "paused") {
      const top = SAT + Math.max(30 * UI, 34);
      const size = Math.min(54 * U, W * 0.14, 62 * UI);
      X.save();
      X.translate(W / 2, top);
      X.scale(punch, punch);
      text(String(score), 0, 0, size, "#FFF7E0", "#2A1A0A", 8);
      X.restore();
      if (newBestRun && st === "play") {
        const p = reduce ? 1 : 0.9 + Math.sin(now * 0.01) * 0.1;
        X.globalAlpha = p;
        text("NEW BEST", W / 2, top + size * 0.62, Math.max(9, 10 * UI), "#F8D64E", "#2A1A0A", 3);
        X.globalAlpha = 1;
      }
    }
    if (st === "ready") drawReady(now);
    if (st === "over") drawOver(now);
    if (st === "paused") drawPause(now);
    if (panel === "skins") drawSkinsPanel(now);
    else if (panel === "history") drawHistoryPanel(now);
    drawTutorial(now);
    drawToast(now);
    if (DEBUG_HOOK) {
      const ctxS = AC ? AC.state : "off";
      const mg = musicGain ? Math.round(musicGain.gain.value * 100) / 100 : 0;
      const dk = musicDuck ? Math.round(musicDuck.gain.value * 100) / 100 : 1;
      const line =
        ctxS +
        " m" +
        (musicSrc ? "1" : "0") +
        " g" +
        mg +
        " d" +
        dk +
        " v" +
        voices.length +
        " r" +
        audioResumes +
        " b" +
        audioRebuilds;
      text(line, 8 + SAL, H - GH - 10, 10, "#2A1A0A", "#FFF7E0", 2, "left");
    }
    if (!reduce && transAt) {
      const tp = clamp((now - transAt) / 280, 0, 1);
      if (tp < 1) {
        X.fillStyle = "rgba(112,197,206," + (0.2 * (1 - tp)) + ")";
        X.fillRect(0, 0, W, H);
      }
    }
  }

  function draw(a, now) {
    if (ctxLost || !X) return;
    X.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sx = shake && !reduce ? (Math.random() - 0.5) * 10 * U * shake : 0;
    const sy = shake && !reduce ? (Math.random() - 0.5) * 8 * U * shake : 0;
    X.save();
    X.translate(sx, sy);
    ensureSky();
    if (skyCv) X.drawImage(skyCv, 0, 0, W, H);
    else {
      X.fillStyle = "#70C5CE";
      X.fillRect(0, 0, W, H);
    }
    const cloudN = quality === 0 ? Math.min(clouds.length, 4) : clouds.length;
    for (let i = 0; i < cloudN; i++) drawCloud(clouds[i], a);
    drawHills(a);
    let marked = 0;
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      p.markBest = !marked && mode !== "practice" && best > 0 && !p.hit && score + 1 === best;
      if (p.markBest) marked = 1;
      drawPipe(p, a);
    }
    drawGround(a);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      X.globalAlpha = Math.max(0, p.life);
      X.fillStyle = p.c;
      X.beginPath();
      X.arc(lerp(p.px, p.x, a), lerp(p.py, p.y, a), p.sz, 0, 7);
      X.fill();
    }
    X.globalAlpha = 1;
    drawBird(a);
    X.restore();
    if (flash > 0 && !reduce) {
      X.fillStyle = "rgba(255,255,255," + flash * 0.55 + ")";
      X.fillRect(0, 0, W, H);
    }
    drawUI(now);
  }

  function adaptQuality(ms) {
    frameEMA = frameEMA * 0.9 + ms * 0.1;
    if (document.hidden || st === "paused") return;
    if (frameEMA > 20) {
      slowMs += ms;
      if (slowMs > 850 && quality > 0) {
        quality--;
        slowMs = 0;
        fit();
      }
    } else if (frameEMA < 17) {
      slowMs = Math.max(0, slowMs - ms * 0.5);
    }
  }
  function loop(t) {
    if (document.hidden) {
      raf = 0;
      last = 0;
      acc = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
    if (ctxLost) {
      draw(1, t);
      return;
    }
    pollPad();
    if (st === "paused") {
      last = 0;
      acc = 0;
      draw(1, t);
      return;
    }
    if (!last) {
      last = t;
      draw(1, t);
      return;
    }
    let dt = (t - last) / 1000;
    const ms = t - last;
    last = t;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (ms > 0 && ms < 100) adaptQuality(ms);
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      snap();
      update(1);
      acc -= STEP;
      n++;
    }
    alpha = acc / STEP;
    if (alpha < 0) alpha = 0;
    if (alpha > 1) alpha = 1;
    if (st === "ready" || st === "over") alpha = 1;
    renderedFrames++;
    try {
      draw(alpha, t);
    } catch (e) {
      showCrash();
    }
  }

  function hitUI(list, x, y) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }
  function canvasXY(e) {
    const r = C.getBoundingClientRect();
    const src = e.changedTouches ? e.changedTouches[0] : e;
    const rw = r.width || W || 1;
    const rh = r.height || H || 1;
    xy[0] = ((src.clientX - r.left) * (W / rw));
    xy[1] = ((src.clientY - r.top) * (H / rh));
    return xy;
  }
  let lastInput = 0;
  let lastInputKind = "";
  function inputGate(kind) {
    const now = performance.now();
    if (now - lastInput < 42 && lastInputKind !== kind) return false;
    lastInput = now;
    lastInputKind = kind;
    return true;
  }
  const activePtr = Object.create(null);
  let ptrCount = 0;
  function handlePanelTap(x, y) {
    const b = hitUI(ui.panel, x, y);
    if (b) {
      if (b.id === "close") {
        openPanel("");
        return true;
      }
      if (b.id.indexOf("pick:") === 0) {
        selectSkin(b.id.slice(5));
        return true;
      }
    }
    const card = ui.panelCard;
    if (card && (x < card.x || x > card.x + card.w || y < card.y || y > card.y + card.h)) {
      openPanel("");
      return true;
    }
    return true;
  }
  function handleTap(x, y) {
    if (panel) return handlePanelTap(x, y);
    const hud = hitUI(ui.hud, x, y);
    if (hud) {
      if (hud.id === "pause") pause();
      else if (hud.id === "mute") toggleMute();
      else if (hud.id === "fs") toggleFullscreen();
      return true;
    }
    if (st === "paused") {
      const b = hitUI(ui.pause, x, y);
      if (b) {
        if (b.id === "resume") resume();
        else if (b.id === "restart") restart();
        else if (b.id === "skins") openPanel("skins");
        else if (b.id === "history") openPanel("history");
        else if (b.id === "menu") goMenu();
        else if (b.id === "mute") toggleMute();
        else if (b.id === "music") cycleMusic();
        else if (b.id === "haptics") toggleHaptics();
        else if (b.id === "fs") toggleFullscreen();
        return true;
      }
      const pc = ui.pauseCard;
      if (pc && (x < pc.x || x > pc.x + pc.w || y < pc.y || y > pc.y + pc.h)) resume();
      return true;
    }
    if (st === "over") {
      const b = hitUI(ui.over, x, y);
      if (b) {
        if (b.id === "retry") restart();
        else if (b.id === "skins") openPanel("skins");
        else if (b.id === "history") openPanel("history");
        else if (b.id === "share") shareScore();
        else if (b.id === "menu") goMenu();
        return true;
      }
      const cc = ui.overCard;
      if (
        cc &&
        (x < cc.x || x > cc.x + cc.w || y < cc.y || y > cc.y + cc.h) &&
        performance.now() - died > 480
      )
        restart();
      return true;
    }
    if (st === "ready") {
      const m = hitUI(ui.readyModes, x, y);
      if (m) {
        setMode(m.id.slice(5));
        return true;
      }
      const s = hitUI(ui.readySkins, x, y);
      if (s) {
        selectSkin(s.id.slice(5));
        return true;
      }
      flap();
      return true;
    }
    if (st === "play") {
      flap();
      return true;
    }
    return false;
  }
  function onPtr(e) {
    if (e.target && e.target.closest) {
      if (e.target.closest("button") || e.target.closest(".crash")) return;
    }
    if (e.button != null && e.button > 0) return;
    unlockAudio();
    const id = e.pointerId;
    if (e.pointerType === "touch") {
      if (id != null) {
        if (activePtr[id]) return;
        if (ptrCount > 0) return;
        activePtr[id] = 1;
        ptrCount++;
      }
    }
    if (!inputGate("ptr")) return;
    e.preventDefault();
    if (ctxLost) return;
    const p = canvasXY(e);
    handleTap(p[0], p[1]);
  }
  function onPtrUp(e) {
    const id = e.pointerId;
    if (id != null && activePtr[id]) {
      delete activePtr[id];
      ptrCount = Math.max(0, ptrCount - 1);
    }
  }
  function onKey(e) {
    if (e.repeat) return;
    const k = e.code || e.key;
    if (
      (k === "Space" || k === "Enter" || e.key === " " || e.key === "Enter") &&
      e.target &&
      (e.target.tagName === "BUTTON" || e.target.tagName === "A" || e.target.tagName === "INPUT")
    )
      return;
    if (k === "Escape" || k === "KeyP" || e.key === "p" || e.key === "P") {
      e.preventDefault();
      if (panel) openPanel("");
      else if (st === "play") pause();
      else if (st === "paused") resume();
      return;
    }
    if (k === "KeyM" || e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleMute();
      return;
    }
    if (k === "KeyF" || e.key === "f" || e.key === "F") {
      if (!fsSupported) return;
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (k === "KeyH" || e.key === "h" || e.key === "H") {
      e.preventDefault();
      if (st !== "play") openPanel("history");
      return;
    }
    if (k === "KeyK" || e.key === "k" || e.key === "K") {
      e.preventDefault();
      if (st !== "play") openPanel("skins");
      return;
    }
    if (st === "paused" && (k === "KeyR" || e.key === "r" || e.key === "R")) {
      e.preventDefault();
      restart();
      return;
    }
    if (k === "Space" || e.key === " " || k === "Enter" || k === "ArrowUp" || e.key === "ArrowUp") {
      e.preventDefault();
      unlockAudio();
      if (!inputGate("key")) return;
      if (st === "paused") resume();
      else if (panel) openPanel("");
      else flap();
    }
  }
  function padPressed(p, i) {
    const b = p.buttons[i];
    return !!(b && (b.pressed || b.value > 0.5));
  }
  function pollPad() {
    let pads;
    try {
      pads = navigator.getGamepads ? navigator.getGamepads() : null;
    } catch (e) {
      return;
    }
    if (!pads) return;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p || !p.buttons) continue;
      const n = Math.min(24, p.buttons.length);
      for (let b = 0; b < n; b++) {
        const down = padPressed(p, b);
        const was = padPrev[b];
        padPrev[b] = down ? 1 : 0;
        if (!down || was) continue;
        if (b === 0 || b === 7) {
          unlockAudio();
          if (panel) openPanel("");
          else if (st === "paused") resume();
          else flap();
        } else if (b === 9 || b === 8) {
          if (panel) openPanel("");
          else if (st === "play") pause();
          else if (st === "paused") resume();
        } else if (b === 3) toggleMute();
        else if (b === 2 && fsSupported) toggleFullscreen();
      }
      return;
    }
  }
  function onResize() {
    if (fitQueued) return;
    fitQueued = true;
    try {
      requestAnimationFrame(function () {
        fitQueued = false;
        const was = st;
        fit();
        if (was === "ready") resetWorld();
        layoutUI();
      });
    } catch (e) {
      fitQueued = false;
      fit();
    }
  }

  addEventListener("resize", onResize, { passive: true });
  addEventListener(
    "orientationchange",
    function () {
      setTimeout(onResize, 120);
    },
    { passive: true }
  );
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", onResize, { passive: true });
    visualViewport.addEventListener("scroll", onResize, { passive: true });
  }
  if (screen.orientation && screen.orientation.addEventListener)
    screen.orientation.addEventListener("change", onResize);
  addEventListener("pointerdown", onPtr, { passive: false });
  addEventListener("pointerup", onPtrUp, { passive: true });
  addEventListener("pointercancel", onPtrUp, { passive: true });
  addEventListener("keydown", onKey, { passive: false });
  addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });
  addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();
    },
    { passive: false }
  );
  addEventListener("gesturestart", function (e) {
    e.preventDefault();
  });
  addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
    },
    { passive: false }
  );
  if (C.addEventListener) {
    C.addEventListener("contextlost", function (e) {
      try {
        e.preventDefault();
      } catch (err) {}
      ctxLost = true;
      if (st === "play") pause();
      say("Graphics context lost. Paused.");
    });
    C.addEventListener("contextrestored", function () {
      ctxLost = false;
      if (grabCtx()) {
        skyKey = "";
        groundKey = "";
        pipeGradKey = "";
        birdSpriteKey = "";
        fit();
        layoutUI();
      }
      say("Graphics restored.");
    });
  }
  document.addEventListener("visibilitychange", function () {
    last = 0;
    acc = 0;
    if (document.hidden) {
      if (st === "play") pause();
      flushSave();
      applyGain();
      if (raf) {
        try {
          cancelAnimationFrame(raf);
        } catch (e) {}
      }
      raf = 0;
    } else {
      fit();
      if (hadGesture) {
        unlockAudio(false);
        applyGain();
        ensureMusic();
        healMusic();
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }
  });
  addEventListener("pagehide", function () {
    if (st === "play") pause();
    flushSave();
    applyGain();
  });
  addEventListener("pageshow", function () {
    last = 0;
    acc = 0;
    fit();
    if (hadGesture) {
      unlockAudio(false);
      applyGain();
      ensureMusic();
      healMusic();
    }
  });
  addEventListener("focus", function () {
    unlockAudio(false);
    if (hadGesture) healMusic();
  });
  const onReduce = function (e) {
    reduce = !!(e && e.matches);
    layoutUI();
  };
  if (mqReduce.addEventListener) mqReduce.addEventListener("change", onReduce);
  else if (mqReduce.addListener) mqReduce.addListener(onReduce);
  if (document.addEventListener)
    document.addEventListener("fullscreenchange", function () {
      setTimeout(onResize, 30);
    });
  if (document.addEventListener)
    document.addEventListener("webkitfullscreenchange", function () {
      setTimeout(onResize, 30);
    });

  let deferredPrompt = null;
  const installBtn = document.getElementById("install");
  try {
    addEventListener("beforeinstallprompt", function (e) {
      try {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn && isHttp()) installBtn.hidden = false;
      } catch (err) {}
    });
    addEventListener("appinstalled", function () {
      deferredPrompt = null;
      if (installBtn) installBtn.hidden = true;
    });
  } catch (e) {}
  if (installBtn)
    installBtn.addEventListener("click", function () {
      if (!deferredPrompt || !isHttp()) return;
      try {
        deferredPrompt.prompt();
        if (deferredPrompt.userChoice)
          deferredPrompt.userChoice.then(function () {
            deferredPrompt = null;
            installBtn.hidden = true;
          }).catch(function () {
            installBtn.hidden = true;
          });
      } catch (e) {
        installBtn.hidden = true;
      }
    });

  try {
    if ("serviceWorker" in navigator && isHttp()) {
      let wantReload = 0;
      navigator.serviceWorker
        .register("sw.js")
        .then(function (reg) {
          function showUpd() {
            const btn = document.getElementById("upd");
            if (btn) btn.hidden = false;
          }
          if (reg.waiting && navigator.serviceWorker.controller) showUpd();
          reg.addEventListener("updatefound", function () {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener("statechange", function () {
              if (sw.state === "installed" && navigator.serviceWorker.controller) showUpd();
            });
          });
          const upd = document.getElementById("upd");
          if (upd)
            upd.addEventListener("click", function () {
              wantReload = 1;
              if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
            });
        })
        .catch(function () {});
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (wantReload) location.reload();
      });
    }
  } catch (e) {}

  try {
    C.focus({ preventScroll: true });
  } catch (e) {
    try {
      C.focus();
    } catch (e2) {}
  }

  fit();
  resetWorld();
  st = "ready";
  stateAt = performance.now();
  transAt = 0;
  layoutUI();
  scheduleSave();
  say("FLAP. Choose Classic, Daily, or Practice. Tap, click, or press Space to fly.");
  setTimeout(function () {
    if (audioPrewarmed || hadGesture || AC) return;
    audioPrewarmed = true;
    if (buildContext()) {
      warmSfx(["jump", "ui"]);
      warmSfxBackground();
      const active = activeMusicKey();
      requestMusic(active);
      const all = Object.keys(MUSIC_BEAT);
      for (let i = 0; i < all.length; i++) if (all[i] !== active) requestMusic(all[i]);
    }
  }, 0);
  raf = requestAnimationFrame(loop);

  function rectList(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      out.push({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h });
    }
    return out;
  }
  if (DEBUG_HOOK)
    try {
      Object.defineProperty(window, "__FLAP__", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: {
        stressAudio: function (n) {
          if (!hadGesture || !AC) return 0;
          const b = ensureSfx("jump");
          if (!b) return 0;
          for (let i = 0; i < n; i++) playSfx("probe" + i, b, 0.01);
          return voices.length;
        },
        getState: function () {
          return {
            state: st,
            panel: panel,
            mode: mode,
            score: score,
            shownScore: shownScore,
            best: best,
            runFlaps: runFlaps,
            runStreak: runStreak,
            bestStreak: save.stats.bestStreak,
            newBest: newBestRun || dailyNewBest,
            daily: { date: save.daily.date, best: save.daily.best },
            stats: {
              runs: save.stats.runs,
              flaps: save.stats.flaps,
              bestStreak: save.stats.bestStreak,
            },
            skin: save.skins.selected,
            unlocked: save.skins.unlocked.slice(),
            history: save.history.map(function (e) {
              return { s: e.s, m: e.m, d: e.d, t: e.t };
            }),
            muted: muted,
            music: save.settings.music,
            haptics: save.settings.haptics,
            tutorialSeen: save.tutorialSeen,
            reduceMotion: reduce,
            shareSupported: shareSupported,
            fullscreenSupported: fsSupported,
            fullscreen: isFullscreen(),
            quality: quality,
            frameEMA: frameEMA,
            particles: parts.length,
            audioState: AC ? AC.state : null,
            audioTime: AC ? AC.currentTime : 0,
            audioVoices: voices.length,
            audioBuffers: SFX_KINDS.filter(function (k) {
              return !!buffers[k];
            }).length,
            audioMusic: !!musicSrc,
            audioMusicMode: musicBufKey,
            audioMaster: masterGain ? masterGain.gain.value : 0,
            audioMusicGain: musicGain ? musicGain.gain.value : 0,
            audioSfxGain: sfxGain ? sfxGain.gain.value : 0,
            audioLimit: limiter
              ? {
                  threshold: limiter.threshold.value,
                  ratio: limiter.ratio.value,
                  knee: limiter.knee.value,
                }
              : null,
            audioDuck: duck,
            audioGesture: hadGesture,
            audioResumes: audioResumes,
            audioRebuilds: audioRebuilds,
            audioGlitches: audioGlitches,
            audioMusicId: musicId,
            audioPending: pendingRebuild,
            dpr: DPR,
            dprCap: Math.min(devicePixelRatio || 1, 2),
            W: W,
            H: H,
            U: U,
            siteUrl: siteUrl(),
            pipeSeed: pipeSeed,
            pipes: pipes.map(function (p) {
              return { x: p.x, w: p.w, gap: p.gap, mid: p.mid, hit: p.hit };
            }),
            bird: bird ? { x: bird.x, y: bird.y, vy: bird.vy, s: bird.s } : null,
            toast: toastObj.text,
            frames: renderedFrames,
            ui: {
              hud: rectList(ui.hud),
              readyModes: rectList(ui.readyModes),
              readySkins: rectList(ui.readySkins),
              pause: rectList(ui.pause),
              over: rectList(ui.over),
              panel: rectList(ui.panel),
              overCard: ui.overCard,
              pauseCard: ui.pauseCard,
              panelCard: ui.panelCard,
            },
          };
        },
      },
    });
  } catch (e) {}
})();
