# Capybara Sushi

A cozy sushi kitchen where kindergarten children practise early maths with
Chef Capy, a calm capybara chef, and their teacher gets a clear picture of
what each child can do and a lesson plan for what to teach next. It grew from
a slicing game — order, slice, the pieces separate, the chef reacts, plate,
serve — and since 0.8.0 its direction is the classroom learning product in
[docs/LEARNING-SPEC.md](docs/LEARNING-SPEC.md).

**Status: a single-device development prototype (v0.9.0), not a release
for children and not a classroom tool.** A child starts outside the sushi
bar, taps one of six fictional avatars and goes in; Chef Capy shows the task
once, then the sleepy cat orders one to five pieces with a picture in its
speech bubble. The child slices pieces off the roll, puts exactly that many
on the plate (a tap, the plate buttons, or keys) and rings the bell; a different number brings gentle help
and another try. Five orders make a round. Behind the grown-ups'
times-table question, a teacher workspace (Today, Class, Students, Lessons,
Reports) shows that evidence for the one counting skill, makes an editable
lesson draft and prints teacher and family reports. Everything stays in this
browser: fictional profiles only, no sign-in, no backend, no syncing between
devices — the times-table question is a parent gate, not teacher
authentication. The counting content, its rule and the lesson template await
an educator's review, and nothing here has been tried with children. A guide for a supervised
hands-on try-out with the fictional profiles is in
[docs/TRY-OUT.md](docs/TRY-OUT.md). The
chef, the cat and the food are first versions, not approved looks; there is
no final branding or icon.
**Real-device testing of the 3D scene and the chef is pending**
([docs/DEVICE-QA.md](docs/DEVICE-QA.md)). It needs WebGL 2 and, on iPhone
and iPad, iOS or iPadOS 16.4 or newer. See [docs/PRODUCT.md](docs/PRODUCT.md)
for the product and roadmap, and [docs/REMAINING-WORK.md](docs/REMAINING-WORK.md)
for what is not done.

**Development preview, for real-device playtesting:**

- Play: <https://morecobrax-dot.github.io/Capybara-Sushi/>
- Teacher workspace: tap the grown-ups' button (top corner), answer the
  question, then **Teacher workspace**. **Willow class (DEMO sample data)**
  in its class menu shows a made-up week of evidence.
- The 0.7.0 endless slicing (developer): <https://morecobrax-dot.github.io/Capybara-Sushi/?free>
- Tune (developer): <https://morecobrax-dot.github.io/Capybara-Sushi/?tune>

GitHub Pages may take up to 10 minutes to show a new push on a device.

## Play it locally

```bash
npx --yes http-server -p 8395 -c-1 .
```

- Play: <http://localhost:8395/>
- Play with the developer feel-tuning sheet: <http://localhost:8395/?tune>

In the counting rounds: swipe down across the roll, or press the knife
button, Space, K or the down arrow, to cut a slice off; tap a slice, or use
the plate buttons (+ and −, or the right and left arrows), to move one piece
between the board and the plate — only a slice goes on the plate, never the
rest of the roll; ring the bell, or press Enter, to serve. The
chef button or H asks for help; the order card or R says the order again.
In the endless slicing (`?free`), Space, Enter or the down arrow cut, and a
ghost finger shows the swipe after a quiet moment.

A service worker needs `http(s)`, so opening `index.html` from disk works but
cannot test offline play. Port 8395 is this project's own. Other projects on
this machine use 8391, and sharing a localhost origin lets their service
workers replace each other.

## Tune the feel (developer only)

Add `?tune` to the address and a small button appears in the top-right
corner. It opens the Feel tuning sheet, which pauses play while it is open:

