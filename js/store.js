/* 850 Basic English — data normalisation + versioned localStorage state.
 * Loads the classic-script dataset bound to `vocabulary` (see data/words.js).
 * Exactly one global: window.B850.
 */
(function () {
  'use strict';

  var KEY = 'b850:v1';
  var DAY_MS = 86400000;

  var CATEGORIES = [
    { id: 'operations', label: 'Operations', emoji: '⚙️' },
    { id: 'things_general', label: 'Things — General', emoji: '🧾' },
    { id: 'things_picturable', label: 'Things — Picturable', emoji: '🖼️' },
    { id: 'qualities_general', label: 'Qualities — General', emoji: '✨' },
    { id: 'qualities_opposites', label: 'Qualities — Opposites', emoji: '↔️' }
  ];

  var CATEGORY_MAP = {};
  CATEGORIES.forEach(function (c) { CATEGORY_MAP[c.id] = c; });

  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function addDays(dateStr, n) {
    var p = dateStr.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return todayStr(d);
  }

  function strToMidnight(dateStr) {
    var p = dateStr.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }

  function diffDays(a, b) {
    return Math.round((strToMidnight(a) - strToMidnight(b)) / DAY_MS);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(arr, n) { return shuffle(arr).slice(0, n); }

  /* ---------------- normalise the dataset (never edit the file) ---------------- */

  function normalise() {
    var raw = (typeof vocabulary !== 'undefined') ? vocabulary : null;
    if (!Array.isArray(raw)) { return null; }

    var words = [];
    var seen = {};
    var byWord = {};
    var groupsByHindi = {};
    var byCategory = {};
    var i, v, base, hi, n;

    for (i = 0; i < raw.length; i++) {
      v = raw[i];
      if (!v || typeof v !== 'object') continue;
      if (typeof v.id !== 'number' || seen[v.id]) continue; // duplicate ids: skip
      seen[v.id] = true;
      base = String(v.word || '').trim().split('/')[0].trim().toLowerCase();
      if (!base) continue; // empty word: skip defensively
      hi = String(v.meaningHindi || '').trim();
      n = {
        id: v.id,
        word: String(v.word || '').trim(),
        base: base,
        variants: String(v.word || '').split('/').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean),
        pronunciation: String(v.pronunciation || ''),
        meaningHindi: hi,
        meaningEnglish: String(v.meaningEnglish || ''),
        exampleSentence: String(v.exampleSentence || ''),
        exampleHindi: String(v.exampleHindi || ''),
        category: v.category,
        categoryLabel: String(v.categoryLabel || (CATEGORY_MAP[v.category] ? CATEGORY_MAP[v.category].label : 'Other')),
        difficulty: (typeof v.difficulty === 'number' ? v.difficulty : 1),
        sourceOrder: typeof v.sourceOrder === 'number' ? v.sourceOrder : i,
        source: String(v.source || '')
      };
      words.push(n);
      byWord[base] = n;
      if (hi) { (groupsByHindi[hi] = groupsByHindi[hi] || []).push(n.id); }
      (byCategory[n.category] = byCategory[n.category] || []).push(n.id);
    }

    words.sort(function (a, b) { return a.sourceOrder - b.sourceOrder; });

    return {
      words: words,
      byId: (function () {
        var m = {};
        words.forEach(function (w) { m[w.id] = w; });
        return m;
      })(),
      byWord: byWord,
      groupsByHindi: groupsByHindi,
      byCategory: byCategory,
      total: words.length
    };
  }

  /* ---------------- safe state reader ---------------- */

  function defaults() {
    return {
      version: 1,
      settings: {
        langFirst: 'hindi',   // 'hindi' | 'english' — default prompt language
        voiceURI: '',         // '' = auto-pick en-US
        rate: 0.9,
        sound: true,
        goal: 20              // daily goal in answered questions
      },
      xp: 0,
      answers: { total: 0, correct: 0 },
      daily: { date: todayStr(), count: 0 },
      streak: { count: 0, lastDate: null },
      seen: {},               // wordId -> 1
      learned: {},            // wordId -> 1 (at least one correct answer or "Know it")
      sessions: {},           // dateStr -> { answered, correct }
      accuracy: {},           // dateStr -> { answered, correct }
      srs: {},                // wordId -> { box, due, reps, lapses, last }
      lastMode: null,         // { mode, params } for the Continue CTA
      updatedAt: Date.now()
    };
  }

  function load() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) { return d; }
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') { return d; }
      // merge shallow top-level, deep-merge known objects
      var k;
      for (k in d) {
        if (Object.prototype.hasOwnProperty.call(d, k)) {
          if (p[k] !== undefined && (typeof d[k] !== 'object' || d[k] === null)) { p[k] = p[k]; }
          if (p[k] === undefined || p[k] === null) { p[k] = d[k]; }
          if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) &&
              p[k] && typeof p[k] === 'object' && !Array.isArray(p[k])) {
            p[k] = Object.assign({}, d[k], p[k]);
          }
        }
      }
      // tolerate corrupt nested shapes
      if (!p.daily || typeof p.daily.date !== 'string') { p.daily = d.daily; }
      if (!p.streak || typeof p.streak.count !== 'number') { p.streak = d.streak; }
      if (!p.answers || typeof p.answers.total !== 'number') { p.answers = d.answers; }
      if (!p.settings || typeof p.settings.goal !== 'number') { p.settings = d.settings; }
      ['seen', 'learned', 'sessions', 'accuracy', 'srs'].forEach(function (f) {
        if (!p[f] || typeof p[f] !== 'object' || Array.isArray(p[f])) { p[f] = {}; }
      });
      return p;
    } catch (e) {
      return d; // corrupt JSON: fall back to defaults (never crash)
    }
  }

  function save(state) {
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false; // quota / private mode: app keeps working in memory
    }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    return defaults();
  }

  /* ---------------- day / streak / goal bookkeeping ---------------- */

  function touchDay(state) {
    var t = todayStr();
    if (state.daily.date !== t) { state.daily = { date: t, count: 0 }; }
    var s = state.streak;
    if (s.lastDate === t) { return; }
    if (s.lastDate && diffDays(t, s.lastDate) === 1) {
      s.count += 1;
    } else if (!s.lastDate || diffDays(t, s.lastDate) > 1) {
      // Gap of exactly one missed day keeps the streak alive; anything else
      // (or the very first day) (re)starts at 1.
      s.count = (s.lastDate && diffDays(t, s.lastDate) === 2) ? s.count : 1;
    }
    s.lastDate = t;
  }

  function goalReached(state) {
    return state.daily.count >= state.settings.goal;
  }

  function xpToLevel(xp) {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  }

  function levelProgress(xp) {
    var lvl = xpToLevel(xp);
    var start = (lvl - 1) * (lvl - 1) * 100;
    var next = lvl * lvl * 100;
    return { level: lvl, into: xp - start, span: next - start, pct: (xp - start) / (next - start) };
  }

  /* XP per correct answer scales a little with difficulty. */
  function xpFor(word) {
    return 10 + (word ? Math.max(0, Math.min(3, word.difficulty)) * 5 : 0);
  }

  var storeObj = {
    KEY: KEY,
    CATEGORIES: CATEGORIES,
      CATEGORY_MAP: CATEGORY_MAP,
      todayStr: todayStr,
      addDays: addDays,
      diffDays: diffDays,
      shuffle: shuffle,
      pick: pick,
      normalise: normalise,
      load: load,
      save: save,
      reset: reset,
      defaults: defaults,
      touchDay: touchDay,
      goalReached: goalReached,
      xpToLevel: xpToLevel,
    levelProgress: levelProgress,
    xpFor: xpFor
  };

  // Live accessors so mode code can read `S.state` / `S.data` without
  // hard-coding the namespace location (they live on B850, set in app.js).
  Object.defineProperty(storeObj, 'state', {
    get: function () { return window.B850.state; },
    set: function (v) { window.B850.state = v; },
    enumerable: true, configurable: true
  });
  Object.defineProperty(storeObj, 'data', {
    get: function () { return window.B850.data; },
    set: function (v) { window.B850.data = v; },
    enumerable: true, configurable: true
  });

  window.B850 = window.B850 || {};
  window.B850.store = storeObj;
})();
