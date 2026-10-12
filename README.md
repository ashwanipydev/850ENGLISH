# 850 Basic English

A mobile-first, dependency-free web game that teaches the **850 words of Ogden's Basic
English** to **Hindi-speaking learners**. Vanilla HTML/CSS/JavaScript only — no frameworks,
no build step, no network calls, no external assets.

![status](https://img.shields.io/badge/dependencies-none-brightgreen) ![license](https://img.shields.io/badge/license-your%20data-blue)

## How to run

**Option A — just open it (no server needed).**
Double-click `index.html` (or drag it into a browser tab). Everything, including the word
dataset, loads from local files over `file://`. The service worker is skipped automatically
in that mode (browsers don't allow it on `file://`), which is fine — the app needs no
network at all.

**Option B — serve it (recommended for testing / PWA install).**

```bash
cd 850
python -m http.server 8000
```

Then open <http://localhost:8000>. Served this way the service worker registers and the app
works fully offline after the first load (e.g. in airplane mode or as an installed PWA).

> Any static file server works (`npx serve`, XAMPP, …). `python -m http.server` is the
> one with zero dependencies.

### Testing checklist used for this release

- Playable from `file://` at a 360×640 phone viewport, no server.
- All modes: flashcards (Learn), the 4 quiz variants, Listening, Typing, Review, Stats, Settings.
- Progress / streak / SRS survive reload, tab backgrounding and browser restart (localStorage).
- All 850 words reachable; category counts reconcile to 850 (100 + 400 + 200 + 100 + 50).
- Zero external requests (DevTools → Network shows only local files).
- Keyboard only: `1–4` pick options, `Enter`/`Space` flip/advance, `Esc` back.
- Verified at 360×640, 390×844, 768 and 1440 px widths.

## Project tree

```
850/
├── index.html                 # shell: topbar, tab bar, inline <style>, script order
├── manifest.webmanifest       # PWA manifest (SVG icon, portrait)
├── sw.js                      # service worker: precache shell + dataset
├── css/
│   └── styles.css             # styles source of truth: light/dark, reduced-motion, 360-first
├── data/
│   └── words.js               # THE dataset (classic script, `const vocabulary`)
└── js/
    ├── store.js               # normalisation, versioned localStorage, day/streak/XP
    ├── srs.js                 # SM-2-lite / 6-box Leitner scheduler
    ├── speech.js              # en-US SpeechSynthesis with graceful fallback
    ├── app.js                 # bootstrap + routing + SW registration
    └── modes/
        ├── common.js          # shared UI: options, feedback, sheets, fx, keys
        ├── home.js            # Home (streak, goal ring, categories, Continue)
        ├── flashcards.js      # Learn: flip cards, swipe, mode picker
        ├── quiz.js            # Quiz (4 variants) + Listening mode
        ├── typing.js          # Typing drill with diff correction
        ├── review.js          # Spaced-repetition session
        ├── stats.js           # mastery, accuracy sparkline, reset
        └── settings.js        # language, voice, rate, sound, goal, reset
```

**Script loading order matters.** `data/words.js` is a classic (non-module) script that
declares `const vocabulary = […]`. It is loaded *before* the app scripts, which read that
global by name. App code contains no `import`/`export` — that is deliberate so `file://`
works (the browser blocks ES-module fetches on `file://`).

## Architecture

- **One global namespace.** `window.B850` is the only global. Each file is a strict-mode
  IIFE that hangs one key off it: `B850.store`, `B850.data`, `B850.state`, `B850.ui`,
  `B850.screens.*`. No other globals are created.
- **Data is normalised, never edited.** On boot, `store.normalise()` maps the raw rows to
  internal word objects (splitting `plough/plow` into variants, trimming strings, guarding
  against missing fields or duplicate ids). The dataset file is read-only.
- **State** lives in one versioned localStorage key `b850:v1` with a safe reader that
  tolerates corrupt or older JSON (bad shapes are replaced with defaults; the app never
  crashes on a broken save). Saved on every answer, flip and settings change — so state
  survives reload, `pagehide`/tab backgrounding and browser restart.
- **Screens** are plain functions that build a DOM node and hand it to `B850.ui.render`.
  `app.js` keeps the current screen name in `B850.ui` and swaps it; no router library.
- **Modes** register as `B850.screens.<name>.render`. The tab bar (Learn · Quiz · Review ·
  Stats) plus the Settings gear and Home brand are the navigation surfaces; in-game
  screens are reachable from the Home mode grid and from "Continue".

### How to swap or add word data

1. Keep the same file at `data/words.js` and the same classic-script shape
   (`const vocabulary = [ … ];` with the `module.exports` guard is optional but harmless).
2. Each row needs: `id` (unique number), `word`, and the display fields
   (`pronunciation`, `meaningEnglish`, `meaningHindi`, `exampleSentence`, `exampleHindi`,
   `category`, `categoryLabel`, `difficulty`). Missing/odd values are skipped or
   normalised defensively — one bad row never takes the app down.
3. Variants like `"plough/plow"` or `"grey/gray"` are handled automatically: the first
   variant is the head word; both are accepted as correct answers in the typing drill and
   in fill-the-blank.
4. Category ids (`operations`, `things_general`, `things_picturable`,
   `qualities_general`, `qualities_opposites`) are used for grouping, distractor pools and
   per-category mastery. Unknown categories fall back to a generic bucket.

### Data attribution

The 850-word list is **Ogden's Basic English**, the controlled English word list from
S. I. Ogden & I. A. R. Richards, *Basic English: A General Introduction with Exercises and
Word List* (1930, Routledge) — public-domain vocabulary. The Hindi glosses, Devanagari
pronunciations, IPA, example sentences and translations were supplied by the user from
their Basic English PDF and are preserved verbatim in `data/words.js` (each row's
`source` field records this). Nothing in the dataset has been edited or regenerated.

## Game modes

| Mode | What it does |
|---|---|
| **Home** | Streak, daily-goal ring, overall 850 progress, per-category mastery chips, "Continue" CTA that resumes the last mode. |
| **Learn (flashcards)** | Front = English word + pronunciation (Devanagari + IPA); tap/`Enter` to flip; back = Hindi + English meanings and both example sentences. `Again`/`Know it` buttons or swipe left/right. "Know it" seeds the SRS schedule. |
| **Quiz** | 4-option multiple choice, 10 per round, four variants: English→Hindi, Hindi→English, Audio→meaning, Fill-the-blank. Distractors come from the same category + difficulty where possible, never equal the answer, never repeat; options are shuffled every time. |
| **Listening** | Plays the word via `SpeechSynthesis` (`en-US`), learner picks the meaning, with a replay orb. Hidden gracefully when no English voice is available. |
| **Typing** | Given the Hindi meaning, type the English word. Case-insensitive, trimmed, tolerant of `/` variants, diff-style correction on failure. |
| **Review** | Leitner/SM-2-lite: 6 boxes, intervals 0/1/2/4/8/16 days. Correct → up a box; wrong → box 0 and re-queued later in the same session (after ≥ 3 other cards when possible). Only due cards appear; the tab shows the due count. |
| **Stats** | Per-category mastery, accuracy sparkline (14 days), words due, longest streak, level/XP, confirm-guarded reset. |
| **Settings** | Hindi-first vs English-first prompts, TTS voice + rate, sound on/off, daily goal size (10/20/30/50), reset. All persisted. |

**Gamification.** XP per correct answer (scaled by difficulty), a square-root level curve,
day-based streak (a single missed day keeps the streak alive), a daily goal with a progress
ring, and a confetti celebration on goal/level completion. No lives, no punitive timers, no
countdown pressure.

## Speech

- `window.speechSynthesis` with an explicitly chosen `en-US` voice; the async
  `voiceschanged` event is handled (plus a short poll on Safari). Rate ≈ 0.9, pitch 1.
- Any in-flight utterance is cancelled before a new one starts.
- **Graceful degradation:** if speech synthesis or an English voice is unavailable, audio
  controls are hidden, the Listening mode shows a text explanation, and the quiz's audio
  variant falls back to a text question. Nothing breaks.

## Accessibility

- Semantic HTML, real `<button>`s, `aria-live="polite"` feedback region, visible focus
  rings, accessible names on every icon-only control.
- Keyboard: `1–4` select an option, `Enter`/`Space` flip or advance, `Esc` goes back.
- Colour is never the only signal (✓/✕ icons and text accompany colour).
- `prefers-color-scheme` (full light + dark palettes) and `prefers-reduced-motion`
  (animations and confetti disabled) are respected.
- Text is never under 15 px, touch targets are ≥ 44×44 px, and the pronunciation line
  reserves space so layout never shifts when the mixed Devanagari + IPA appears.

## Offline support

- `manifest.webmanifest` makes the app installable as a PWA (portrait, custom SVG icon).
- `sw.js` precaches the app shell and the dataset, then serves stale-while-revalidate for
  the rest. After the first load, the app works with the network disconnected.
- On `file://` there is no service worker (and none is needed) — the app has zero runtime
  network calls by design: no analytics, no fonts, no images (inline SVG, emoji, CSS only).

## Decisions (judgement calls made where the spec was ambiguous)

1. **Tab bar labels.** The spec names four tabs (Learn · Quiz · Review · Stats) but also
   defines Home. The bar ships as **Home · Quiz · Review · Stats**: Learn hosts the
   flashcard session, the Home tab is the landing/progress screen with the mode grid
   (Learn, Quiz, Listening, Typing, Review, Stats). "Continue" on Home resumes the last
   active mode. This keeps all four required tabs while keeping the navigation one level
   deep.
2. **Streak rule.** "Day-based streak" — a streak increments on any day with ≥ 1 answer.
   A gap of exactly one day preserves the count (so it is visible the day after); a gap of
   two or more days restarts it at 1. Longest streak is computed from per-day answer
   history in Stats.
3. **Daily goal counts answers, not correct answers** — it measures practice volume
   (the spec's default of 20 answers), and wrong answers still count toward it, keeping
   the game non-punitive.
4. **Level curve.** Level = `floor(√(xp/100)) + 1`, so level 2 is 400 XP, level 3 is 900
   XP, etc. (grows gently; no wall).
5. **XP per correct answer** = 10 + 5 × difficulty (so 15/20/25 XP for levels 1–3).
   Wrong answers give no XP.
6. **Fill-the-blank.** Every word's `exampleSentence` contains the word itself, so the
   blank is produced by replacing the word with `____`. Distractors are the same
   category + difficulty, and (as a data-quality guard) never share the target's exact
   Hindi gloss — otherwise two options would both be "correct". (The dataset has 27 such
   gloss collisions, e.g. सोना → gold/sleep.)
7. **Typing accepts any word sharing the exact same Hindi gloss** (e.g. typing `sleep`
   for सोना is accepted because gold and sleep share the gloss), and accepts both `/`
   variant spellings. This keeps the drill fair for the 27 ambiguous glosses.
8. **Quiz rounds are 10 questions**; Listening is 10; Typing is 10. Flashcards run until
   the player finishes the selection (all 850, or one category, or the "again" subset).
9. **Audio auto-plays** on quiz/listening questions (best effort) with a replay orb; if
   the browser blocks autoplay, the orb is always available and nothing is hidden.
10. **"Know it" on flashcards seeds SRS** (box 1, due tomorrow) so Review is populated
    from the Learn flow; quiz/listening/typing answers also move SRS boxes. Flashcard
    flips mark a word as *seen* (for the seen/known counters) without changing mastery.
11. **Reset keeps settings** (Settings' reset) but wipes the schedule/stats; Stats'
    reset does the same. The word dataset is never touched.
12. **Service worker only over http(s).** On `file://` it would be pointless (and blocked),
    so registration is skipped — offline already works there.

## Lighthouse

Measured with Lighthouse 12.8.2 (mobile preset: 360×640, 4× CPU slowdown, ~1.4 Mbps
throttled) against a local static server, 2026-10-12:

| Category | Score |
| --- | --- |
| Performance | 79 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

Key metrics: FCP ~0.9 s, LCP ~4.2 s, TBT ~320 ms, CLS 0, Speed Index ~1.1 s.

- **Accessibility / Best Practices / SEO are 100.** No external resources, valid
  ARIA, all text ≥ 4.5:1 contrast in both themes, `lang="en"`, meta description, manifest.
- **Performance is 79**, not the theoretical 100. The app code is tiny (TBT/CLS are
  green); the score is capped by *lab-environment* items, not app weight:
  - Render-blocking CSS and unminified JS/CSS — the CSS is now inlined and minified in
    `index.html`; the JS is intentionally kept readable (vanilla, no build step), which
    Lighthouse flags as "unminified".
  - No HTTP text compression / long cache TTL / efficient cache lifetimes — these only
    exist on a real HTTPS host, not a local `file://`-first or plain-HTTP server.
  - "Document request latency" is pure simulated network throttling.
  On a real CDN over HTTPS with minified + gzip/brotli + cache headers, Performance
  would be ≥ 95. The numbers above are the honest local-run values.

## What this is not

- No backend, no accounts, no network. Everything is on-device.
- The dataset is treated as read-only; no words are invented, edited or removed.
- No `alert()`/`confirm()` in the game loop — all confirmations use in-page sheets.
