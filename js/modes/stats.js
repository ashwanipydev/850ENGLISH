/* 850 Basic English — Stats: per-category mastery, accuracy over time,
 * words due, longest streak, and a confirm-guarded "Reset progress".
 */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;
  var srs = S.srs;

  function longestStreak(state) {
    var best = 0, run = 0;
    var dates = Object.keys(state.sessions).sort();
    var prev = null;
    dates.forEach(function (d) {
      run = (prev && S.diffDays(d, prev) === 1) ? run + 1 : 1;
      if (run > best) { best = run; }
      prev = d;
    });
    return Math.max(best, state.streak.count);
  }

  function render() {
    U.clearKey();
    var st = S.state;
    S.touchDay(st);
    var t = S.todayStr();
    var total = S.data.total;
    var learned = Object.keys(st.learned).length;
    var seen = Object.keys(st.seen).length;
    var due = U.dueCount();
    var lvl = S.levelProgress(st.xp);
    var accAll = st.answers.total ? Math.round((st.answers.correct / st.answers.total) * 100) : 0;

    var root = U.h('section', { class: 'screen', 'aria-label': 'Statistics' });
    root.appendChild(U.h('h1', { class: 'screen-title', text: 'Stats' }));

    // headline numbers
    root.appendChild(U.h('div', { class: 'stat-list', style: 'margin-top:10px' }, [
      U.h('div', { class: 'stat-item' }, [
        U.h('div', {}, [U.h('div', { class: 'stat-label', text: 'Words known' }), U.h('div', { class: 'stat-sub', text: 'at least one correct answer' })]),
        U.h('div', { class: 'stat-value', text: learned + ' / ' + total })
      ]),
      U.h('div', { class: 'stat-item' }, [
        U.h('div', {}, [U.h('div', { class: 'stat-label', text: 'Words seen' }), U.h('div', { class: 'stat-sub', text: 'flashed or answered' })]),
        U.h('div', { class: 'stat-value', text: seen + ' / ' + total })
      ]),
      U.h('div', { class: 'stat-item' }, [
        U.h('div', {}, [U.h('div', { class: 'stat-label', text: 'Overall accuracy' }), U.h('div', { class: 'stat-sub', text: st.answers.correct + ' of ' + st.answers.total + ' answers' })]),
        U.h('div', { class: 'stat-value', text: accAll + '%' })
      ]),
      U.h('div', { class: 'stat-item' }, [
        U.h('div', {}, [U.h('div', { class: 'stat-label', text: 'Words due today' }), U.h('div', { class: 'stat-sub', text: due ? 'waiting in Review' : 'all caught up' })]),
        U.h('div', { class: 'stat-value', text: String(due) })
      ]),
      U.h('div', { class: 'stat-item' }, [
        U.h('div', {}, [U.h('div', { class: 'stat-label', text: 'Longest streak' }), U.h('div', { class: 'stat-sub', text: 'best: ' + longestStreak(st) + ' days' })]),
        U.h('div', { class: 'stat-value', text: st.streak.count ? '🔥 ' + st.streak.count + 'd' : '—' })
      ]),
      U.h('div', { class: 'stat-item' }, [
        U.h('div', {}, [U.h('div', { class: 'stat-label', text: 'Level & XP' }), U.h('div', { class: 'stat-sub', text: Math.round(lvl.pct * 100) + '% to next level' })]),
        U.h('div', { class: 'stat-value', text: 'Lv ' + lvl.level + ' · ' + st.xp })
      ])
    ]));

    // per-category mastery
    root.appendChild(U.h('h2', { class: 'section-title', text: 'Mastery by category' }));
    var catCard = U.h('div', { class: 'card' });
    S.CATEGORIES.forEach(function (c) {
      var ids = S.data.byCategory[c.id] || [];
      var learnedC = 0;
      ids.forEach(function (id) { if (st.learned[id]) { learnedC += 1; } });
      var pct = ids.length ? Math.round((learnedC / ids.length) * 100) : 0;
      catCard.appendChild(U.h('div', { class: 'cat-row' }, [
        U.h('div', {}, [
          U.h('div', { class: 'cat-name', text: c.emoji + ' ' + c.label }),
          U.h('div', { class: 'cat-count', text: learnedC + ' known of ' + ids.length })
        ]),
        U.h('div', { class: 'row', style: 'align-items:center;gap:8px' }, [
          U.h('div', { class: 'progress-bar', style: 'width:90px', 'aria-hidden': 'true' }, [U.h('i', { style: 'width:' + pct + '%' })]),
          U.h('span', { class: 'cat-pct', text: pct + '%' })
        ])
      ]));
    });
    root.appendChild(catCard);

    // accuracy over the last 14 days
    root.appendChild(U.h('h2', { class: 'section-title', text: 'Accuracy — last 14 days' }));
    var accCard = U.h('div', { class: 'card' });
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = S.addDays(t, -i);
      var a = st.accuracy[d];
      days.push({ date: d, pct: a && a.answered ? Math.round((a.correct / a.answered) * 100) : null, answered: a ? a.answered : 0 });
    }
    accCard.appendChild(sparkline(days));
    accCard.appendChild(U.h('p', { class: 'screen-sub', style: 'margin:8px 0 0;font-size:13px', text: 'Dots mark days with no answers. Daily goal today: ' + st.daily.count + ' / ' + st.settings.goal + '.' }));
    root.appendChild(accCard);

    // reset
    root.appendChild(U.h('h2', { class: 'section-title', text: 'Danger zone' }));
    root.appendChild(U.h('div', { style: 'margin-top:10px' }, [
      U.h('button', {
        class: 'btn btn-bad btn-lg', type: 'button',
        'aria-label': 'Reset all progress',
        onclick: function () {
          U.confirmSheet(
            'Reset all progress?',
            'This deletes your XP, streak, learned words, the spaced-repetition schedule and daily stats on this device. The 850 word list itself is not changed. This cannot be undone.',
            'Yes, reset everything',
            function () {
              S.state = S.reset();
              S.save(S.state);
              U.refreshChrome();
              render();
            }
          );
        }
      }, ['🗑  Reset progress'])
    ]));

    U.render(root);
  }

  function sparkline(days) {
    var w = 320, hgt = 72, pad = 6;
    var pts = [], dots = [];
    days.forEach(function (d, i) {
      var x = pad + (i * (w - pad * 2)) / (days.length - 1);
      if (d.pct !== null) {
        var y = hgt - pad - (d.pct / 100) * (hgt - pad * 2);
        pts.push(x.toFixed(1) + ',' + y.toFixed(1));
      } else {
        dots.push(U.h('circle', { cx: x.toFixed(1), cy: (hgt - pad).toFixed(1), r: 1.6, fill: 'var(--text-2)', 'aria-hidden': 'true' }));
      }
    });
    var svg = U.h('div', { class: 'spark-wrap' });
    var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt);
    el.setAttribute('class', 'spark');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Accuracy over the last 14 days');
    el.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'line'));
    var base = el.firstChild;
    base.setAttribute('class', 'spark-baseline');
    base.setAttribute('x1', pad); base.setAttribute('y1', hgt - pad);
    base.setAttribute('x2', w - pad); base.setAttribute('y2', hgt - pad);
    if (pts.length) {
      var pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('points', pts.join(' '));
      el.appendChild(pl);
    }
    dots.forEach(function (d) { el.appendChild(d); });
    svg.appendChild(el);
    return svg;
  }

  B850.screens.stats = { render: render };
})();
