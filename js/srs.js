/* 850 Basic English — SM-2-lite spaced repetition (Leitner, 6 boxes).
 * Intervals by box: 0, 1, 2, 4, 8, 16 days. Box 0 = due today until first
 * correct answer. Correct: +1 box (max 5). Wrong: box 0, due today, re-queued
 * later in the same session by the review runner.
 */
(function () {
  'use strict';

  var INTERVALS = [0, 1, 2, 4, 8, 16];
  var MAX_BOX = 5;

  function card(state, id) {
    var s = state.srs;
    if (!s[id]) { s[id] = { box: 0, due: storeToday(), reps: 0, lapses: 0, last: null }; }
    return s[id];
  }

  function storeToday() {
    return B850.store.todayStr();
  }

  function isDue(state, id, today) {
    today = today || storeToday();
    var c = state.srs[id];
    if (!c) { return false; } // never seen in SRS yet — not due
    return c.due <= today;
  }

  function dueIds(state, ids, today) {
    today = today || storeToday();
    var out = [];
    if (!Array.isArray(ids)) { return out; }
    ids.forEach(function (id) {
      if (isDue(state, id, today)) { out.push(id); }
    });
    return out;
  }

  function answer(state, id, correct, today) {
    today = today || storeToday();
    var c = card(state, id);
    c.last = today;
    c.reps += 1;
    if (correct) {
      if (c.box < MAX_BOX) { c.box += 1; }
      c.due = B850.store.addDays(today, INTERVALS[c.box]);
    } else {
      c.box = 0;
      c.lapses += 1;
      c.due = today; // due again today; session runner re-queues it later
    }
    return c;
  }

  function intervalFor(box) { return INTERVALS[Math.max(0, Math.min(MAX_BOX, box))]; }

  B850.store.srs = {
    INTERVALS: INTERVALS,
    MAX_BOX: MAX_BOX,
    card: card,
    isDue: isDue,
    dueIds: dueIds,
    answer: answer,
    intervalFor: intervalFor
  };
})();
