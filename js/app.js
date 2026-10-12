/* 850 Basic English — app bootstrap: state, data, routing, service worker.
 * Exactly one global: window.B850 (populated by store.js, extended here).
 */
(function () {
  'use strict';

  var S = B850.store;
  var U = B850.ui;

  var currentScreen = null;

  function navigate(name, params) {
    var screen = B850.screens[name];
    if (!screen || typeof screen.render !== 'function') { name = 'home'; screen = B850.screens.home; }
    if (currentScreen === name && params && params.__force) { /* allow forced re-render */ }
    currentScreen = name;
    try {
      screen.render(params);
    } catch (e) {
      // defensive: a screen crash should not blank the whole app
      var main = document.getElementById('main');
      if (main) {
        main.innerHTML = '<div class="card" style="margin:16px"><b>Something went wrong in this screen.</b><p style="color:var(--text-2);margin:8px 0 12px">' + String(e.message) + '</p><button class="btn" type="button" onclick="B850.ui.navigate(\'home\')">Go home</button></div>';
      }
      if (window.console && console.error) { console.error('screen render error:', e); }
    }
  }

  B850.ui.navigate = navigate;

  function boot() {
    // 1. data (fail hard but visibly if the dataset is missing)
    var data = S.normalise();
    if (!data || !data.total) {
      var main = document.getElementById('main');
      if (main) {
        main.innerHTML = '';
        var d = document.createElement('div');
        d.className = 'card';
        d.style.margin = '20px 12px';
        d.textContent = 'The word dataset could not be loaded. Make sure data/words.js sits next to index.html.';
        main.appendChild(d);
      }
      return;
    }
    B850.data = data;

    // 2. state
    B850.state = S.load();
    S.save(B850.state);

    // 3. UI
    U.init();

    // 4. chrome buttons
    var btnHome = document.getElementById('btnHome');
    if (btnHome) {
      btnHome.addEventListener('click', function () { B850.ui.navigate('home'); });
    }
    var btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', function () { B850.ui.navigate('settings'); });
    }
    var tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        B850.ui.navigate(tab.getAttribute('data-tab'));
      });
    });

    // 5. navigate home first
    B850.ui.navigate('home');

    // 6. offline support (only when served over http(s); file:// has no SW scope)
    try {
      if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
        });
      }
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
