# Capybara Sushi

A cozy children's game set in a tiny Tokyo neighbourhood, where a calm
capybara chef runs a sushi counter. At its heart is satisfying sushi slicing:
order, slice, the pieces separate, the chef reacts, plate, serve, next roll.

**Status: a development preview (v0.4.0), not a release for children.** One
3D scene, seen three-quarters on so the rice and salmon show: a salmon roll
on a cutting board, which squashes, wobbles and rocks as you cut it, a plate
where the finished pieces are served with their faces showing, and Chef
Capybara behind the counter, who watches and is pleased with every cut.
There are no customers, and no sound, saving, final branding or final icons
yet. The chef and the food are first versions, not approved looks.
**Real-device testing of the 3D scene and the chef is pending**
([docs/DEVICE-QA.md](docs/DEVICE-QA.md)). It needs WebGL 2 and, on iPhone
and iPad, iOS or iPadOS 16.4 or newer. See [docs/PRODUCT.md](docs/PRODUCT.md)
for the product and roadmap, and [docs/REMAINING-WORK.md](docs/REMAINING-WORK.md)
for what is not done.

**Development preview, for real-device playtesting:**

- Play: <https://morecobrax-dot.github.io/Capybara-Sushi/>
- Tune (developer): <https://morecobrax-dot.github.io/Capybara-Sushi/?tune>

GitHub Pages may take up to 10 minutes to show a new push on a device.

## Play it locally

```bash
npx --yes http-server -p 8395 -c-1 .
```

- Play: <http://localhost:8395/>
- Play with the developer feel-tuning sheet: <http://localhost:8395/?tune>

Swipe down across the roll to cut it; slow drags and quick flicks both work.
With a mouse, drag with the left button. Space, Enter or the down arrow also
cut. After a quiet moment a ghost finger shows the swipe.

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

- [docs/PRODUCT.md](docs/PRODUCT.md): the product, its permanent rules, the
  roadmap and this phase.
- [docs/DEVICE-QA.md](docs/DEVICE-QA.md): how to judge the slicing by hand,
  and what only a real device can check.
- [docs/REMAINING-WORK.md](docs/REMAINING-WORK.md): onboarding and release
  work that is not done yet.
- [ARCHITECTURE.md](ARCHITECTURE.md): how the pieces fit.
- [PRODUCT-DESIGN.md](PRODUCT-DESIGN.md): the UI rules the foundation
  encodes.
- [CLAUDE.md](CLAUDE.md): the development method, and Capybara Sushi's own
  rules.
