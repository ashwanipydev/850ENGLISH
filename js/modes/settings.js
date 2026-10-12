/* 850 Basic English — Settings: prompt language, TTS voice + rate, sound,
 * daily goal, and a confirm-guarded reset. Everything persists.
 */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;

  function render() {
    U.clearKey();
    var st = S.state;
    var set = st.settings;
    var root = U.h('section', { class: 'screen', 'aria-label': 'Settings' });
    root.appendChild(U.h('h1', { class: 'screen-title', text: 'Settings' }));
    root.appendChild(U.h('p', { class: 'screen-sub', text: 'Everything is saved on this device — no account, no network.' }));

    var card = U.h('div', { class: 'card' });

    // 1. prompt language
    card.appendChild(U.h('div', { class: 'set-row' }, [
      U.h('div', {}, [
        U.h('div', { class: 'set-label', text: 'Prompt language' }),
        U.h('div', { class: 'set-sub', text: 'Which language leads flashcards, quizzes and listening.' })
      ]),
      U.h('div', { class: 'seg', role: 'group', 'aria-label': 'Prompt language' }, [
        U.segButton('Hindi', set.langFirst === 'hindi', function () {
          set.langFirst = 'hindi';
          S.save(st);
          render();
        }),
        U.segButton('English', set.langFirst === 'english', function () {
          set.langFirst = 'english';
          S.save(st);
          render();
        })
      ])
    ]));

    // 2. TTS voice
    var voiceRow = U.h('div', { class: 'set-row' });
    var voiceWrap = U.h('div', {}, [
      U.h('div', { class: 'set-label', text: 'Voice' }),
      U.h('div', { class: 'set-sub', id: 'voiceSub', text: '' })
    ]);
    voiceRow.appendChild(voiceWrap);
    var voices = S.speech.supported() ? S.speech.availableVoices() : [];
    if (!S.speech.supported()) {
      voiceWrap.appendChild(U.h('p', { class: 'pill pill-warn', style: 'margin:6px 0 0', text: '🔇 No English voice available — audio modes are hidden.' }));
    } else if (!voices.length) {
      voiceWrap.appendChild(U.h('p', { class: 'screen-sub', style: 'margin:6px 0 0', text: 'Loading voices…' }));
    } else {
      var sel = U.h('select', { class: 'select', 'aria-label': 'Speech voice' });
      var auto = U.h('option', { value: '', text: 'Automatic (en-US)' });
      sel.appendChild(auto);
      voices.forEach(function (v) {
        var o = U.h('option', { value: v.voiceURI, text: v.name + ' (' + v.lang + ')' });
        sel.appendChild(o);
      });
      sel.value = set.voiceURI || '';
      sel.addEventListener('change', function () {
        S.speech.pickVoiceURI(sel.value);
        S.save(st);
        U.toast('Voice saved');
        if (S.speech.supported()) { S.speech.speak('Hello'); }
      });
      voiceWrap.appendChild(sel);
    }
    card.appendChild(voiceRow);

    // 3. rate
    card.appendChild(U.h('div', { class: 'set-row' }, [
      U.h('div', {}, [
        U.h('div', { class: 'set-label', text: 'Speech rate' }),
        U.h('div', { class: 'set-sub', text: set.rate.toFixed(1) + '×' })
      ]),
      U.h('div', { class: 'seg', role: 'group', 'aria-label': 'Speech rate' }, [
        U.segButton('Slow', set.rate < 0.85, function () { set.rate = 0.75; S.save(st); render(); }),
        U.segButton('Normal', set.rate >= 0.85 && set.rate <= 0.95, function () { set.rate = 0.9; S.save(st); render(); }),
        U.segButton('Fast', set.rate > 0.95, function () { set.rate = 1.05; S.save(st); render(); })
      ])
    ]));

    // 4. sound
    var sw = U.h('button', {
      class: 'switch', type: 'button', role: 'switch',
      'aria-checked': set.sound ? 'true' : 'false',
      'aria-label': 'Sound effects'
    });
    sw.addEventListener('click', function () {
      set.sound = !set.sound;
      sw.setAttribute('aria-checked', set.sound ? 'true' : 'false');
      S.save(st);
      if (set.sound) { U.sound('ok'); }
    });
    card.appendChild(U.h('div', { class: 'set-row' }, [
      U.h('div', {}, [
        U.h('div', { class: 'set-label', text: 'Sound effects' }),
        U.h('div', { class: 'set-sub', text: 'Short tones for right and wrong answers.' })
      ]),
      sw
    ]));

    // 5. daily goal
    card.appendChild(U.h('div', { class: 'set-row' }, [
      U.h('div', {}, [
        U.h('div', { class: 'set-label', text: 'Daily goal' }),
        U.h('div', { class: 'set-sub', text: st.daily.count + ' answered today · goal: ' + set.goal })
      ]),
      U.h('div', { class: 'seg', role: 'group', 'aria-label': 'Daily goal size' }, [
        U.segButton('10', set.goal === 10, function () { set.goal = 10; S.save(st); render(); }),
        U.segButton('20', set.goal === 20, function () { set.goal = 20; S.save(st); render(); }),
        U.segButton('30', set.goal === 30, function () { set.goal = 30; S.save(st); render(); }),
        U.segButton('50', set.goal === 50, function () { set.goal = 50; S.save(st); render(); })
      ])
    ]));

    root.appendChild(card);

    // 6. reset
    root.appendChild(U.h('h2', { class: 'section-title', text: 'Danger zone' }));
    root.appendChild(U.h('button', {
      class: 'btn btn-bad btn-lg', type: 'button',
      'aria-label': 'Reset all progress',
      onclick: function () {
        U.confirmSheet(
          'Reset all progress?',
          'This deletes your XP, streak, learned words, the spaced-repetition schedule and stats on this device. Settings are kept. The word list itself is not changed.',
          'Yes, reset everything',
          function () {
            var keep = st.settings;
            S.state = S.reset();
            S.state.settings = keep;
            S.save(S.state);
            U.refreshChrome();
            render();
          }
        );
      }
    }, ['🗑  Reset progress']));

    U.render(root);
  }

  B850.screens.settings = { render: render };
})();
