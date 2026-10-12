/* 850 Basic English — Home screen. */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;

  var MODES = [
    { id: 'learn', name: 'Learn', emoji: '🃏', desc: 'Flashcards, tap to flip' },
    { id: 'quiz', name: 'Quiz', emoji: '❓', desc: '4-choice questions' },
    { id: 'listen', name: 'Listening', emoji: '🔊', desc: 'Hear it, pick it' },
    { id: 'typing', name: 'Typing', emoji: '⌨️', desc: 'Type the English word' },
    { id: 'review', name: 'Review', emoji: '🔁', desc: 'Spaced repetition' },
    { id: 'stats', name: 'Stats', emoji: '📊', desc: 'Progress & mastery' }
  ];

  function categoryRow(cat) {
    var ids = S.data.byCategory[cat.id] || [];
    var learned = 0, seen = 0;
    var st = S.state;
    ids.forEach(function (id) {
      if (st.learned[id]) { learned += 1; }
      if (st.seen[id]) { seen += 1; }
    });
    var pct = ids.length ? Math.round((learned / ids.length) * 100) : 0;
    var bar = U.h('div', { class: 'progress-bar', 'aria-hidden': 'true' }, [U.h('i', { style: 'width:' + pct + '%' })]);
    return U.h('div', { class: 'cat-row' }, [
      U.h('div', {}, [
        U.h('div', { class: 'cat-name', text: cat.emoji + ' ' + cat.label }),
        U.h('div', { class: 'cat-count', text: seen + '/' + ids.length + ' seen · ' + learned + ' known' })
      ]),
      U.h('div', { class: 'cat-pct' }, [bar, U.h('span', { style: 'font-size:14px;color:var(--text-2)', text: pct + '%' })])
    ]);
  }

  function render() {
    var st = S.state;
    S.touchDay(st);
    S.save(st);
    U.refreshChrome();
    U.clearKey();

    var total = S.data.total;
    var learnedCount = Object.keys(st.learned).length;
    var seenCount = Object.keys(st.seen).length;
    var goal = st.settings.goal;
    var goalPct = Math.min(1, st.daily.count / goal);
    var lvl = S.levelProgress(st.xp);
    var due = U.dueCount();
    var st_ = st.streak.count;

    var root = U.h('section', { class: 'screen', 'aria-label': 'Home' });

    // hero: daily goal ring + streak + overall
    var hero = U.h('div', { class: 'card hero' }, [
      U.h('div', { class: 'hero-rings' }, [
        U.ring(goalPct, 72, 7, st.daily.count + '/' + goal, 'today'),
        U.ring(learnedCount / total, 72, 7, Math.round((learnedCount / total) * 100) + '%', 'of 850')
      ]),
      U.h('div', { class: 'hero-stats' }, [
        U.h('div', { class: 'big', text: st_ > 0 ? '🔥 ' + st_ + ' day' + (st_ === 1 ? '' : 's') : 'Start your streak' }),
        U.h('div', { class: 'small', text: 'Level ' + lvl.level + ' · ' + st.xp + ' XP' }),
        U.h('div', { class: 'progress-bar', style: 'margin-top:8px;width:140px', role: 'progressbar', 'aria-label': 'Level progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(lvl.pct * 100)) }, [U.h('i', { style: 'width:' + Math.round(lvl.pct * 100) + '%' })]),
        U.h('div', { class: 'small', style: 'margin-top:6px', text: learnedCount + ' words known · ' + due + ' due for review' })
      ])
    ]);
    root.appendChild(hero);

    // continue CTA
    var lastMode = st.lastMode;
    var continueLabel = 'Continue';
    var sub = 'Pick a mode to start';
    if (lastMode && lastMode.mode) {
      var m = MODES.filter(function (x) { return x.id === lastMode.mode; })[0] || (lastMode.mode === 'quiz' ? MODES[1] : null);
      if (m) {
        continueLabel = 'Continue ' + m.name;
        sub = m.desc + (lastMode.params && lastMode.params.variant ? ' · ' + (lastMode.params.variant || '') : '');
      }
    }
    var continueTarget = (lastMode && lastMode.mode && B850.screens[lastMode.mode]) ? lastMode.mode : 'learn';
    var cta = U.h('div', { style: 'margin-top:14px' }, [
      U.h('button', {
        class: 'btn btn-lg',
        type: 'button',
        'aria-label': 'Continue learning',
        onclick: function () { U.navigate(continueTarget, lastMode && lastMode.mode === 'quiz' ? lastMode.params : undefined); }
      }, [U.h('span', { text: '▶ ' + continueLabel }), U.h('span', { class: 'pill pill-accent', text: sub })])
    ]);
    root.appendChild(cta);

    // modes grid
    var grid = U.h('div', { class: 'mode-grid' });
    MODES.forEach(function (m) {
      var extra = '';
      if (m.id === 'review') { extra = due > 0 ? due + ' due' : 'all caught up'; }
      if (m.id === 'stats') { extra = 'mastery & accuracy'; }
      grid.appendChild(U.h('button', {
        class: 'mode-card',
        type: 'button',
        'aria-label': m.name + ': ' + m.desc,
        onclick: function () { U.navigate(m.id); }
      }, [
        U.h('span', { class: 'mode-emoji', text: m.emoji, 'aria-hidden': 'true' }),
        U.h('span', { class: 'mode-name', text: m.name }),
        U.h('span', { class: 'mode-desc', text: m.desc }),
        U.h('span', { class: 'mode-desc', style: 'margin-top:auto', text: extra })
      ]));
    });
    root.appendChild(U.h('h2', { class: 'section-title', text: 'Practice' }));
    // move section title before grid
    root.insertBefore(grid, root.querySelector('.section-title'));

    // categories
    root.appendChild(U.h('h2', { class: 'section-title', text: 'Categories' }));
    var catCard = U.h('div', { class: 'card' });
    S.CATEGORIES.forEach(function (c) { catCard.appendChild(categoryRow(c)); });
    root.appendChild(catCard);

    root.appendChild(U.h('p', { class: 'screen-sub', style: 'text-align:center;margin-top:18px;font-size:13px' }, [
      'Ogden\u2019s 850 Basic English · ' + total + ' words · works offline'
    ]));

    U.render(root);
  }

  B850.screens.home = { render: render };
})();
