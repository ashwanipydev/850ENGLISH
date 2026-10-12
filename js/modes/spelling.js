/* 850 Basic English — spelling puzzle: build each word from shuffled tiles. */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;
  var srs = S.srs;
  var SESSION_LEN = 10;
  var HINT_COST = 2;

  function shuffle(items) {
    var out = items.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var value = out[i];
      out[i] = out[j];
      out[j] = value;
    }
    return out;
  }

  function stageFor(word) {
    var length = Math.max.apply(Math, (word.variants || [word.base]).map(function (variant) { return variant.length; }));
    var stage = 1;
    if (word.difficulty >= 2 || length >= 4) { stage = 2; }
    if (word.difficulty >= 3 || length >= 5) { stage = 3; }
    if (length >= 6) { stage = 4; }
    return stage;
  }

  function tilePool(word, stage) {
    var counts = {};
    word.variants.forEach(function (variant) {
      var current = {};
      variant.split('').forEach(function (letter) { current[letter] = (current[letter] || 0) + 1; });
      Object.keys(current).forEach(function (letter) {
        counts[letter] = Math.max(counts[letter] || 0, current[letter]);
      });
    });
    var tiles = [];
    Object.keys(counts).forEach(function (letter) {
      for (var n = 0; n < counts[letter]; n++) { tiles.push({ id: 'tile-' + tiles.length, letter: letter }); }
    });
    if (stage >= 2) {
      var used = {};
      word.variants.forEach(function (variant) { variant.split('').forEach(function (letter) { used[letter] = true; }); });
      var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(function (letter) { return !used[letter]; });
      shuffle(alphabet).slice(0, 2 + (word.difficulty % 2)).forEach(function (letter) {
        tiles.push({ id: 'tile-' + tiles.length, letter: letter });
      });
    }
    return shuffle(tiles);
  }

  function render() {
    U.clearKey();
    U.stopAudio();
    var words = shuffle(S.data.words).slice(0, Math.min(SESSION_LEN, S.data.words.length));
    var state = {
      queue: words,
      index: 0,
      correct: 0,
      misses: {},
      queued: {},
      body: null,
      timer: null
    };
    var root = U.h('section', { class: 'screen spelling-layout', 'aria-label': 'Spelling puzzle' });
    root.appendChild(U.h('div', { class: 'q-head' }, [
      U.h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to home', onclick: function () { exit(); } }, [
        U.h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, [U.h('path', { d: 'M15 19l-7-7 7-7' })])
      ]),
      U.h('span', { class: 'q-title', text: 'Spelling' }),
      U.h('span', { class: 'q-count', id: 'spellCount', text: '' }),
      U.h('span', { class: 'spelling-timer', id: 'spellTimer', hidden: 'hidden' })
    ]));
    state.body = U.h('div', { class: 'spelling-content' });
    root.appendChild(state.body);
    U.render(root);
    drawQuestion();

    function stopTimer() {
      if (state.timer) { window.clearInterval(state.timer); state.timer = null; }
    }

    function drawQuestion() {
      stopTimer();
      var word = state.queue[state.index];
      var stage = stageFor(word);
      var variants = word.variants.filter(function (variant) { return /^[a-z]+$/.test(variant); });
      if (!variants.length) { variants = [word.base]; }
      var maxLength = Math.max.apply(Math, variants.map(function (variant) { return variant.length; }));
      var pool = tilePool({ variants: variants, difficulty: word.difficulty }, stage);
      var slots = new Array(maxLength).fill(null);
      var order = [];
      var hints = {};
      var cursor = 0;
      var locked = false;
      var seconds = 60;
      var pronunciationVisible = stage < 3;
      var exampleVisible = false;
      state.body.innerHTML = '';
      var count = root.querySelector('#spellCount');
      count.textContent = (state.index + 1) + '/' + state.queue.length;

      var timer = root.querySelector('#spellTimer');
      if (stage >= 4) {
        timer.hidden = false;
        timer.textContent = '1:00';
        state.timer = window.setInterval(function () {
          if (!root.isConnected) { stopTimer(); return; }
          seconds -= 1;
          timer.textContent = '0:' + String(Math.max(0, seconds)).padStart(2, '0');
          if (seconds <= 0) {
            stopTimer();
            timer.textContent = 'Time bonus ended';
            U.announce('Time bonus ended. Keep spelling; this round continues.');
          }
        }, 1000);
      } else {
        timer.hidden = true;
      }

      var lang = S.state.settings.langFirst || 'hindi';
      var primaryPrompt = stage >= 3 || lang === 'hindi' ? word.meaningHindi : word.meaningEnglish;
      var prompt = U.h('div', { class: 'prompt-card card spelling-prompt' }, [
        U.h('div', { class: 'spelling-category', text: word.categoryLabel || word.category || '' }),
        U.h('div', { class: 'prompt-hindi', text: primaryPrompt }),
        U.h('div', { class: 'prompt-sub', text: 'Spell the English word' }),
        U.h('div', { class: 'spelling-pron', hidden: pronunciationVisible ? null : 'hidden', text: word.pronunciation }),
        U.h('div', { class: 'spelling-gloss', hidden: 'hidden', text: word.meaningEnglish })
      ]);
      state.body.appendChild(prompt);

      var hintBar = U.h('div', { class: 'spelling-hints', role: 'group', 'aria-label': 'Hints' });
      function hintButton(key, label, action) {
        var button = U.h('button', { class: 'btn btn-secondary', type: 'button', text: label, title: 'Costs ' + HINT_COST + ' XP' });
        button.addEventListener('click', function () {
          if (hints[key] || locked) { return; }
          hints[key] = true;
          button.disabled = true;
          action();
          updateHintCost();
        });
        hintBar.appendChild(button);
      }
      hintButton('play', 'Play word', function () { S.speech.speak(word.base); });
      hintButton('first', 'First letter', function () {
        var first = variants[0][0];
        var existing = slots.findIndex(function (entry) { return entry && entry.letter === first; });
        if (existing > 0) { removeAt(existing); }
        if (slots[0] && slots[0].letter !== first) { removeAt(0); }
        if (!slots[0]) {
          var tile = pool.filter(function (item) { return item.available && item.letter === first; })[0];
          if (tile) { place(tile, 0, true); }
        }
      });
      hintButton('english', 'English meaning', function () {
        prompt.querySelector('.spelling-gloss').hidden = false;
      });
      hintButton('example', 'Example', function () {
        exampleVisible = true;
        drawHintExample();
      });
      var cost = U.h('span', { class: 'spelling-hint-cost', text: 'Each hint: ' + HINT_COST + ' XP' });
      hintBar.appendChild(cost);
      state.body.appendChild(hintBar);

      var exampleHint = U.h('div', { class: 'spelling-example-hint', hidden: 'hidden' });
      state.body.appendChild(exampleHint);

      var board = U.h('div', { class: 'spelling-board' });
      var slotWrap = U.h('div', { class: 'spelling-slots', role: 'group', 'aria-label': 'Word letters' });
      var tray = U.h('div', { class: 'spelling-tray', role: 'group', 'aria-label': 'Letter tiles' });
      var remaining = U.h('p', { class: 'spelling-count', text: '' });
      board.appendChild(slotWrap);
      board.appendChild(remaining);
      board.appendChild(tray);
      state.body.appendChild(board);
      var live = U.h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
      state.body.appendChild(live);

      pool.forEach(function (tile) {
        tile.available = true;
        tile.button = U.h('button', {
          class: 'spelling-tile', type: 'button', text: tile.letter,
          'aria-label': 'Letter ' + tile.letter,
          onclick: function () { place(tile, nextEmpty(), false); }
        });
        tray.appendChild(tile.button);
      });

      function updateHintCost() {
        var used = Object.keys(hints).length;
        cost.textContent = used ? used + ' hint' + (used === 1 ? '' : 's') + ' used, -' + (used * HINT_COST) + ' XP' : 'Each hint: ' + HINT_COST + ' XP';
      }

      function drawHintExample() {
        exampleHint.hidden = !exampleVisible;
        if (!exampleVisible) { return; }
        var pattern = new RegExp('\\b(' + variants.map(escapeRegExp).join('|') + ')\\b', 'ig');
        exampleHint.textContent = word.exampleSentence.replace(pattern, '_____');
      }

      function nextEmpty() {
        for (var i = 0; i < slots.length; i++) { if (!slots[i]) { return i; } }
        return -1;
      }

      function drawBoard(focusSlot) {
        slotWrap.innerHTML = '';
        slots.forEach(function (entry, index) {
          var slot = U.h('button', {
            class: 'spelling-slot', type: 'button', text: entry ? entry.letter : '',
            'aria-label': 'Slot ' + (index + 1) + (entry ? ': ' + entry.letter : ', empty'),
            'aria-current': cursor === index ? 'true' : 'false',
            onclick: function () { cursor = index; drawBoard(true); }
          });
          slotWrap.appendChild(slot);
        });
        var left = Math.min.apply(Math, candidateVariants().map(function (variant) { return variant.length; })) - filledCount();
        remaining.textContent = Math.max(0, left) + ' letters left';
        if (focusSlot) {
          var focus = slotWrap.children[Math.max(0, Math.min(cursor, slotWrap.children.length - 1))];
          if (focus) { focus.focus({ preventScroll: true }); }
        }
      }

      function filledCount() { return slots.filter(Boolean).length; }

      function candidateVariants() {
        return variants.filter(function (variant) {
          for (var i = 0; i < slots.length; i++) {
            if (slots[i] && (i >= variant.length || variant[i] !== slots[i].letter)) { return false; }
          }
          return true;
        });
      }

      function completedVariant() {
        return variants.filter(function (variant) {
          for (var i = 0; i < variant.length; i++) {
            if (!slots[i] || slots[i].letter !== variant[i]) { return false; }
          }
          for (var j = variant.length; j < slots.length; j++) { if (slots[j]) { return false; } }
          return true;
        })[0] || null;
      }

      function recordMiss(tile) {
        if (tile && tile.button) {
          tile.button.classList.remove('shake');
          void tile.button.offsetWidth;
          tile.button.classList.add('shake');
          window.setTimeout(function () { if (tile.button) { tile.button.classList.remove('shake'); } }, 320);
        }
        U.sound('bad');
        var attempts = (state.misses[word.id] || 0) + 1;
        state.misses[word.id] = attempts;
        live.textContent = 'That letter does not fit. Try another tile.';
        if (attempts >= 2 && !state.queued[word.id]) {
          srs.answer(S.state, word.id, false, S.todayStr());
          state.queued[word.id] = true;
          S.save(S.state);
          U.refreshChrome();
        }
      }

      function place(tile, index, fromHint) {
        if (locked || !tile || !tile.available || index < 0 || index >= slots.length) { return false; }
        var previous = slots[index];
        if (previous) { removeAt(index); }
        tile.available = false;
        if (tile.button) { tile.button.hidden = true; }
        slots[index] = { letter: tile.letter, tile: tile };
        order.push(index);
        cursor = Math.min(index + 1, slots.length - 1);
        if (!candidateVariants().length) {
          slots[index] = null;
          order.pop();
          tile.available = true;
          if (tile.button) { tile.button.hidden = false; }
          if (previous) {
            previous.tile.available = false;
            if (previous.tile.button) { previous.tile.button.hidden = true; }
            slots[index] = previous;
            order.push(index);
          }
          recordMiss(tile);
          drawBoard(false);
          return false;
        }
        drawBoard(false);
        var countLeft = Math.max(0, Math.min.apply(Math, candidateVariants().map(function (variant) { return variant.length; })) - filledCount());
        live.textContent = tile.letter.toUpperCase() + ' placed, ' + countLeft + ' letters left';
        var answer = completedVariant();
        if (answer) { solve(answer); return true; }
        if (!fromHint && tile.button) { tile.button.blur(); }
        return true;
      }

      function removeAt(index) {
        if (!slots[index]) { return; }
        var entry = slots[index];
        slots[index] = null;
        entry.tile.available = true;
        if (entry.tile.button) { entry.tile.button.hidden = false; }
        var pos = order.lastIndexOf(index);
        if (pos !== -1) { order.splice(pos, 1); }
      }

      function removeLast() {
        if (!order.length || locked) { return; }
        var index = order.pop();
        if (slots[index]) {
          slots[index].tile.available = true;
          if (slots[index].tile.button) { slots[index].tile.button.hidden = false; }
          slots[index] = null;
        }
        cursor = index;
        drawBoard(true);
        live.textContent = 'Last letter removed.';
      }

      function placeKey(letter) {
        var index = cursor;
        var tile = pool.filter(function (item) { return item.available && item.letter === letter; })[0];
        if (!tile) {
          recordMiss({ letter: letter, button: null });
          return;
        }
        place(tile, index, false);
      }

      function solve(answer) {
        if (locked) { return; }
        locked = true;
        stopTimer();
        state.correct += 1;
        var st = S.state;
        var today = S.todayStr();
        var card = srs.answer(st, word.id, true, today);
        if (state.queued[word.id]) { card.due = today; }
        S.touchDay(st);
        var base = S.xpFor(word);
        var multiplier = 1 + Math.min(0.5, Math.max(0, st.streak.count - 1) * 0.05);
        var timerBonus = stage >= 4 && seconds > 0 ? 5 : 0;
        var xp = Math.max(0, Math.round(base * multiplier) - Object.keys(hints).length * HINT_COST + timerBonus);
        var result = U.recordAnswer(word, true, { xp: xp });
        S.save(st);
        U.refreshChrome();
        U.sound('ok');
        if (result.goalHit) { U.celebrate('Daily goal reached!'); }
        state.body.innerHTML = '';
        state.body.appendChild(U.h('div', { class: 'card spelling-success' }, [
          U.h('div', { class: 'fc-word', text: word.word }),
          U.h('div', { class: 'fc-pron', text: word.pronunciation || '—' }),
          U.h('div', { class: 'fc-ex' }, [
            U.h('div', { text: word.exampleSentence || '' }),
            U.h('div', { class: 'fc-ex-hi', text: word.exampleHindi || '' })
          ]),
          U.h('div', { class: 'spelling-score', text: '+' + xp + ' XP' + (timerBonus ? ' - includes time bonus' : '') }),
          U.h('button', { class: 'btn btn-lg btn-block', type: 'button', text: state.index + 1 < state.queue.length ? 'Next word' : 'Finish session', onclick: next })
        ]));
        U.announce('Correct. ' + answer + '. ' + word.pronunciation + '. ' + xp + ' XP.');
      }

      function keyHandler(event) {
        if (event.key === 'Escape') { event.preventDefault(); finish(); return; }
        if (locked) { return; }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          cursor = Math.max(0, Math.min(slots.length - 1, cursor + (event.key === 'ArrowLeft' ? -1 : 1)));
          drawBoard(true);
        } else if (event.key === 'Backspace') {
          event.preventDefault();
          removeLast();
        } else if (/^[a-z]$/i.test(event.key)) {
          event.preventDefault();
          placeKey(event.key.toLowerCase());
        }
      }

      drawBoard(false);
      drawHintExample();
      U.registerKey(keyHandler);
    }

    function next() {
      state.index += 1;
      if (state.index >= state.queue.length) { finish(); } else { drawQuestion(); }
    }

    function exit() {
      stopTimer();
      U.clearKey();
      U.stopAudio();
      U.back();
    }

    function finish() {
      stopTimer();
      U.clearKey();
      U.stopAudio();
      state.body.innerHTML = '';
      state.body.appendChild(U.summaryView(state.correct, state.queue.length, function () { U.back(); }, function () {
        render();
      }));
    }
  }

  function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  B850.screens.spelling = { render: render };
})();