# Remaining work

None of this is done. It is listed so nothing here reads as finished.

## From the template's new-product steps

- **Final icons.** `icon-192.png` and `icon-512.png` are the template's
  neutral placeholders. The residue scan checks filenames only, not pixels.
- **Real-device QA.** See [DEVICE-QA.md](DEVICE-QA.md): none of it has been
  run.
- **Release.** The prototype is published only as a development preview on
  GitHub Pages (Phase 0C), so it can be tested on real devices. It is not a
  release for children: see the list below.

## Before any release to children

- Remove the `?tune` developer sheet, or move it behind the parent gate.
- Build the parent gate (planned for Phase 1, with the first grown-up
  settings). Backup & data and What's new then move behind it.
- Sound and haptics, each with an off switch behind the gate. Haptics are
  web-available on Android only: iPhone Safari has no vibration API and iPads
  have no haptic hardware.
- The foundation's "this browser is not saving" notice has nowhere to appear,
  because nothing is saved. When local save arrives (Phase 3), show it in the
  grown-ups area.
- All apps under `morecobrax-dot.github.io` share one origin. `APP_ID` keeps
  their storage and caches apart, but they share one browser storage quota
  (about 5 MB), and Cache Storage too. That matters once Phase 3 saves
  progress; the 3D library alone is 2.1 MB in this app's cache.
- Devices on iOS or iPadOS older than 16.4 cannot run the 3D scene (it shows
  a note instead). If they matter, an older Three.js release would need a
  deliberate decision.

## Known limits (Phase 1A)

- Cuts are straight. A slanted swipe cuts straight down at the point where it
  crossed the middle of the roll.
- Every feel value is a starting hypothesis (see the README table) until it
  has been judged on a device, the Jiggle values included.
- The camera looks straight across the roll, so cut faces show only in the
  gaps, when the pieces tip, and at the edges of the screen. The finished
  pieces lie on the plate in a row rather than standing to show their faces;
  a long, imperfect piece would make a very tall tower.
- Portrait works but leaves a lot of empty counter above and below the roll.
- Shadows are soft contact blobs, not cast shadows, and there are no
  reflections: both would cost far more to draw. The plate is a simple glazed
  slab.
- The textures are computed at load (about 40 ms on a desktop) and are
  deliberately soft; there is no normal-mapped rice.
- The Three.js files are unminified (2.1 MB, about 0.45 MB compressed); the
  published package ships no minified build at this version.
- The 3D scene draws at most 2 device pixels per CSS pixel, and at most about
  3.2 million pixels a frame, so a large iPad is drawn a little under its full
  resolution. The flat layer over it draws at up to 2×.
- The toast host still sits a tab bar's height above the bottom. Only the
  developer sheet shows toasts.
- Foundation CSS the game does not use (tab bar, segmented control, stats,
  badges, progress) is kept, because the foundation contracts protect it.
  Removing it is its own change.

## Possible upstream fixes for app-starter (the user's call)

Both of Capybara Sushi's foundation repairs have now been needed by a second
product:

- Backup & data depended on the demo (`statHtml`, and the demo's list in the
  record count and in erase).
- Orientation belongs in `APP_CONFIG`.

The harness improvements would help any product that animates: the virtual
clock, the canvas stub, `window` as the global object, and surfaced listener
errors. So would the widened portability check.
