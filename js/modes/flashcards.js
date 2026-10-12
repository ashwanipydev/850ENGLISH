/* 850 Basic English — Learn (flashcards) with a mode picker.
 * Flashcards: front = English word + pronunciation; back = Hindi meaning,
 * English meaning, both example sentences. Again / Know it buttons plus
 * left/right swipe. "Know it" seeds the SRS schedule.
 */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;
  var srs = S.srs;

  function buildDeck(catFilter) {
    var ids;
    if (catFilter) {
      ids = S.data.byCategory[catFilter] || [];
    } else {
      // unseen-first order, stable shuffle
      ids = S.data.words.map(function (w) { return w.id; });
    }
    var st = S.state;
    var unseen = ids.filter(function (id) { return !st.seen[id]; });
    var seen = ids.filter(function (id) { return st.seen[id]; });
    return S.shuffle(unseen).concat(S.shuffle(seen));
  }

  function startFlashcards(params) {
    params = params || {};
    var deck = buildDeck(params.category);
    if (!deck.length) {
      U.toast('No words in this selection.');
      return;
    }
    var state = {
      deck: deck,
      i: 0,
      known: 0,
      again: 0,
      seenMarks: [],
      flipped: false,
      locked: false,
      root: null,
      dragX: null
    };
    state.root = U.h('section', { class: 'screen', 'aria-label': 'Flashcards' });
    renderCard();
    U.render(state.root);
    U.registerKey(onKey);

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); U.back(); return; }
      if (state.locked) { return; }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        grade(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        grade(true);
      }
    }

    function flip() {
      if (state.locked) { return; }
      state.flipped = !state.flipped;
      var card = state.root.querySelector('.fc-card');
      if (card) { card.classList.toggle('flipped', state.flipped); }
      var w = S.data.byId[state.deck[state.i]];
      if (state.flipped && w) {
        markSeen(w);
        U.announce(w.meaningHindi + '. ' + w.meaningEnglish);
      }
      focusButtons();
    }

    function markSeen(w) {
      var st = S.state;
      if (!st.seen[w.id]) {
        st.seen[w.id] = 1;
        S.save(st);
        U.refreshChrome();
      }
    }

    function grade(knew) {
      if (state.locked) { return; }
      state.locked = true;
      var w = S.data.byId[state.deck[state.i]];
      var st = S.state;
      var t = S.todayStr();
      if (knew) {
        state.known += 1;
        st.learned[w.id] = 1;
        // Seed spaced repetition: first success puts the card in box 1 (due tomorrow).
        var c = srs.card(st, w.id);
        if (c.reps === 0 && c.box === 0) {
          c.box = 1;
          c.due = S.addDays(t, 1);
          c.last = t;
          c.reps = 1;
        }
        U.sound('ok');
      } else {
        state.again += 1;
        srs.answer(st, w.id, false, t);
        U.sound('bad');
      }
      S.save(st);
      U.refreshChrome();
      state.seenMarks[state.i] = knew ? 'known' : 'again';
      var card = state.root.querySelector('.fc-card');
      if (card) {
        card.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
        card.style.transform = (knew ? 'translateX(48px) rotate(4deg)' : 'translateX(-48px) rotate(-4deg)');
        card.style.opacity = '0';
      }
      U.announce((knew ? 'Marked as known. ' : 'Marked again. ') + (state.i + 1) + ' of ' + state.deck.length);
      window.setTimeout(next, 240);
    }

    function next() {
      state.i += 1;
      state.flipped = false;
      state.locked = false;
      if (state.i >= state.deck.length) {
        finish();
        return;
      }
      renderCard();
      focusButtons();
    }

    function finish() {
      U.clearKey();
      var root = U.h('section', { class: 'screen' }, [
        U.h('div', { class: 'card session-summary' }, [
          U.h('div', { class: 'big-score', text: state.known + '/' + state.deck.length }),
          U.h('p', { class: 'screen-sub', style: 'margin:0', text: state.known + ' known · ' + state.again + ' again' }),
          U.h('p', { class: 'screen-sub', style: 'margin:6px 0 0', text: 'Cards marked "known" move to tomorrow\u2019s review queue.' })
        ]),
        U.h('div', { class: 'fc-actions' }, [
          U.h('button', { class: 'btn btn-secondary btn-lg', type: 'button', text: 'Go home', onclick: function () { U.back(); } }),
          U.h('button', { class: 'btn btn-lg', type: 'button', text: 'Again set', onclick: function () {
            var againIds = [];
            state.seenMarks.forEach(function (m, idx) { if (m === 'again') { againIds.push(state.deck[idx]); } });
            if (againIds.length) {
              state.deck = againIds;
              state.i = 0; state.known = 0; state.again = 0; state.seenMarks = [];
              state.flipped = false; state.locked = false;
              state.root = U.h('section', { class: 'screen', 'aria-label': 'Flashcards again set' });
              renderCard();
              U.render(state.root);
              U.registerKey(onKey);
            }
          } })
        ])
      ]);
      U.render(root);
    }

    function renderCard() {
      var w = S.data.byId[state.deck[state.i]];
      var dots = state.deck.map(function (id, idx) {
        var cls = idx === state.i ? 'now' : (state.seenMarks[idx] === 'known' ? 'seen' : (state.seenMarks[idx] === 'again' ? 'missed' : ''));
        return U.h('i', { class: cls });
      });

      var word = w.word;
      var front = U.h('div', { class: 'fc-face fc-front' }, [
        U.h('div', { class: 'fc-meta' }, [
          U.h('span', { class: 'pill', text: w.categoryLabel }),
          U.h('span', { class: 'pill', text: 'level ' + w.difficulty })
        ]),
        U.h('div', { class: 'fc-word', text: word }),
        U.h('div', { class: 'fc-pron', text: w.pronunciation || '—' }),
        U.h('div', { class: 'fc-hint', text: 'Tap to reveal · swipe ← again · right know' })
      ]);

      var back = U.h('div', { class: 'fc-face fc-back' }, [
        U.h('div', { class: 'fc-meaning-hi', text: w.meaningHindi }),
        U.h('div', { class: 'fc-meaning-en', text: w.meaningEnglish }),
        U.h('div', { class: 'fc-ex' }, [
          U.h('div', { class: 'fc-ex-en' }),
          U.h('div', { class: 'fc-ex-hi', text: w.exampleHindi })
        ])
      ]);
      // highlight the target word in the example (safe HTML build)
      (function () {
        var box = back.querySelector('.fc-ex-en');
        var re = new RegExp('\\b' + escapeReg(w.base) + '\\b', 'i');
        if (re.test(w.exampleSentence)) {
          box.innerHTML = w.exampleSentence.replace(re, function (m) { return '<b>' + m + '</b>'; });
        } else {
          box.textContent = w.exampleSentence;
        }
      })();

      var card = U.h('div', { class: 'fc-card', role: 'button', tabindex: '0', 'aria-pressed': 'false', 'aria-label': 'Flashcard. Press Enter or Space to flip, Arrow Left for again, Arrow Right for known.' }, [front, back]);
      card.addEventListener('click', function (e) {
        if (e.target.closest('.btn')) { return; }
        flip();
        card.setAttribute('aria-pressed', String(state.flipped));
      });

      // swipe
      (function () {
        var startX = null, dx = 0, dragging = false;
        card.addEventListener('pointerdown', function (e) {
          if (state.locked) { return; }
          startX = e.clientX;
          dx = 0;
          dragging = true;
          try { card.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        });
        card.addEventListener('pointermove', function (e) {
          if (!dragging || state.locked) { return; }
          dx = e.clientX - startX;
          if (Math.abs(dx) > 8) {
            card.style.transition = 'none';
            card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 24) + 'deg)';
            card.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 320));
          }
        });
        function endDrag() {
          if (!dragging) { return; }
          dragging = false;
          card.style.transition = '';
          if (Math.abs(dx) > 96) {
            grade(dx > 0);
          } else {
            card.style.transform = '';
            card.style.opacity = '';
          }
          dx = 0;
        }
        card.addEventListener('pointerup', endDrag);
        card.addEventListener('pointercancel', endDrag);
      })();

      var againBtn = U.h('button', {
        class: 'btn btn-bad', type: 'button',
        'aria-label': 'Again — I do not know this word yet',
        onclick: function () { grade(false); }
      }, [U.h('span', { 'aria-hidden': 'true', text: '←' }), ' Again']);
      var knowBtn = U.h('button', {
        class: 'btn btn-good', type: 'button',
        'aria-label': 'Know it — I know this word',
        onclick: function () { grade(true); }
      }, [' Know it', U.h('span', { 'aria-hidden': 'true', text: '→' })]);

      state.root.innerHTML = '';
      state.root.appendChild(U.h('div', { class: 'q-head' }, [
        U.h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to home', onclick: function () { U.back(); } }, [
          U.h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [U.h('path', { d: 'M15 19l-7-7 7-7' })])
        ]),
        U.h('span', { class: 'q-title', text: 'Flashcards' }),
        U.h('span', { class: 'q-count', text: (state.i + 1) + '/' + state.deck.length })
      ]));
      state.root.appendChild(U.h('div', { class: 'fc-stage' }, [card]));
      state.root.appendChild(U.h('div', { class: 'fc-actions' }, [againBtn, knowBtn]));
      state.root.appendChild(U.h('div', { class: 'fc-dots', 'aria-hidden': 'true' }, dots));
      state.root.appendChild(U.h('div', { class: 'fc-swipe-hint', 'aria-hidden': 'true' }, [
        U.h('span', { text: '← swipe: again' }),
        U.h('span', { text: 'swipe: know it →' })
      ]));
      state._againBtn = againBtn;
      state._knowBtn = knowBtn;
    }

    function focusButtons() {
      if (state.flipped && state._knowBtn) { state._knowBtn.focus(); }
    }
  }

  function escapeReg(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ---------- mode picker ---------- */

  function renderLearn(params) {
    params = params || {};
    // Continue CTA: if a category was last active, jump straight into the session
    if (params.category) { startFlashcards(params); return; }
    U.clearKey();
    var root = U.h('section', { class: 'screen', 'aria-label': 'Learn menu' });
    root.appendChild(U.h('h1', { class: 'screen-title', text: 'Learn' }));
    root.appendChild(U.h('p', { class: 'screen-sub', text: 'Study the 850 words as flashcards, with pronunciation in Devanagari and IPA.' }));

    var catCard = U.h('div', { class: 'card' });
    var chipHost = U.h('div', { class: 'row wrap', style: 'gap:8px' });
    var allChip = U.h('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', text: 'All 850' });
    chipHost.appendChild(allChip);
    var selected = null;
    S.CATEGORIES.forEach(function (c) {
      var n = (S.data.byCategory[c.id] || []).length;
      var chip = U.h('button', {
        class: 'chip', type: 'button', 'aria-pressed': 'false',
        'aria-label': c.label + ', ' + n + ' words'
      }, [U.h('span', { text: c.emoji + ' ' + c.label.split('—')[0].trim() }), U.h('span', { class: 'chip-pct', text: String(n) })]);
      chip.addEventListener('click', function () {
        if (selected === c.id) {
          selected = null;
          chip.setAttribute('aria-pressed', 'false');
          allChip.setAttribute('aria-pressed', 'true');
        } else {
          selected = c.id;
          chip.setAttribute('aria-pressed', 'true');
          allChip.setAttribute('aria-pressed', 'false');
        }
      });
      chipHost.appendChild(chip);
    });
    catCard.appendChild(chipHost);
    catCard.appendChild(U.h('p', { class: 'screen-sub', style: 'margin:10px 0 0;font-size:13px', text: 'Unseen words come first. "Know it" adds the card to spaced review.' }));
    root.appendChild(catCard);

    root.appendChild(U.h('div', { style: 'margin-top:14px' }, [
      U.h('button', {
        class: 'btn btn-lg', type: 'button',
        'aria-label': 'Start flashcards',
        onclick: function () {
          var st = S.state;
          st.lastMode = { mode: 'learn', params: { category: selected } };
          S.save(st);
          startFlashcards({ category: selected });
        }
      }, ['▶ Start flashcards'])
    ]));

    U.render(root);
  }

  B850.screens.learn = { render: renderLearn };
})();
