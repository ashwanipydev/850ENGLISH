/* 850 Basic English — Quiz mode (4 variants) + Listening mode.
 * Variants: en2hi (word → Hindi), hi2en (Hindi → word), audio (TTS → meaning/word),
 * blank (fill the blank). All 4-option multiple choice. Distractors come from the
 * same category + difficulty where possible, never equal the answer, never repeat,
 * and options are shuffled every time.
 */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;
  var srs = S.srs;
  var SESSION_LEN = 10;

  /* ---------------- question builders ---------------- */

  function poolFor(word, k) {
    // same category + difficulty first, then same category, then difficulty, then everything
    var all = S.data.words;
    var c1 = all.filter(function (w) { return w.id !== word.id && w.category === word.category && w.difficulty === word.difficulty; });
    var c2 = all.filter(function (w) { return w.id !== word.id && w.category === word.category; });
    var c3 = all.filter(function (w) { return w.id !== word.id && w.difficulty === word.difficulty; });
    var used = {}, out = [];
    [c1, c2, c3, all.filter(function (w) { return w.id !== word.id; })].forEach(function (bucket) {
      for (var i = 0; i < bucket.length && out.length < k; i++) {
        var w = bucket[i];
        if (used[w.id]) { continue; }
        used[w.id] = 1;
        out.push(w);
      }
    });
    return out;
  }

  function distractors(word, n, labelFn) {
    // labelFn(word) -> display label; must be unique and != answer label
    var answerLabel = labelFn(word);
    var pool = S.shuffle(poolFor(word, n * 3 + 8));
    var out = [], seen = {};
    for (var i = 0; i < pool.length && out.length < n; i++) {
      var w = pool[i];
      var label = labelFn(w);
      if (!label || label === answerLabel || seen[label]) { continue; }
      seen[label] = 1;
      out.push(w);
    }
    // top-up from anywhere if the category ran dry (keeps options = 4)
    if (out.length < n) {
      var rest = S.shuffle(S.data.words);
      for (var j = 0; j < rest.length && out.length < n; j++) {
        var w2 = rest[j];
        if (w2.id === word.id) { continue; }
        var l2 = labelFn(w2);
        if (!l2 || l2 === answerLabel || seen[l2]) { continue; }
        seen[l2] = 1;
        out.push(w2);
      }
    }
    return out;
  }

  function buildOptions(word, labelFn) {
    var opts = [{ word: word, label: labelFn(word), correct: true }];
    distractors(word, 3, labelFn).forEach(function (w) {
      opts.push({ word: w, label: labelFn(w), correct: false });
    });
    return S.shuffle(opts);
  }

  function buildQuestion(variant, word) {
    var q = { word: word, variant: variant, options: null, prompt: null, audio: false };
    var st = S.state;

    if (variant === 'en2hi') {
      q.options = buildOptions(word, function (w) { return w.meaningHindi; });
      q.prompt = U.h('div', { class: 'prompt-card card' }, [
        U.h('div', { class: 'prompt-word', text: word.word }),
        U.h('div', { class: 'prompt-pron', text: word.pronunciation || '—' }),
        U.h('div', { class: 'prompt-sub', text: 'Which Hindi meaning fits?' })
      ]);
    } else if (variant === 'hi2en') {
      q.options = buildOptions(word, function (w) { return w.word; });
      q.prompt = U.h('div', { class: 'prompt-card card' }, [
        U.h('div', { class: 'prompt-hindi', text: word.meaningHindi }),
        U.h('div', { class: 'prompt-sub', text: 'Which English word matches?' }),
        U.h('div', { class: 'fc-ex', style: 'text-align:left;margin-top:10px' }, [
          U.h('div', { text: word.exampleSentence }),
          U.h('div', { class: 'fc-ex-hi', text: word.exampleHindi })
        ])
      ]);
    } else if (variant === 'blank') {
      var re = new RegExp('\\b(' + word.variants.map(escapeReg).join('|') + ')\\b', 'i');
      var sentence = word.exampleSentence;
      q.blankMatched = re.test(sentence);
      if (q.blankMatched) {
        sentence = sentence.replace(re, '____');
      } else {
        // defensive fallback: show the first Hindi-meaning group sentence is risky, so
        // fall back to en2hi-style prompt with the word hidden
        q.blankMatched = false;
      }
      q.options = buildOptions(word, function (w) { return w.word; });
      var body;
      if (q.blankMatched) {
        body = U.h('div', { class: 'prompt-sentence', text: '' });
        // rebuild with the blank styled
        var parts = word.exampleSentence.split(re);
        var kids = [];
        var first = true;
        parts.forEach(function (p) {
          if (p) { kids.push(p); }
          if (!first) { kids.push(U.h('span', { class: 'blank', text: '____' })); }
          first = false;
        });
        body = U.h('div', { class: 'prompt-sentence' }, kids);
      } else {
        body = U.h('div', {}, [
          U.h('div', { class: 'prompt-word', text: word.word }),
          U.h('div', { class: 'prompt-pron', text: word.pronunciation || '—' }),
          U.h('div', { class: 'prompt-sub', text: 'Pick the meaning of this word' })
        ]);
      }
      q.prompt = U.h('div', { class: 'prompt-card card' }, [
        body,
        U.h('div', { class: 'prompt-sub', text: q.blankMatched ? 'Fill in the blank:' : 'Choose the correct option' })
      ]);
    } else if (variant === 'audio') {
      var langFirst = st.settings.langFirst || 'hindi';
      var useHindiOptions = langFirst === 'hindi';
      q.options = buildOptions(word, function (w) {
        return useHindiOptions ? w.meaningHindi : w.word;
      });
      q.prompt = U.h('div', { class: 'prompt-card card audio-prompt' }, [
        U.h('div', { class: 'prompt-sub', text: 'Listen and choose' }),
        U.h('div', { text: '' }) // audio button slot, filled by runner after speech availability is known
      ]);
      q.audio = true;
    }
    return q;
  }

  function escapeReg(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ---------------- session runner ---------------- */

  function startQuiz(params) {
    params = params || {};
    var variant = params.variant || 'mix';
    var category = params.category || null;
    var variants = variant === 'mix' ? ['en2hi', 'hi2en', 'audio', 'blank'] : [variant];
    var pool = buildDeck(category);
    if (!pool.length) {
      U.toast('No words in this selection.');
      return;
    }
    // build the question list (with variant rotation)
    var items = [];
    var words = S.shuffle(pool).slice(0, SESSION_LEN);
    words.forEach(function (id, idx) {
      var w = S.data.byId[id];
      var v = variants[idx % variants.length];
      // audio variant needs speech; fall back to en2hi gracefully
      if (v === 'audio' && !S.speech.supported()) { v = 'en2hi'; }
      items.push(buildQuestion(v, w));
    });

    var state = {
      items: items,
      i: 0,
      correct: 0,
      root: null,
      locked: false
    };
    state.root = U.h('section', { class: 'screen', 'aria-label': 'Quiz' });
    renderQuestion();
    U.render(state.root);
    U.registerKey(onKey);

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
      if (state.locked) { return; }
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) {
        e.preventDefault();
        choose(n - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var opts = state.root.querySelectorAll('.option:not([disabled])');
        if (opts.length === 1) { choose(0); }
      }
    }

    function choose(idx) {
      if (state.locked) { return; } // double-tap guard
      state.locked = true;
      U.stopAudio();
      var q = state.items[state.i];
      var correctIdx = -1, k;
      for (k = 0; k < q.options.length; k++) { if (q.options[k].correct) { correctIdx = k; } }
      var ok = idx === correctIdx;
      U.markOptions(state.root, correctIdx, idx);
      var st = S.state;
      var t = S.todayStr();
      var word = q.word;
      if (ok) {
        state.correct += 1;
        srs.answer(st, word.id, true, t);
      } else {
        srs.answer(st, word.id, false, t);
      }
      var res = U.recordAnswer(word, ok, {});
      U.sound(ok ? 'ok' : 'bad');
      var detail = q.options[correctIdx].word.word;
      U.setFeedback(
        state.root,
        ok,
        ok ? '' : 'The answer is',
        word.word + ' — ' + word.meaningHindi + ' (' + word.meaningEnglish + ')'
      );
      if (res.goalHit) { U.celebrate('Daily goal reached! 🎯'); }
      U.announce((ok ? 'Correct. ' : 'Not quite. The answer is ') + word.word + ', ' + word.meaningHindi);
      window.setTimeout(advance, 1150);
    }

    function advance() {
      state.i += 1;
      state.locked = false;
      if (state.i >= state.items.length) { finish(); return; }
      renderQuestion();
      focusFirstOption();
    }

    function finish() {
      U.clearKey();
      U.stopAudio();
      var root = U.summaryView(state.correct, state.items.length, function () { U.back(); }, function () {
        state.items = items; // restart same list fresh
        state.i = 0;
        state.correct = 0;
        state.root = U.h('section', { class: 'screen', 'aria-label': 'Quiz again' });
        state.locked = false;
        renderQuestion();
        U.render(state.root);
        U.registerKey(onKey);
        focusFirstOption();
      });
      U.render(root);
    }

    function renderQuestion() {
      var q = state.items[state.i];
      // test/debug hook: expose the current question so automated tests can find the correct option
      if (typeof window !== 'undefined') { window.__b850CurrentQ = q; }
      var countText = (state.i + 1) + '/' + state.items.length;
      var title = {
        en2hi: 'Word → meaning',
        hi2en: 'Meaning → word',
        audio: 'Listening',
        blank: 'Fill the blank'
      }[q.variant] || 'Quiz';

      state.root.innerHTML = '';
      var bar = U.h('div', { class: 'session-bar' }, [
        U.h('div', { class: 'progress-bar', 'aria-hidden': 'true' }, [U.h('i', { style: 'width:' + Math.round((state.i / state.items.length) * 100) + '%' })]),
        U.h('span', { class: 'q-count', text: countText })
      ]);
      state.root.appendChild(bar);

      var head = U.h('div', { class: 'q-head' }, [
        U.h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'End quiz and go home', onclick: finish }, [
          U.h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [U.h('path', { d: 'M15 19l-7-7 7-7' })])
        ]),
        U.h('span', { class: 'q-title', text: title })
      ]);
      state.root.appendChild(head);

      var prompt = q.prompt;
      if (q.audio) {
        var slot = prompt.querySelector('div:last-child');
        if (slot) {
          slot.innerHTML = '';
          slot.appendChild(U.audioButton(q.word.word, {}));
        }
        // auto-play on question start (best effort; user can replay)
        try {
          var orb = slot.querySelector('.audio-orb');
          if (orb) {
            window.setTimeout(function () {
              // only auto-play if this is still the visible question
              if (state.root.isConnected && state.root.querySelector('.audio-orb') === orb) {
                U.speakOrb(orb, q.word.word);
              }
            }, 350);
          }
        } catch (e) { /* ignore */ }
      }
      state.root.appendChild(prompt);

      var optNodes = [];
      q.options.forEach(function (opt, idx) {
        var b = U.makeOption(idx, opt.label);
        b.addEventListener('click', function () { choose(idx); });
        optNodes.push(b);
      });
      var list = U.h('div', { class: 'options', role: 'group', 'aria-label': 'Answer options' }, optNodes);
      state.root.appendChild(list);
      var fb = U.h('div', { class: 'feedback', 'aria-live': 'polite' });
      state.root.appendChild(fb);
      state.root._fb = fb;
      state.root._barFill = bar.querySelector('.progress-bar > i');
    }

    function focusFirstOption() {
      var first = state.root.querySelector('.option');
      if (first) { first.focus({ preventScroll: true }); }
    }
  }

  // Expose the orb speaker so auto-play reuses the same guarded path.
  if (!U.speakOrb) {
    U.speakOrb = function (orb, word) {
      var guard = false;
      orb.classList.add('speaking');
      S.speech.speak(word, function () {
        guard = false;
        orb.classList.remove('speaking');
      });
    };
  }

  function buildDeck(category) {
    var ids;
    if (category) {
      ids = S.data.byCategory[category] || [];
    } else {
      ids = S.data.words.map(function (w) { return w.id; });
    }
    var st = S.state;
    var unseen = ids.filter(function (id) { return !st.seen[id]; });
    var seen = ids.filter(function (id) { return st.seen[id]; });
    return S.shuffle(unseen).concat(S.shuffle(seen));
  }

  /* ---------------- quiz picker screen ---------------- */

  var VARIANT_INFO = [
    { id: 'mix', name: 'Mixed round', emoji: '🎲', desc: 'All four types, 10 questions' },
    { id: 'en2hi', name: 'Word → meaning', emoji: '📖', desc: 'English word, pick the Hindi meaning' },
    { id: 'hi2en', name: 'Meaning → word', emoji: '🇮🇳', desc: 'Hindi meaning, pick the English word' },
    { id: 'audio', name: 'Listening', emoji: '🔊', desc: 'Hear the word, pick its meaning' },
    { id: 'blank', name: 'Fill the blank', emoji: '✏️', desc: 'Complete the example sentence' }
  ];

  function renderQuiz(params) {
    params = params || {};
    // Continue CTA: if a specific variant was last active, jump straight in
    if (params.variant) { startQuiz(params); return; }
    U.clearKey();
    var root = U.h('section', { class: 'screen', 'aria-label': 'Quiz menu' });
    root.appendChild(U.h('h1', { class: 'screen-title', text: 'Quiz' }));
    root.appendChild(U.h('p', { class: 'screen-sub', text: 'Ten questions per round. Correct answers move the card up a spaced-repetition box.' }));

    if (!S.speech.supported()) {
      root.appendChild(U.h('div', { class: 'card', style: 'background:var(--warn-soft);border-color:var(--warn)', 'role': 'note' }, [
        U.h('p', { class: 'screen-sub', style: 'margin:0', text: '🔇 Audio is unavailable on this device — the Listening round falls back to text questions.' })
      ]));
    }

    var list = U.h('div', { class: 'stat-list' });
    VARIANT_INFO.forEach(function (v) {
      list.appendChild(U.h('button', {
        class: 'mode-card',
        type: 'button',
        style: 'flex-direction:row;align-items:center;min-height:72px',
        'aria-label': v.name + '. ' + v.desc,
        onclick: function () {
          var st = S.state;
          st.lastMode = { mode: 'quiz', params: { variant: v.id } };
          S.save(st);
          startQuiz({ variant: v.id });
        }
      }, [
        U.h('span', { class: 'mode-emoji', 'aria-hidden': 'true', text: v.emoji }),
        U.h('div', {}, [
          U.h('div', { class: 'mode-name', text: v.name }),
          U.h('div', { class: 'mode-desc', text: v.desc })
        ])
      ]));
    });
    root.appendChild(list);
    U.render(root);
  }

  /* ---------------- listening mode (dedicated) ---------------- */

  function renderListen() {
    U.clearKey();
    if (!S.speech.supported()) {
      var msg = U.h('section', { class: 'screen' }, [
        U.h('h1', { class: 'screen-title', text: 'Listening' }),
        U.h('div', { class: 'card' }, [
          U.h('p', { class: 'screen-sub', style: 'margin:0', text: '🔇 Speech synthesis (an English voice) is not available on this device, so the listening game is hidden. Text modes — Quiz, Typing and Flashcards — work fully offline.' })
        ]),
        U.h('div', { style: 'margin-top:14px' }, [
          U.h('button', { class: 'btn btn-lg', type: 'button', text: 'Go home', onclick: function () { U.back(); } })
        ])
      ]);
      U.render(msg);
      return;
    }
    var root = U.h('section', { class: 'screen', 'aria-label': 'Listening' });
    root.appendChild(U.h('div', { class: 'q-head' }, [
      U.h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to home', onclick: function () { U.back(); } }, [
        U.h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [U.h('path', { d: 'M15 19l-7-7 7-7' })])
      ]),
      U.h('span', { class: 'q-title', text: 'Listening' })
    ]));
    root.appendChild(U.h('p', { class: 'screen-sub', text: 'Hear the English word, then pick its meaning. Tap the speaker to replay.' }));

    var box = U.h('div', {}, []);
    root.appendChild(box);
    U.render(root);

    var state = { i: 0, correct: 0, total: 10, done: false };
    var q = nextQuestion();
    drawQuestion();

    function nextQuestion() {
      var deck = S.shuffle(S.data.words).slice(0, state.total);
      if (state.i >= deck.length) {
        state.i = 0;
        state.total = 10;
        deck = S.shuffle(S.data.words).slice(0, state.total);
      }
      var w = deck[state.i % deck.length];
      var q2 = buildQuestion('audio', w);
      return q2;
    }

    function drawQuestion() {
      q = nextQuestion();
      state.i += 1;
      box.innerHTML = '';
      var prompt = q.prompt;
      var slot = prompt.querySelector('div:last-child');
      slot.innerHTML = '';
      var orb = U.audioButton(q.word.word, {});
      slot.appendChild(orb);
      U.speakOrb(orb, q.word.word);

      var opts = [];
      q.options.forEach(function (opt, idx) {
        var b = U.makeOption(idx, opt.label);
        b.addEventListener('click', function () { choose(idx); });
        opts.push(b);
      });
      box.appendChild(prompt);
      box.appendChild(U.h('div', { class: 'options', role: 'group', 'aria-label': 'Answer options' }, opts));
      var fb = U.h('div', { class: 'feedback', 'aria-live': 'polite' });
      box.appendChild(fb);
      box._fb = fb;

      U.registerKey(function (e) {
        if (e.key === 'Escape') { e.preventDefault(); U.back(); return; }
        if (box._locked) { return; }
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= 4) { e.preventDefault(); choose(n - 1); }
      });

      function choose(idx) {
        if (box._locked) { return; }
        box._locked = true;
        U.stopAudio();
        var correctIdx = -1, k;
        for (k = 0; k < q.options.length; k++) { if (q.options[k].correct) { correctIdx = k; } }
        var ok = idx === correctIdx;
        var optionsEl = box.querySelector('.options');
        // markOptions operates on root-level .option; reuse by passing a shim
        var optsEls = box.querySelectorAll('.option');
        for (var i = 0; i < optsEls.length; i++) {
          optsEls[i].disabled = 'disabled';
          optsEls[i].classList.add('dim');
          if (i === correctIdx) {
            optsEls[i].classList.remove('dim');
            optsEls[i].classList.add('correct');
          }
          if (i === idx && i !== correctIdx) {
            optsEls[i].classList.remove('dim');
            optsEls[i].classList.add('wrong');
          }
        }
        var st = S.state;
        var t = S.todayStr();
        if (ok) { state.correct += 1; srs.answer(st, q.word.id, true, t); }
        else { srs.answer(st, q.word.id, false, t); }
        var res = U.recordAnswer(q.word, ok, {});
        U.sound(ok ? 'ok' : 'bad');
        U.setFeedback(box, ok, ok ? '' : 'The answer is', q.word.word + ' — ' + q.word.meaningHindi);
        if (res.goalHit) { U.celebrate('Daily goal reached! 🎯'); }
        U.announce((ok ? 'Correct. ' : 'Not quite. The answer is ') + q.word.word);
        window.setTimeout(function () {
          box._locked = false;
          if (state.i >= state.total) { finish(); }
          else { drawQuestion(); }
        }, 1150);
      }
    }

    function finish() {
      U.clearKey();
      U.stopAudio();
      box.innerHTML = '';
      box.appendChild(U.summaryView(state.correct, state.total, function () { U.back(); }, function () {
        state.i = 0;
        state.correct = 0;
        drawQuestion();
      }));
    }
  }

  B850.screens.quiz = { render: renderQuiz, start: startQuiz };
  B850.screens.listen = { render: renderListen };
})();
