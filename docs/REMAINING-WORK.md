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

## Known limits (Phase 1C)

- Chef Capybara is a first version. Its size is set by the room the food
  leaves: its head is about 100–170 px wide on tablets and 60–70 px on phones
  held upright, but only 45–50 px on a phone held sideways, where it stands in
  the top corner beside the roll, and on a very small screen held sideways
  (568 × 320) it stays away rather than crowd the food.
- On tablets the food sits 100–200 px lower than in 0.3.0 to make room for
  the chef above it; its size is unchanged. The counter now ends behind the
  food, with a plain wall behind it.
- The chef has no cast shadow, no fingers, a painted-on apron and bead eyes;
  its clay is smooth, with no surface texture.
- At rest the scene is drawn again only for the chef's idle gestures, about
  three frames a second on average, where 0.3.0 drew nothing; the chef adds
  a dozen draw calls, about 8,000 triangles and four shader programs (the
  blush's is compiled when the first roll is finished, as 0.3.0 already
  compiled one there), and 30–80 ms to the first draw on this machine. Frame
  rates were unchanged in browser QA, which is not an Apple device.

## Known limits (Phase 1B)

- Cuts are straight. A slanted swipe cuts straight down at the point where it
  crossed the middle of the roll.
- Every feel value is a starting hypothesis (see the README table) until it
  has been judged on a device, the Jiggle values included.
- At rest, each gap between pieces shows its cut face as a sliver of rice:
  the gap is 10 px, and the salmon only shows at the roll's near end, while
  pieces tip apart, and on the plate. A larger "Gap after a cut" in `?tune`
  shows more of each face.
- Seeing the end costs some length: the roll is shorter on the glass for its
  thickness than in 0.2.0. An ideal piece is about 44 px wide on a
  390-px-wide phone held upright (51 px in 0.2.0) and 69 px on a phone held
  sideways (79 px); tablets are unchanged or larger.
- Portrait stands the plate behind the board, but there is still empty
  counter above the food on tall phones.
- With very uneven cuts the served row turns its pieces less, so it fits the
  plate, and their faces show less.
- Shadows are soft contact blobs, not cast shadows. Only the food reflects a
  small computed room, for its sheen; nothing reflects anything real, and the
  counter is plain matte, which keeps the frame time where 0.2.0 had it.
- The textures are computed at load (about 70 ms on a desktop, 40 ms in
  0.2.0) and are deliberately soft; the rice grains are painted, not modelled.
- On Windows, Three.js repeats a Direct3D compiler precision note when it
  builds the reflection's shaders. It is harmless and does not happen on
  Apple devices.
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
