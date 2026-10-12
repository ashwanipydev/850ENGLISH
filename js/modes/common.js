/* 850 Basic English — shared session UI: question shell, option lists,
 * feedback, session summary, sheets, toasts, confetti, tiny sounds,
 * keyboard navigation and small DOM helpers.
 */
(function () {
  'use strict';

  var S = B850.store;
  var main = null;
  var sheetHost = null;
  var fxHost = null;
  var activeKeyHandler = null;
  var lastSheetClose = null;
  var audioBtnEl = null;

  /* ---------- tiny helpers ---------- */

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      var k;
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) { continue; }
        if (k === 'class') { el.className = attrs[k]; }
        else if (k === 'text') { el.textContent = attrs[k]; }
        else if (k === 'html') { el.innerHTML = attrs[k]; }
        else if (k === 'style') { el.setAttribute('style', attrs[k]); }
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        }
        else if (attrs[k] !== null && attrs[k] !== undefined) { el.setAttribute(k, attrs[k]); }
      }
    }
    (children || []).forEach(function (c) {
      if (c == null) { return; }
      if (typeof c === 'string' || typeof c === 'number') { el.appendChild(document.createTextNode(String(c))); }
      else { el.appendChild(c); }
    });
    return el;
  }

  function el(id) { return document.getElementById(id); }

  function announce(msg) {
    var node = el('liveRegion');
    if (!node) {
      node = h('div', { id: 'liveRegion', class: 'sr-only', role: 'status', 'aria-live': 'polite' });
      node.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(node);
    }
    node.textContent = '';
    // double-write so screen readers re-announce even identical messages
    window.setTimeout(function () { node.textContent = msg; }, 30);
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) { window.clearTimeout(t); }
      t = window.setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* ---------- sounds (synthesised, no files) ---------- */

  var actx = null;
  function sound(kind) {
    var st0 = B850.state;
    if (!st0 || !st0.settings.sound) { return; }
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') { actx.resume(); }
      var notes = kind === 'ok' ? [660, 880] : [220, 180];
      var t0 = actx.currentTime;
      notes.forEach(function (f, i) {
        var o = actx.createOscillator();
        var g = actx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.16);
        o.connect(g).connect(actx.destination);
        o.start(t0 + i * 0.09);
        o.stop(t0 + i * 0.09 + 0.2);
      });
    } catch (e) { /* audio optional */ }
  }

  /* ---------- celebration fx ---------- */

  function celebrate(msg) {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (msg) { toast(msg); }
    if (reduced) { return; }
    var host = fxHost;
    if (!host) { return; }
    var colors = ['#2f6df6', '#1e7d46', '#e5a50a', '#d6455f', '#7b5cd6', '#2aa198'];
    for (var i = 0; i < 42; i++) {
      var c = h('i', { class: 'confetti' });
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
      c.style.animationDelay = (Math.random() * 0.35) + 's';
      c.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      host.appendChild(c);
      (function (node) { window.setTimeout(function () { if (node.parentNode) { node.parentNode.removeChild(node); } }, 3400); })(c);
    }
  }

  function toast(msg) {
    if (!fxHost) { return; }
    var t = h('div', { class: 'toast', text: msg, role: 'status' });
    fxHost.appendChild(t);
    window.setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 1900);
  }

  /* ---------- sheets (in-page dialogs; no alert/confirm) ---------- */

  function openSheet(opts) {
    // opts: { title, body: node|string, actions: [{label, value, class, primary}] }
    closeSheet();
    var onAction = function (value) { closeSheet(); if (opts.onAction) { opts.onAction(value); } };
    var actions = (opts.actions || []).map(function (a) {
      return h('button', {
        class: 'btn ' + (a.class || (a.primary ? '' : 'btn-secondary')),
        type: 'button',
        text: a.label,
        onclick: function () { onAction(a.value); }
      });
    });
    var sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog' }, [
      h('div', { class: 'sheet-handle', 'aria-hidden': 'true' }),
      h('h2', { class: 'sheet-title', text: opts.title || '' }),
      h('div', { class: 'sheet-body' }, opts.body ? [opts.body] : []),
      h('div', { class: 'sheet-actions' }, actions)
    ]);
    var backdrop = h('div', { class: 'sheet-backdrop' });
    var host = h('div', {}, [backdrop, sheet]);
    sheetHost.hidden = false;
    sheetHost.innerHTML = '';
    sheetHost.appendChild(host);
    backdrop.addEventListener('click', function () { closeSheet(); if (opts.onClose) { opts.onClose('cancel'); } });
    lastSheetClose = sheet.querySelector('.sheet-actions .btn') || sheet.querySelector('button');
    if (lastSheetClose) { lastSheetClose.focus(); }
    return sheet;
  }

  function closeSheet() {
    if (!sheetHost) { return; }
    sheetHost.hidden = true;
    sheetHost.innerHTML = '';
    if (lastSheetClose && lastSheetClose.focus) { try { lastSheetClose.blur(); } catch (e) { /* ignore */ } }
    lastSheetClose = null;
  }

  function confirmSheet(title, bodyText, okLabel, onOk) {
    openSheet({
      title: title,
      body: h('p', { text: bodyText, style: 'margin:0' }),
      actions: [
        { label: 'Cancel', value: 'cancel', class: 'btn-secondary' },
        { label: okLabel || 'Confirm', value: 'ok', primary: true }
      ],
      onAction: function (v) { if (v === 'ok') { onOk(); } }
    });
  }

  /* ---------- question shell ---------- */

  function questionShell(opts) {
    // opts: { title, countText, prompt: node, options: [node...], footer: node }
    var root = h('section', { class: 'screen session-screen' });
    var bar = h('div', { class: 'session-bar' }, [
      h('div', { class: 'progress-bar', 'aria-hidden': 'true' }, [h('i', { style: 'width:0%' })]),
      h('span', { class: 'q-count', 'aria-live': 'off', text: opts.countText || '' })
    ]);
    root.appendChild(bar);
    root.appendChild(opts.prompt);
    if (opts.options) {
      var list = h('div', { class: 'options', role: 'group', 'aria-label': 'Answer options' }, opts.options);
      root.appendChild(list);
    }
    var fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
    root.appendChild(fb);
    if (opts.footer) { root.appendChild(opts.footer); }
    root._barFill = bar.querySelector('.progress-bar > i');
    root._fb = fb;
    return root;
  }

  function makeOption(index, label, opts) {
    opts = opts || {};
    var btn = h('button', {
      class: 'option',
      type: 'button',
      disabled: opts.disabled ? 'disabled' : null
    }, [
      h('span', { class: 'opt-key', 'aria-hidden': 'true', text: String(index + 1) }),
      h('span', { class: 'opt-label', text: label }),
      h('span', { class: 'opt-mark', 'aria-hidden': 'true' })
    ]);
    btn.setAttribute('aria-label', 'Option ' + (index + 1) + ': ' + label);
    return btn;
  }

  function markOptions(root, correctIndex, chosenIndex) {
    var options = root.querySelectorAll('.option');
    var i, o;
    for (i = 0; i < options.length; i++) {
      o = options[i];
      o.disabled = 'disabled';
      o.classList.add('dim');
      if (i === correctIndex) {
        o.classList.remove('dim');
        o.classList.add('correct');
        o.setAttribute('aria-label', (i + 1) + ': ' + o.querySelector('.opt-label').textContent + ' (correct answer)');
      }
      if (i === chosenIndex && i !== correctIndex) {
        o.classList.remove('dim');
        o.classList.add('wrong');
      }
    }
  }

  function setFeedback(root, ok, text, detail) {
    if (!root || !root._fb) { return; }
    var fb = root._fb;
    fb.className = 'feedback ' + (ok ? 'ok' : 'no');
    fb.innerHTML = '';
    fb.appendChild(h('span', { text: (ok ? '✓ Correct. ' : '✕ Not quite. ') + text }));
    if (detail) { fb.appendChild(h('span', { class: 'fb-detail', text: detail })); }
  }

  function clearFeedback(root) {
    root._fb.className = 'feedback';
    root._fb.textContent = '';
  }

  /* ---------- audio control (with graceful fallback) ---------- */

  function audioButton(word, opts) {
    // Returns a node for the big replay control, or a text fallback.
    opts = opts || {};
    if (!S.speech.supported()) {
      return h('p', { class: 'prompt-sub', text: 'Audio is not available on this device — reading the text instead.' });
    }
    var orb = h('button', {
      class: 'audio-orb',
      type: 'button',
      'aria-label': 'Play the English word again',
      title: 'Play again'
    }, [
      h('svg', { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [
        h('path', { d: 'M11 5 6 9H2v6h4l5 4z' }),
        h('path', { d: 'M15.5 8.5a5 5 0 0 1 0 7' }),
        h('path', { d: 'M18.5 5.5a9 9 0 0 1 0 13' })
      ])
    ]);
    var guard = false;
    orb.addEventListener('click', function () {
      if (guard) { return; }
      guard = true;
      orb.classList.add('speaking');
      S.speech.speak(word, function () {
        guard = false;
        orb.classList.remove('speaking');
      });
    });
    audioBtnEl = orb;
    return orb;
  }

  function stopAudio() {
    S.speech.cancel();
    if (audioBtnEl) { audioBtnEl.classList.remove('speaking'); }
    audioBtnEl = null;
  }

  /* ---------- session summary + progress persistence ---------- */

  function recordAnswer(word, correct, opts) {
    opts = opts || {};
    var st = B850.state;
    S.touchDay(st);
    st.answers.total += 1;
    if (correct) { st.answers.correct += 1; }
    st.daily.count += 1;
    var t = S.todayStr();
    var day = st.sessions[t] || (st.sessions[t] = { answered: 0, correct: 0 });
    day.answered += 1;
    if (correct) { day.correct += 1; }
    var acc = st.accuracy[t] || (st.accuracy[t] = { answered: 0, correct: 0 });
    acc.answered += 1;
    if (correct) { acc.correct += 1; }
    if (word) {
      st.seen[word.id] = 1;
      if (correct) { st.learned[word.id] = 1; }
      if (correct) {
        var before = S.xpToLevel(st.xp);
        var award = typeof opts.xp === 'number' ? opts.xp : S.xpFor(word);
        st.xp += Math.max(0, award);
        var after = S.xpToLevel(st.xp);
        if (after > before && !opts.quiet) {
          celebrate('Level ' + after + '!');
        }
      }
    }
    // Celebrate the goal only on the answer that crosses the threshold.
    var goalHit = st.daily.count > 0 && st.daily.count === st.settings.goal && opts.celebrate !== false;
    S.save(st);
    refreshChrome();
    return { goalHit: goalHit };
  }

  function summaryView(correct, total, onExit, onAgain) {
    var pct = total ? Math.round((correct / total) * 100) : 0;
    var root = h('section', { class: 'screen' }, [
      h('div', { class: 'card session-summary' }, [
        h('div', { class: 'big-score', text: pct + '%' }),
        h('p', { class: 'screen-sub', style: 'margin:0', text: correct + ' of ' + total + ' correct' }),
        h('div', { class: 'score-line' }, [
          h('span', { class: 'pill pill-good', text: '✓ ' + correct }),
          h('span', { class: 'pill pill-bad', text: '✕ ' + (total - correct) })
        ])
      ]),
      h('div', { class: 'fc-actions' }, [
        h('button', { class: 'btn btn-secondary btn-lg', type: 'button', text: 'Go home', onclick: onExit }),
        h('button', { class: 'btn btn-lg', type: 'button', text: 'One more round', onclick: onAgain })
      ])
    ]);
    return root;
  }

  /* ---------- navigation + keyboard ---------- */

  function back() {
    B850.ui.navigate('home');
  }

  function registerKey(fn) {
    activeKeyHandler = fn;
  }

  function clearKey() {
    activeKeyHandler = null;
  }

  function onKey(e) {
    if (sheetHost && !sheetHost.hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet();
        if (lastSheetClose) { /* focus stays where it is */ }
      }
      return;
    }
    if (!activeKeyHandler) { return; }
    activeKeyHandler(e);
  }

  /* ---------- chrome (badges, streak) ---------- */

  function refreshChrome() {
    var st = B850.state;
    // streak badge
    var badge = el('streakBadge');
    if (badge) {
      if (st.streak.count > 0) {
        badge.hidden = false;
        badge.textContent = '🔥 ' + st.streak.count + (st.streak.count === 1 ? ' day' : ' days');
      } else {
        badge.hidden = true;
      }
    }
    // review due count
    var rev = el('reviewBadge');
    if (rev) {
      var due = dueCount();
      if (due > 0) {
        rev.hidden = false;
        rev.textContent = due > 99 ? '99+' : String(due);
      } else {
        rev.hidden = true;
      }
    }
  }

  function dueCount() {
    var st = B850.state;
    var t = S.todayStr();
    var n = 0;
    for (var id in st.srs) {
      if (Object.prototype.hasOwnProperty.call(st.srs, id) && st.srs[id].due <= t) { n += 1; }
    }
    return n;
  }

  /* ---------- ring ---------- */

  function ring(pct, size, stroke, labelValue, labelSub, color) {
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var off = c * (1 - Math.max(0, Math.min(1, pct)));
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('aria-hidden', 'true');
    var track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', size / 2);
    track.setAttribute('cy', size / 2);
    track.setAttribute('r', r);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke-width', stroke);
    track.setAttribute('class', 'ring-track');
    var fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fg.setAttribute('cx', size / 2);
    fg.setAttribute('cy', size / 2);
    fg.setAttribute('r', r);
    fg.setAttribute('fill', 'none');
    fg.setAttribute('stroke', color || 'var(--accent)');
    fg.setAttribute('stroke-width', stroke);
    fg.setAttribute('stroke-linecap', 'round');
    fg.setAttribute('class', 'ring-fg');
    fg.setAttribute('stroke-dasharray', c.toFixed(1));
    fg.setAttribute('stroke-dashoffset', off.toFixed(1));
    fg.setAttribute('transform', 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')');
    svg.appendChild(track);
    svg.appendChild(fg);
    var wrap = h('div', { class: 'ring-wrap' }, [svg, h('div', { class: 'ring-label' }, [
      h('b', { text: String(labelValue) }),
      h('span', { text: String(labelSub || '') })
    ])].filter(Boolean));
    return wrap;
  }

  function segButton(label, pressed, onclick) {
    var b = h('button', {
      type: 'button',
      'aria-pressed': pressed ? 'true' : 'false',
      text: label
    });
    b.addEventListener('click', onclick);
    return b;
  }

  /* ---------- screen rendering ---------- */

  function render(node) {
    if (!main) { return; }
    S.speech.cancel();
    main.innerHTML = '';
    main.appendChild(node);
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ---------- init ---------- */

  B850.screens = B850.screens || {};

  function init() {
    main = el('main');
    sheetHost = el('sheetHost');
    fxHost = el('fxHost');
    document.addEventListener('keydown', onKey);
    refreshChrome();
  }

  B850.ui = {
    init: init,
    render: render,
    h: h,
    el: el,
    announce: announce,
    debounce: debounce,
    sound: sound,
    celebrate: celebrate,
    toast: toast,
    openSheet: openSheet,
    closeSheet: closeSheet,
    confirmSheet: confirmSheet,
    questionShell: questionShell,
    makeOption: makeOption,
    markOptions: markOptions,
    setFeedback: setFeedback,
    clearFeedback: clearFeedback,
    audioButton: audioButton,
    stopAudio: stopAudio,
    recordAnswer: recordAnswer,
    summaryView: summaryView,
    refreshChrome: refreshChrome,
    dueCount: dueCount,
    ring: ring,
    registerKey: registerKey,
    clearKey: clearKey,
    back: back,
    segButton: segButton
  };
})();
