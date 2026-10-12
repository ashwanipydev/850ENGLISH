/* 850 Basic English — Typing drill.
 * Given the Hindi meaning, type the English word. Case-insensitive, trimmed,
 * tolerant of "/" variant spellings (both spellings accepted), diff-style
 * correction on failure. Ambiguous Hindi meanings (same gloss for two words)
 * accept either answer.
 */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;
  var srs = S.srs;
  var SESSION_LEN = 10;

  function render() {
    U.clearKey();
    var root = U.h('section', { class: 'screen', 'aria-label': 'Typing drill' });
    root.appendChild(U.h('div', { class: 'q-head' }, [
      U.h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to home', onclick: function () { U.back(); } }, [
        U.h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [U.h('path', { d: 'M15 19l-7-7 7-7' })])
      ]),
      U.h('span', { class: 'q-title', text: 'Typing' }),
      U.h('span', { class: 'q-count', id: 'typeCount', text: '' })
    ]));
    root.appendChild(U.h('p', { class: 'screen-sub', text: 'Read the Hindi meaning, type the English word, press Enter.' }));

    var state = { i: 0, correct: 0, total: SESSION_LEN, root: root };
    var body = U.h('div', {}, []);
    root.appendChild(body);
    U.render(root);
    drawQuestion();

    function wordFor(idx) {
      return S.data.words[idx % S.data.words.length];
    }

    function acceptedAnswers(w) {
      var set = [w.base];
      w.variants.forEach(function (v) { if (set.indexOf(v) === -1) { set.push(v); } });
      // words that share this exact Hindi gloss are also acceptable
      var group = S.data.groupsByHindi[w.meaningHindi] || [];
      group.forEach(function (id) {
        var other = S.data.byId[id];
        if (!other) { return; }
        other.variants.forEach(function (v) { if (set.indexOf(v) === -1) { set.push(v); } });
        if (set.indexOf(other.base) === -1) { set.push(other.base); }
      });
      return set;
    }

    function drawQuestion() {
      var w = S.data.words[state.i % S.data.words.length];
      body.innerHTML = '';
      var countEl = root.querySelector('#typeCount');
      if (countEl) { countEl.textContent = Math.min(state.i + 1, state.total) + '/' + state.total; }

      var prompt = U.h('div', { class: 'prompt-card card' }, [
        U.h('div', { class: 'prompt-hindi', text: w.meaningHindi }),
        U.h('div', { class: 'prompt-sub', text: 'Type the English word' }),
        U.h('div', { class: 'fc-ex', style: 'text-align:left;margin-top:10px' }, [
          U.h('div', { text: w.exampleSentence }),
          U.h('div', { class: 'fc-ex-hi', text: w.exampleHindi })
        ])
      ]);
      body.appendChild(prompt);

      var input = U.h('input', {
        class: 'type-input',
        type: 'text',
        'aria-label': 'Type the English word for ' + w.meaningHindi,
        autocapitalize: 'off',
        autocomplete: 'off',
        autocorrect: 'off',
        spellcheck: 'false',
        enterkeyhint: 'go'
      });
      var goBtn = U.h('button', { class: 'btn', type: 'button', text: 'Check', disabled: 'disabled' });
      var row = U.h('div', { class: 'type-row' }, [input, goBtn]);
      body.appendChild(row);
      var diffEl = U.h('div', { class: 'diff', 'aria-live': 'polite' });
      body.appendChild(diffEl);

      var answered = false;
      function check() {
        if (answered) { return; }
        var val = String(input.value || '').trim().toLowerCase();
        if (!val) { return; }
        answered = true;
        U.stopAudio();
        var ok = acceptedAnswers(w).indexOf(val) !== -1;
        var st = S.state;
        var t = S.todayStr();
        if (ok) {
          state.correct += 1;
          input.classList.add('good');
          srs.answer(st, w.id, true, t);
          U.sound('ok');
          diffEl.innerHTML = '';
          diffEl.appendChild(U.h('span', { class: 'd-ok', text: w.word + ' ✓' }));
        } else {
          input.classList.add('bad');
          srs.answer(st, w.id, false, t);
          U.sound('bad');
          diffEl.innerHTML = '';
          diffEl.appendChild(U.h('span', { class: 'd-bad', text: val }));
          diffEl.appendChild(U.h('span', { text: '  →  ' }));
          diffEl.appendChild(U.h('span', { class: 'd-ok', text: w.word }));
        }
        var res = U.recordAnswer(w, ok, {});
        if (res.goalHit) { U.celebrate('Daily goal reached! 🎯'); }
        U.announce((ok ? 'Correct. ' : 'Not quite. The word is ') + w.word + ' — ' + w.meaningHindi);
        input.blur();
        window.setTimeout(next, 1100);
      }

      function next() {
        state.i += 1;
        if (state.i >= state.total) { finish(); } else { drawQuestion(); }
      }

      input.addEventListener('input', U.debounce(function () {
        goBtn.disabled = input.value.trim() ? null : 'disabled';
      }, 60));
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); check(); }
      });
      goBtn.addEventListener('click', check);

      U.registerKey(function (e) {
        if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
        if (document.activeElement === input) { return; }
        if (e.key === 'Enter' && !answered && input.value.trim()) { check(); }
      });

      window.setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
    }

    function finish() {
      U.clearKey();
      U.stopAudio();
      body.innerHTML = '';
      body.appendChild(U.summaryView(state.correct, state.total, function () { U.back(); }, function () {
        state.i = 0;
        state.correct = 0;
        drawQuestion();
      }));
    }
  }

  B850.screens.typing = { render: render };
})();
