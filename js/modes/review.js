/* 850 Basic English — Review (spaced repetition).
 * Only cards due today appear. Correct: up one box (max 6, intervals
 * 0/1/2/4/8/16 days). Wrong: box 0, re-queued later in the same session
 * (after at least 3 other cards, when available).
 */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;
  var srs = S.srs;

  function render() {
    U.clearKey();
    var st = S.state;
    var t = S.todayStr();

    var due = srs.dueIds(st, S.data.words.map(function (w) { return w.id; }), t)
      .map(function (id) { return S.data.byId[id]; })
      .filter(Boolean);
    due.sort(function (a, b) {
      var ca = st.srs[a.id], cb = st.srs[b.id];
      var ba = ca ? ca.box : 0, bb = cb ? cb.box : 0;
      if (ba !== bb) { return ba - bb; }
      return a.sourceOrder - b.sourceOrder;
    });

    var root = U.h('section', { class: 'screen', 'aria-label': 'Review' });

    if (!due.length) {
      root.appendChild(U.h('h1', { class: 'screen-title', text: 'Review' }));
      root.appendChild(U.h('div', { class: 'card session-summary' }, [
        U.h('div', { style: 'font-size:44px', text: '🌤️', 'aria-hidden': 'true' }),
        U.h('p', { class: 'screen-sub', style: 'margin:8px 0 0', text: 'Nothing due today. Cards return here as their spaced-repetition intervals come due — mark words "Know it" in flashcards to schedule them.' })
      ]));
      root.appendChild(U.h('div', { style: 'margin-top:14px' }, [
        U.h('button', { class: 'btn btn-lg', type: 'button', text: 'Go home', onclick: function () { U.back(); } })
      ]));
      U.render(root);
      return;
    }

    root.appendChild(U.h('div', { class: 'q-head' }, [
      U.h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'End review and go home', onclick: function () { U.back(); } }, [
        U.h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [U.h('path', { d: 'M15 19l-7-7 7-7' })])
      ]),
      U.h('span', { class: 'q-title', text: 'Review' }),
      U.h('span', { class: 'q-count', text: due.length + ' due' })
    ]));

    var state = {
      queue: due,
      i: 0,
      correct: 0,
      done: 0,
      flipped: false,
      locked: false,
      body: null
    };
    state.body = U.h('div', {}, []);
    root.appendChild(state.body);
    U.render(root);
    drawQuestion();

    function cardMeta(w) {
      var c = st.srs[w.id] || { box: 0, due: t };
      var dots = [];
      for (var i = 0; i <= srs.MAX_BOX; i++) {
        dots.push(U.h('i', {
          class: (i < c.box ? 'on ' : '') + (i === c.box ? 'here' : ''),
          'aria-hidden': 'true'
        }));
      }
      return { box: c.box, dots: dots, next: srs.intervalFor(c.box + 1) };
    }

    function drawQuestion() {
      var w = state.queue[state.i];
      state.flipped = false;
      state.locked = false;
      state.body.innerHTML = '';
      var meta = cardMeta(w);

      var front = U.h('div', { class: 'fc-face fc-front' }, [
        U.h('div', { class: 'fc-word', text: w.word }),
        U.h('div', { class: 'fc-pron', text: w.pronunciation || '—' }),
        U.h('div', { class: 'fc-hint', text: 'Tap to reveal the meaning' })
      ]);
      var back = U.h('div', { class: 'fc-face fc-back' }, [
        U.h('div', { class: 'fc-meaning-hi', text: w.meaningHindi }),
        U.h('div', { class: 'fc-meaning-en', text: w.meaningEnglish }),
        U.h('div', { class: 'fc-ex' }, [
          U.h('div', { text: w.exampleSentence }),
          U.h('div', { class: 'fc-ex-hi', text: w.exampleHindi })
        ])
      ]);
      var card = U.h('div', {
        class: 'fc-card', role: 'button', tabindex: '0',
        'aria-label': 'Review card. Press Enter to reveal.'
      }, [front, back]);
      card.addEventListener('click', function (e) {
        if (e.target.closest('.btn')) { return; }
        flip();
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
      });

      var wrongBtn = U.h('button', {
        class: 'btn btn-bad btn-lg btn-block', type: 'button', hidden: 'hidden',
        'aria-label': 'Wrong — I forgot this card',
        onclick: function () { answer(false); }
      }, ['✕  Wrong — put it back']);
      var rightBtn = U.h('button', {
        class: 'btn btn-good btn-lg btn-block', type: 'button', hidden: 'hidden',
        'aria-label': 'Right — I knew this card',
        onclick: function () { answer(true); }
      }, ['✓  Right — knew it']);

      state.body.appendChild(U.h('div', { class: 'review-meta' }, [
        U.h('span', { class: 'box-dots', 'aria-label': 'Box ' + (meta.box + 1) + ' of 6' }, meta.dots),
        U.h('span', { text: 'Box ' + (meta.box + 1) + ' of 6' + (meta.box < srs.MAX_BOX ? ' · next in ' + meta.next + ' day' + (meta.next === 1 ? '' : 's') : ' · mastered') })
      ]));
      state.body.appendChild(U.h('div', { class: 'fc-stage' }, [card]));
      state.body.appendChild(wrongBtn);
      state.body.appendChild(rightBtn);

      U.registerKey(function (e) {
        if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
        if (!state.flipped) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
        } else if (!state.locked) {
          if (e.key === 'ArrowLeft') { e.preventDefault(); answer(false); }
          if (e.key === 'ArrowRight') { e.preventDefault(); answer(true); }
        }
      });
    }

    function flip() {
      if (state.flipped) { return; }
      state.flipped = true;
      state.body.querySelector('.fc-card').classList.add('flipped');
      state.body.querySelector('.btn-bad').removeAttribute('hidden');
      state.body.querySelector('.btn-good').removeAttribute('hidden');
      state.body.querySelector('.btn-good').focus();
    }

    function answer(ok) {
      if (state.locked) { return; }
      state.locked = true;
      var w = state.queue[state.i];
      if (ok) {
        state.correct += 1;
        srs.answer(st, w.id, true, t);
        U.sound('ok');
        U.announce('Correct. ' + w.word + ' moved to box ' + (srs.card(st, w.id).box + 1));
      } else {
        srs.answer(st, w.id, false, t);
        U.sound('bad');
        U.announce('Re-queued. ' + w.word + ' will come back later in this session.');
        // Re-queue later: after ≥ 3 other cards when possible.
        if (state.queue.length - state.i > 3) {
          state.queue.splice(state.queue.length - 3, 0, w);
        } else {
          state.queue.push(w);
        }
      }
      S.save(st);
      U.refreshChrome();
      state.done += 1;
      window.setTimeout(function () {
        state.i += 1;
        if (state.i >= state.queue.length) { finish(); } else { drawQuestion(); }
      }, ok ? 220 : 620);
    }

    function finish() {
      U.clearKey();
      state.body.innerHTML = '';
      var remaining = srs.dueIds(st, S.data.words.map(function (w) { return w.id; }), t).length;
      state.body.appendChild(U.summaryView(state.correct, state.done, function () { U.back(); }, function () {
        // one more pass: anything still due (shouldn't be many) — refresh list
        U.navigate('review');
      }));
      if (remaining > 0) {
        state.body.querySelector('.session-summary').appendChild(
          U.h('p', { class: 'screen-sub', text: remaining + ' card' + (remaining === 1 ? '' : 's') + ' still due — "One more round" continues them.' })
        );
      } else {
        state.body.querySelector('.session-summary').appendChild(
          U.h('p', { class: 'screen-sub', text: 'All caught up for today. 🎉' })
        );
      }
    }
  }

  B850.screens.review = { render: render };
})();