| Group | Control | Starts at |
|---|---|---|
| Cut forgiveness | Depth needed to cut (share of the roll's thickness) | 0.6 |
| Cut forgiveness | Slant allowed (degrees off vertical) | 50 |
| Guide attraction | Pull toward guides (0 = none, at most 0.8) | 0.6 |
| Separation | Gap after a cut (px) | 10 |
| Separation | Pop (px/s) | 220 |
| Separation | Bounce (0 = none, 1 = most) | 0.35 |
| Jiggle | Strength (0 = none, up to 2) | 1 |
| Jiggle | Softness (0 = firm and quick, 1 = soft and slow) | 0.5 |
| Jiggle | Settling (0 = wobbles on, 1 = settles at once) | 0.5 |
| Transitions | Finished roll shown (ms) | 650 |
| Transitions | Clear and next roll (ms, each) | 300 |
| Transitions | Hint after (s) | 5 |
| Roll | Pieces per roll (4–8; a new count starts a fresh roll when the sheet closes) | 6 |

Values last until the page reloads. **Copy** puts a one-line summary on the
clipboard, or selects it in the box to copy by hand; paste it back to update
the defaults in `TUNING_DEFAULTS` in `index.html`. **Reset** restores the
starting values. **New roll** starts a fresh roll. The sheet also leads to
What's new (to confirm which version a device is running) and Backup & data.

`?tune` is not a grown-up setting and never appears in ordinary play. It must
be removed, or moved behind a parent gate, before any child-facing release.

## Verify

```bash
npm run verify
```

This runs the contract suite, checks that the generated PWA files still
match `APP_CONFIG`, and runs the residue scan. It must be green before every
commit. It needs no install: the only library, Three.js, is vendored in
`lib/three`, and the suite loads that same file.

```bash
npm test              # contracts only
npm run config:verify # identity drift only
npm run contamination # residue scan only
npm run config:sync   # write APP_CONFIG into the generated files
```

The contracts run the real game, and the real Three.js scene graph, in Node
with a virtual clock and dispatched pointer events; only the GPU is a
stand-in. They cannot see a real browser's hit-testing, a real GPU or a real
finger, and they cannot judge how slicing *feels*: see
[docs/DEVICE-QA.md](docs/DEVICE-QA.md).

## What it is made of

One HTML file (`index.html`) holds the whole app: design tokens, the stage,
and one script. The scene is drawn in 3D with Three.js (r186, WebGL 2),
vendored unmodified in `lib/three` with its licence and a record of its
version, source and hashes, and loaded from this app's own folder, never from
a CDN. Over it, a flat canvas carries the knife's trail, the guides and the
hint, and takes every touch. The app was generated from the private
app-starter template, and its foundation (storage, overlays, config sync,
PWA, tests) is described in [ARCHITECTURE.md](ARCHITECTURE.md).

```
index.html              the app: tokens, stage, foundation, the slicing game
lib/three/              Three.js r186, unmodified, with LICENSE and provenance
sw.js                   offline shell; cache name and file list derived
manifest.webmanifest    install metadata, derived from APP_CONFIG
icon-192/512.png        placeholder icons, not final
scripts/config.js       sync / verify generated files against APP_CONFIG
scripts/contamination.js residue guard
test/harness.js         the app in a Node vm: DOM stub, Three.js, virtual clock
test/contracts.js       the contract suite
test/run.js             the runner
```

## Documentation

- [docs/LEARNING-SPEC.md](docs/LEARNING-SPEC.md): the learning product
  specification (a summary of v1.1) and what 0.8.0 and 0.9.0 implement.
- [docs/TRY-OUT.md](docs/TRY-OUT.md): a supervised hands-on try-out of the
  whole loop with the fictional profiles, with space for notes.
- [docs/PRODUCT.md](docs/PRODUCT.md): the product, its permanent rules, the
  roadmap and this phase.
- [docs/DEVICE-QA.md](docs/DEVICE-QA.md): how to judge the slicing by hand,
  and what only a real device can check.
- [docs/REMAINING-WORK.md](docs/REMAINING-WORK.md): what is not done yet,
  including the backend and authorization a real classroom needs.
- [ARCHITECTURE.md](ARCHITECTURE.md): how the pieces fit.
- [PRODUCT-DESIGN.md](PRODUCT-DESIGN.md): the UI rules the foundation
  encodes.
- [CLAUDE.md](CLAUDE.md): the development method, and Capybara Sushi's own
  rules.
