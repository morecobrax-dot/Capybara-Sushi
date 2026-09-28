# Architecture

How the pieces fit. Capybara Sushi was generated from the app-starter
template. The foundation half of this document describes what came from it,
and [The slicing game](#the-slicing-game) describes what Capybara Sushi adds.

---

## The shape of `index.html`

The whole application is one file with four blocks, in this order:

| Block | Contains |
|---|---|
| `<head>` | Meta, viewport, manifest link. The block between `APP-META-BEGIN/END` is **derived** — written by `config:sync`. |
| One `<style>` | Design tokens, then base, shell, controls, surfaces, overlay presentation, toast, the game stage, responsive. |
| `<body>` markup | A hidden heading, the one play view (the 3D scene canvas, the stage canvas over it, and the scene's status), and every overlay declared statically. All other DOM is generated. |
| One `<script>` | Config, release notes, storage, migration, overlay engine, toast, confirmation, icons, navigation, the Domain seam, the slicing game, settings, boot. |

**Keep it to one substantial `<script>` block.** The test harness evaluates
only the largest one. Code in a second block, or in a linked `.js` file, is
invisible to every contract and the suite will still pass. A contract asserts
this, so you will be told if it slips.

This is not a stylistic preference — it is what makes a zero-build application
fully testable in Node without a browser, a bundler or a dependency.

**The one exception: the vendored Three.js library.** The app loads
`lib/three/three.module.js` (which pulls in its sibling `three.core.js`) with
a single dynamic `import()` from the main script. It is third-party code,
kept unmodified and checked byte for byte against its recorded hashes
(contract 29). None of this app's own code lives outside the one script, and
the harness loads the same vendored file so the contracts run the real
library. See [The vendored library](#the-vendored-library).

## Application identity

`APP_CONFIG` near the top of the script is the single source. Everything else
derives from it:

```
APP_CONFIG.id ──┬── STORAGE_NAMESPACE   `<id>.`
                ├── CACHE_NAMESPACE     `<id>-v<version>`
                └── package.json name

APP_UPDATES[0].version ── APP_VERSION ──┬── CACHE_NAMESPACE
                                        └── package.json version

APP_CONFIG.name/shortName/description/themeColor
                └── <head> meta, manifest.webmanifest

APP_CONFIG.orientation ── manifest.webmanifest (validated: only values the
                          manifest spec allows are written)

APP_FILES ── sw.js precache list (every file the app is made of, the
             vendored library included; contract 29 checks each exists)
```

Static files cannot read a JavaScript object at runtime, so
`npm run config:sync` writes the derived values into them, and
`npm run config:verify` (part of `npm run verify`) fails if they drift. There
is no build step: the app runs from source either way.

Adding a new derived value means one entry in `targets()` in
`scripts/config.js`.

`APP_ID` is validated, not sanitised. An invalid id fails loudly, because an id
quietly rewritten into something you did not choose is how two products end up
sharing a namespace.

## Design tokens

Four layers in one `:root`, meant to be edited in order:

1. **Brand** — fonts, accent, and the ground-and-surface ramp. This is the
   whole dial: retheming is editing this block and nothing else. The surface
   steps are literal values rather than computed from the ground, because the
   distances between them were chosen for contrast, not arithmetic.
2. **Semantic** — `--bg`, `--surface`, `--text`, `--success`… Roles, aliased
   onto layer 1. Components reference only these, so no component ever needs
   editing to change the look.
3. **Scale** — type, space, radius, shadow, motion, layout, touch, safe-area
   insets, breakpoints. Rarely changed.
4. **Domain** — Capybara Sushi's scene and marks: the counter, board, plate,
   nori, rice and salmon, the lights, the contact shadow, and the flat marks
   drawn over the scene (guides, blade, incision, hint, the finished mark).
   Neither WebGL nor a canvas can use `var()`, so the game reads these at
   runtime through `COLOR_TOKENS` and `getComputedStyle`; no colour is typed
   into the game's code, and a contract checks it. Scene colours are hex,
   because the textures are worked out from them pixel by pixel.

Two contracts keep the system real rather than aspirational: no `font-family`
literal outside layer 1, and no `font-size` outside the type scale. Genuine
exceptions are marked inline with `/* fs-exempt: reason */` in the eight lines
above the declaration, so the reason travels with the line.

Fonts are system stacks — no network request, nothing to cache offline, no
silent fallback. To use a webfont, add one `<link>` and change `--font-ui`.

## The overlay engine

The most valuable system here. One `MutationObserver` on the body subtree
drives everything that must happen when any surface opens or closes:

- **Scroll lock** — `position: fixed` on the body (what iOS needs), offset
  captured and restored instantly, depth-counted so nested layers do not
  unlock early.
- **Focus** — the surface takes focus, not its first field, so a keyboard does
  not cover the screen. Tab is trapped. Focus returns to the opening control if
  that control still exists.
- **Stacking** — z-index is painted from open order, not document order, so a
  surface opened from another is always on top.
- **ARIA** — `role="dialog"` and `aria-modal` applied and removed with the stack.
- **Escape** — closes the top surface through *that surface's own* declared
  close path, found from its `backdropDismiss(event, fn)` handler or its
  `close*()` button. Nothing is invented; a surface with no declared exit is
  left alone.

Two presentations share it: `.overlay` is a bottom sheet, `.overlay.overlay-page`
is a full page. There is no second implementation of any of the above, and a
contract asserts there is only one observer.

**To add a surface:** declare a `.overlay` div with an id and a `.sheet` inside
it, give it a `close*()` function, and toggle `.open`. Everything above happens
for free. Do not add a lock/unlock pair.

## Storage

One adapter. Every key is prefixed with `APP_ID` inside the module, so no call
site can write an unnamespaced key.

```
<APP_ID>.sys.schemaVersion      migration state
<APP_ID>.sys.backup.<v>.<key>   pre-migration snapshots
<APP_ID>.ui.<name>              per-viewer preferences
<APP_ID>.draft.<form>           in-progress input, never committed data
<APP_ID>.data.<collection>      committed records
```

This prefix is the only thing separating two products deployed under the same
`username.github.io` — `localStorage` and Cache Storage are keyed by origin,
not by path. A contract runs two app ids against one shared store and proves
they cannot see each other.

`set()` returns a real boolean. `getJSON()` returns your fallback on corrupt
data rather than throwing. A missing key reads `null` and is never repaired
with a default.

**Migrations** are keyed by the version they upgrade *from* and run in
sequence. Every key is backed up first; a failure restores it and surfaces a
warning. Bump `DATA_SCHEMA_VERSION` only when the *shape* of stored data
changes.

**Capybara Sushi saves nothing yet.** The roll, the tuning and every gesture
live in memory, and the only key written is the schema version. Backup & data
counts records from whatever `data.*` keys exist, so it does not depend on
any one product's collection.

## Feedback

- `toast(message, variant)` — non-blocking, one `aria-live` region, capped at
  three, auto-dismissing, reduced-motion aware. Use it after something
  succeeded.
- `confirmAction({ title, message, confirmLabel, destructive })` — returns
  `Promise<boolean>`, runs on the overlay engine. Use it *before* something
  consequential and destructive.

There is no `alert()`, `confirm()` or `prompt()`, and a contract keeps it that
way.

## PWA

Every path is relative, so the app works from any deployment sub-path without
modification. The service worker is network-first with a cache fallback, so a
fresh deploy is picked up as soon as there is a connection. It precaches
exactly `APP_FILES`, which `config:sync` writes into it, so the 3D library
is on the device for offline play from the first visit.

Cache cleanup on activate is filtered to this app's own prefix — deleting by
anything looser is how one deployment wipes another's cache on a shared origin.

The worker caches application code only. Everything a person creates lives in
`localStorage` and is never touched, so clearing caches cannot lose a record.

## Testing

`test/harness.js` reads `index.html` as text, extracts the largest `<script>`
block, and evaluates it in a Node `vm` against a DOM stub and an in-memory
`localStorage`. No browser, no jsdom, no dependency.

Top-level `const`/`let` create lexical bindings that do not attach to
`globalThis`, so a bootstrap bridges each name in `BRIDGE` to a live accessor.
**If you add a top-level binding a test needs to reach, add its name to
`BRIDGE`.**

`loadApp({ appId, sharedStorage, failWrites })` is how the collision and
storage-failure contracts run: two identities against one store, or a store
that refuses writes.

What the harness gives the game, so it can be tested without a browser:

- **Virtual time.** `setTimeout`, `requestAnimationFrame` and
  `performance.now()` run on one clock that moves only when a contract calls
  `ctx.__advance(ms)`. A frame requested during a frame runs on the next one,
  and a cancelled frame never runs. The template ran frames synchronously,
  which makes any animation that schedules its next frame recurse at boot.
- **A canvas.** `<canvas>` elements get a 2D context that counts calls, and
  records them with their arguments when `recording` is on. Pointer capture is
  tracked per element.
- **A screen.** `loadApp({ viewport: { width, height, dpr, insets },
  reducedMotion, search })` sets the screen, safe-area insets, motion
  preference and query string. `ctx.__resize()` and `ctx.__setReducedMotion()`
  change them mid-play, firing the same resize and `change` events a browser
  would. Design tokens come from the shipped `:root` block.
- **`window` is the global object**, as in a browser, so the overlay engine can
  find a sheet's close function by name.
- **No network.** `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`,
  `EventSource` and `Image` record instead of reaching anything.
- **Nothing fails quietly.** An exception inside a listener, timer or frame
  lands in `errors`.
- **The real Three.js, with a stand-in for the GPU.** `test/run.js` awaits
  `H.preloadThree()`, which imports the vendored `lib/three` build into Node
  once. The app's one `import(THREE_URL)` is rewritten to `__import(...)`,
  which answers at once with the real library, except that `WebGLRenderer`
  is `RendererStub`. So the scene graph, geometry, deformation, textures and
  camera are the shipped code running for real; only pixels are not made.
  The stub accounts for uploaded geometries and textures and forgets them on
  `dispose` (`info.memory`, like the real renderer), reports drawing anything
  after disposal, listens to its canvas before the app does and refuses to
  draw between losing its context and restoring it — the real renderer's
  order, which once hid a scene that was drawn too early on restore.
  `loadApp({ three: 'fail' | 'deferred', noWebGL: n })` gives a library that
  cannot load, one that loads when the test says (`app.gpu.resolve()`), and a
  device whose first n renderers cannot be created. Without
  `preloadThree()` the import never answers, which is all
  `scripts/config.js` needs.

Contracts are grouped by what they protect, in dependency order — identity and
storage first, because everything above them is meaningless if those are wrong.
The game's own contracts (20–29) run last. Aim for high-value contracts, not
volume. The harness cannot see a real browser's hit-testing or a real GPU, so
every touch surface is also exercised with real CDP input in headless Edge
against the real WebGL renderer (CLAUDE.md rule 43).

Texture generation loops keep their helpers in local names: a global lookup
inside a Node `vm` context is ten times slower than in a browser, and made
every boot of the suite a third of a second slower.

## The foundation → domain seam

The foundation reaches the product through exactly four points, declared
together just above the game section:

```js
const Domain = {
  hydrate(){},   // read your state out of Store
  render(){},    // paint your screens
  wire(){},      // attach your own listeners, once, at boot
  tabIcons: {}   // { <data-tab value>: '<svg path markup>' }
};
```

They are no-ops by default, so **deleting the game leaves an app that still
boots**, into a working but empty shell. `boot()` and `renderAll()` call only
these. A contract takes every name the game section declares and checks that
no foundation code uses any of them. The template's own check looked only for
names containing "item", which is how Backup & data came to depend on the demo
unnoticed.

Capybara Sushi claims them as: `hydrate` (nothing to read: nothing is saved),
`render` (re-measure and draw), `wire` (the stage's pointer, keyboard,
visibility, resize and reduced-motion listeners, attached once, and the 3D
scene's load) and `tabIcons` (none: play is one screen).

Two more things follow the same rule rather than being special-cased:

- **Which screens exist** is declared once, in the markup. Capybara Sushi
  declares one `.view` and no tab bar; `switchTab()` stays as foundation and
  refuses a screen that does not exist.
- **Backup import** merges whatever collections the backup file itself
  declares, recognising a record by it having an `id`, so import cannot
  silently restore nothing while reporting success.

## The slicing game

The `GAME DOMAIN — Slicing` section, in the order a touch travels through it:

| Part | What it owns |
|---|---|
| `TUNING`, `TUNING_SPEC` | Every feel value, and the only values `?tune` accepts, including the three Jiggle values (strength, softness, settling). Hypotheses, not requirements. |
| `SLICE` | Rules rather than feel: the minimum piece, the most a guide may pull, the knife's slop above and below the roll, spring frequency, fade times. |
| `SCENE` | The 3D presentation: sizes in world units (the roll's radius is 1), the camera's angle and distance, the jiggle's springs and impulses (which the Jiggle values scale), the pixel budget and the recovery limits. Nothing here changes where a cut lands. |
| Model | A roll is `{ id, n, cuts }`. Pieces are derived (`piecesOf`), never stored. `planCut()` decides where a stroke really cuts, or refuses it; `cutTarget()` always finds a legal cut while the roll is unfinished, which is what makes every roll finishable. |
| Layout | `computeLayout()` sizes the roll so that, fully cut, it fits the safe area on any tablet or phone, either way up, and places a camera to show it at exactly that size: a fixed angle and distance, with only the scale (`ppw`, pixels per world unit) changing. `project()` is that camera, in the game's own arithmetic. The safe-area insets come from an invisible probe, because a canvas cannot read `env()`. |
| Geometry | `pieceRects()` is the one answer to "where is the food". Each piece has a pose in the world (its slide, a tip over one bottom edge, its rock, a hop) and its rectangle is that pose projected. The 3D scene places each piece's meshes from exactly this pose, and `pieceAt()` hit-tests the rectangle, so a moving, tipping piece is cut where it appears. Every point on the roll's axis is the same depth from the camera, which is what keeps this flat geometry exact. |
| Gesture | One pointer owns the knife. `feed()` clips each segment to the roll's band, so a sparse flick still crosses it; `tryCut()` cuts the moment a pass is deep and steep enough over real food. A stroke cuts at most once. |
| Motion | Springs (`stepMotion`), the jiggle, and the finished-roll beat (`stepPhase`: ready → done → clear → enter → ready), all on one clock. The jiggle is one soft body (`wobble`): a squash value at 41 points along the roll, joined to their neighbours so a push travels as a wave, each point drawn gently back to rest, and a cut parting two points for good. Impulses add to whatever is moving, so quick cuts blend. Each piece also tips and rocks on its own springs, held clear of its neighbours. At the gather the finished roll is served: the pieces hop, the board slides away under them and the plate slides in, all inside the same 650 ms beat. Reduced motion settles all of it and drops the hop and the sliding, live. |
| Frames | `requestFrame()` keeps at most one frame waiting, and none when nothing moves. `onFrame()` caps a step at 50 ms and restarts the clock after any pause. The 3D scene is drawn only while something in it moves (`sceneMoving()`), so an idle hint animates the flat layer without redrawing the scene. |
| Lifecycle | `pausePlay()` / `resumePlay()` for hiding the page, for the tuning sheet, and for the scene (`'scene'`: loading, a lost GPU context, or unavailable), so the knife never meets food that is not on screen. No stroke survives a pause and no time passes during one. A resize ends the stroke and settles motion; cuts keep their proportions because they are stored as fractions of the roll. |
| HUD | The flat layer on the stage canvas over the scene: guide ticks, the knife's incision and trail, the hint, the finished mark. It draws nothing unless the scene is showing. |
| Scene | Three.js. `loadScene()` imports the library; `makeRenderer()`, `buildWorld()` (lights, fog, the counter, board, plate and their soft blob shadows, the shared textures and materials) and `sceneReady()` follow. Each piece is a view: its nori side with softly rounded ends, and two filled faces (nori rim, rice, salmon), built from its share of the roll and replaced when a cut splits it, disposing what it replaces. `deformView()` squashes the vertices from the jiggle, anchored on the board. Textures are computed from the tokens and a seeded pattern. A lost context pauses play and asks for the context back; if it does not return, a fresh renderer on a fresh canvas is tried, at most `SCENE.rebuilds` times, and then the scene says it is unavailable, with a way to try again. |
| Hint | After `hintS` quiet seconds, a ghost finger swipes where `cutTarget()` says a cut can go, or a still picture of it with reduced motion. |
| Tuning UI | The `?tune` developer sheet, on the overlay engine. |

The contracts for all of this are 20–29 in `test/contracts.js`. The feel
itself is not something a contract can judge: [docs/DEVICE-QA.md](docs/DEVICE-QA.md).

## The vendored library

`lib/three/` holds Three.js r186 (npm `three@0.186.1`): `three.module.js`,
`three.core.js` and `LICENSE`, byte for byte as published.
`lib/three/package.json` records the version, the source tarball, its npm
integrity and a SHA-256 for each file, and tells Node the folder holds ES
modules; browsers ignore it. `.gitattributes` keeps git from changing the
files' line endings. Contract 29 checks the hashes, the licence, the version
the app actually loads, and that the files are precached.

The published package has no minified build at this version, so the two
files are 2.1 MB unminified (about 0.45 MB compressed on the wire), fetched
once and then served by the service worker. The build uses class static
blocks, so it needs Safari 16.4 or newer; older browsers get the scene's
"unavailable" note instead of a blank screen.

To update it: take `build/three.module.js`, `build/three.core.js` and
`LICENSE` from the new npm tarball, record the new version, integrity and
hashes in `lib/three/package.json`, and run `npm run verify` and the browser
QA.

## Where things go

| You are adding | Put it |
|---|---|
| Anything a child plays | The game section, behind the `Domain` seams |
| A feel value | A `TUNING_DEFAULTS` entry and a `TUNING_SPEC` line |
| A colour the scene or the flat layer uses | A layer-4 token, listed in `COLOR_TOKENS` |
| A file the app loads | An `APP_FILES` entry, then `npm run config:sync` |
| A destination opened from a row | A `.overlay.overlay-page` + `open*/close*` pair |
| A decision or short form | A `.overlay` sheet |
| Persistent state | A key in `KEYS`, under `data.` or `ui.` |
| A data shape change | Bump `DATA_SCHEMA_VERSION`, add a migration |
| A new primitive | Only if the product actually uses it |
| A release | An `APP_UPDATES` entry, then `npm run config:sync` |

The `GAME DOMAIN — Slicing` section is the product. Nothing outside it names
anything declared inside it.
