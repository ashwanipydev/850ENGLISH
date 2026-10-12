/* 850 Basic English — speech synthesis (en-US), with graceful degradation.
 * If speechSynthesis or an English voice is unavailable, `supported` is false
 * and the UI hides audio controls and falls back to text prompts.
 * Cancels any in-flight utterance before starting a new one.
 */
(function () {
  'use strict';

  var supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  var voices = [];
  var picked = null;
  var ready = false;
  var currentToken = null;
  var currentHandle = null;

  function allVoices() {
    try { return window.speechSynthesis.getVoices() || []; } catch (e) { return []; }
  }

  function refresh() {
    voices = allVoices();
    var wanted = null, anyEn = null;
    var i, v;
    if (voices.length) { ready = true; }
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (!/en[-_]US/i.test(v.lang)) continue;
      if (!anyEn) { anyEn = v; }
      var prefs = (B850 && B850.state ? B850.state.settings : {}).voiceURI || '';
      if (prefs && (v.voiceURI === prefs || v.name === prefs)) { wanted = v; break; }
      if (wanted) { continue; }
      // prefer Google/Google US / Microsoft David-style US voices
      if (/google/i.test(v.name)) { wanted = v; break; }
      if (wanted && !/samantha|daniel|zira/i.test(v.name)) { wanted = v; continue; }
      if (!wanted) { wanted = v; }
    }
    picked = wanted || anyEn || null;
    if (!picked) { supported = false; }
    return picked;
  }

  function init() {
    if (!supported) { return; }
    refresh();
    try {
      window.speechSynthesis.addEventListener('voiceschanged', refresh);
    } catch (e) {
      // Safari quirk: poll briefly while voices load.
      var tries = 0;
      var timer = window.setInterval(function () {
        refresh();
        tries += 1;
        if ((voices.length && picked) || tries > 20) { window.clearInterval(timer); }
      }, 250);
    }
  }

  // Speak the primary (first) variant of the word; strips IPA/Devanagari noise.
  function speak(text, onend) {
    if (!supported || !picked) { if (onend) { onend(false); } return null; }
    var word = String(text || '').trim();
    if (word) { word = word.split('/')[0].trim(); }
    try {
      window.speechSynthesis.cancel();
      if (currentHandle) { currentHandle.ended = false; currentHandle = null; }
      var u = new SpeechSynthesisUtterance(word);
      u.voice = picked;
      u.lang = picked.lang || 'en-US';
      var rate = (B850 && B850.state ? B850.state.settings.rate : 0.9) || 0.9;
      u.rate = rate;
      u.pitch = 1;
      var done = false;
      var token = {};
      currentToken = token;
      var finish = function (ok) {
        if (done) { return; }
        done = true;
        if (currentHandle === u) { currentHandle = null; }
        if (currentToken === token) { currentToken = null; }
        if (onend) { onend(ok); }
      };
      u.onend = function () { finish(true); };
      u.onerror = function () { finish(false); };
      // Safety net: some engines never fire onend when immediately cancelled.
      window.setTimeout(function () { finish(false); }, 4000 + word.length * 250);
      currentHandle = u;
      window.speechSynthesis.speak(u);
      return u;
    } catch (e) {
      supported = false;
      if (onend) { onend(false); }
      return null;
    }
  }

  function cancel() {
    if (!supported) { return; }
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    currentHandle = null;
    currentToken = null;
  }

  function pickVoiceURI(uri) {
    if (B850.state) { B850.state.settings.voiceURI = uri || ''; }
    refresh();
  }

  function availableVoices() {
    if (!supported) { return []; }
    if (!voices.length) { refresh(); }
    return voices.filter(function (v) { return /^en/i.test(v.lang); });
  }

  init();

  B850.store.speech = {
    supported: function () { return supported && !!picked; },
    ready: function () { return ready && !!picked; },
    init: init,
    speak: speak,
    cancel: cancel,
    pickVoiceURI: pickVoiceURI,
    availableVoices: availableVoices,
    currentVoice: function () { return picked; }
  };
})();
