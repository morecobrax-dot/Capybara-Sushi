# Development method

Instructions for AI coding sessions in this repository. These override default
behaviour.

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing architecture,
[PRODUCT-DESIGN.md](PRODUCT-DESIGN.md) before changing anything a user sees,
and [docs/PRODUCT.md](docs/PRODUCT.md) for what Capybara Sushi is and is not.
Capybara Sushi's own rules are at the end of this file.

---

## Before implementing a feature

In this order:

1. Read [docs/PRODUCT.md](docs/PRODUCT.md) — the product, its permanent rules
   and the current phase.
2. Read [PRODUCT-DESIGN.md](PRODUCT-DESIGN.md) — the rules the UI must obey.
3. Read [ARCHITECTURE.md](ARCHITECTURE.md) — what already exists, so you do
   not rebuild it.
4. If the phase brief leaves a requirement open, ask before writing code.
5. **Separate foundation from domain before you type.** Name which parts of the
   change are product-specific and which are genuinely reusable.

### The foundation-modification rule

**A product-specific need stays in the product.** Do not change generic
foundation code because one product wants something. Add it in the domain
section, behind the `Domain` seams.

Only upstream a change to the foundation when it is reusable *on its own terms*
— when a second, unrelated product would want it identically. If you are
unsure, it is not reusable yet. Leave it in the product; it can be promoted
later, by hand, after a second product proves the need.

This rule exists so a savings app does not slowly turn a general foundation
into a finance framework. The same applies in the other direction: never add a
domain concept — a transaction, an account, a category — to the storage
adapter, the overlay engine, toast, confirmation, or navigation.

### No dependency linkage

A product created from this starter is **independent**. Never introduce a git
submodule, an npm package, a shared remote runtime, or any automation that
pulls starter changes into a product or pushes product changes back. Copy the
knowledge, then own the product.

## Workflow

```
AUDIT → UNDERSTAND → IMPLEMENT → ADVERSARIAL VERIFY → DIFF AUDIT → SHIP → REPORT → STOP
```

- **Audit** the existing code before proposing a change. Read the thing you are
  about to modify, and the thing that calls it.
- **Understand** why it is the way it is. Nearly every unusual line here carries
  a comment naming the failure that caused it. If you are about to remove
  something that looks redundant, find that comment first.
- **Implement** the requested change, and only that change.
- **Adversarially verify.** Try to break what you built. Repeat it a hundred
  times. Open it, close it, rotate it, refresh mid-edit, deny it storage.
- **Diff audit** before shipping. Read the whole diff. Every surviving line
  should have a reason to exist.
- **Report** what you did, what you verified, and what you did not.
- **Stop** at the requested phase. Do not begin the next one.

## Before changing anything

1. **Run the baseline first.** `npm run verify` before you start, so you know
   whether a failure is yours.
2. **Find the current source of truth before adding another one.** If you are
   about to declare a value, search for it first. Identity, tokens, storage
   keys, release history and overlay state each have exactly one owner, and a
   contract enforces it.
3. **Prefer extending an existing system to creating a parallel one.** A second
   overlay mechanism, a second storage wrapper or a second version constant is
   a defect, not an addition.
4. **Do not redesign unrelated surfaces during targeted work.** If you notice
   something else, say so; do not fix it in the same change.

## Hard rules

1. **New code goes in the largest inline `<script>` block.** A second block or
   a linked file is invisible to every contract, and the suite will still pass.
   The one exception is the vendored Three.js build in `lib/three`, loaded by
   the script's single `import()`. It is third-party code, unmodified and
   hash-checked; none of this app's own code may live there or anywhere else
   outside the script (rule 47).
2. **Never hard-code a font size, font family, or colour.** Use the tokens. A
   genuine exception is marked `/* fs-exempt: reason */` on the lines above it.
3. **Never add a lock/unlock pair to an overlay.** The engine's observer handles
   scroll lock, focus, stacking and ARIA. A hand-rolled pair reintroduces the
   bug the engine exists to prevent.
4. **Never touch `localStorage` outside the storage adapter.** Anything else is
   an unnamespaced key and an origin collision waiting to happen.
5. **Never edit `sw.js`, `manifest.webmanifest` or the derived `<head>` block by
   hand.** Edit `APP_CONFIG` (or `APP_FILES`, the files the service worker
   precaches), run `npm run config:sync`.
6. **Never reference a path outside the repository** in application or tooling
   code. The starter is self-contained.
7. **No `alert()`, `confirm()` or `prompt()`.** Use `toast()` and
   `confirmAction()`.
8. **No new dependency, framework, or build step** without the user explicitly
   asking for one. The value here is proven behaviour, not stack novelty.
   Phase 1A authorized one narrow exception: Three.js, pinned and served from
   this app's own folder. It is not an npm dependency, it is never loaded from
   a CDN, and it brings no physics engine, framework or build with it.

## Product rules

9. **Tablets first, phones usable, either way up.** Design for a tablet in a
   child's hands, and keep a phone playable in portrait and landscape.
10. **≥44px actionable touch targets.** The visible mark may be smaller.
11. **≥16px editable inputs**, or iOS Safari zooms and does not zoom back.
12. **Respect safe areas** on all four edges, through the `--inset-*` tokens.
13. **Respect `prefers-reduced-motion`** on every animation, not most of them.
14. **One visible action, one predictable outcome.** Validate before mutating.
15. **Truthful empty and unknown states.** Absent is not zero. A missing key is
    a new user, not a corrupted one, and is never repaired with a default.
16. **No fake precision.** Do not present a number the data cannot support.
17. **Do not persist derived values.** Store the record; compute the
    presentation. A stored total can disagree with its parts.
18. **Preserve backward compatibility** wherever product data already exists.
    A shape change means a migration, not a reinterpretation.

## Testing

19. **Add regression coverage for every real defect**, in the same session that
    fixes it. Name the contract after the failure it prevents, not the function
    it calls.
20. **Run adversarial tests** — repetition, nesting, refresh mid-action, denied
    storage, corrupt input, empty and enormous collections.
21. **A contract that cannot be described as "this prevents X" should not
    exist.** Optimise for value, not for count.
22. **If you add a top-level `const`/`let` a test must reach**, add its name to
    `BRIDGE` in `test/harness.js`, or it will be invisible.

## Shipping

23. **Verify live behaviour**, not just the local file. Install it, load it
    offline, check the cache and storage names in DevTools.
24. **Compare the deployed bytes to committed source**, not to a
    line-ending-modified working copy — on Windows the working tree is CRLF and
    will report a false mismatch. Compare the git blob.
25. **Update `APP_UPDATES` on every real release**, then run
    `npm run config:sync`. The newest entry is the version; the cache name
    derives from it. Skipping this ships an app that cannot invalidate its own
    cache.
26. **`npm run verify` must be green before any commit or push.**

### Mission Control status

`PROJECT-STATUS.json` at the repository root is this project's public status.
Mission Control reads it from `main` on GitHub (raw.githubusercontent.com) and
shows it on its hub. Update the file, and commit it with the work, at each of
these milestones:

- implementation completed
- QA required
- a decision or a blocker identified, or cleared
- release verified — only after production has been checked, never on the
  push alone

Only pushed commits reach Mission Control. Work that is not committed and
pushed does not appear there, whatever the file says locally.

The file is public. Write short, plain summaries only: never a conversation or
session link, a credential, a local path, private details or anything from a
private repository. Write what the repository shows, leave a fact `null` when it
is not known, and never infer a status from commit counts, tests or a version
number.

Schema 1, every key present: `schemaVersion` 1; `appId` `"capybara-sushi"`;
`version` and `phase` (text or null); `status`, one of `planning`, `building`,
`release_ready`, `stable`, `paused`; `needsQa` and `needsDecision` (true or
false); `currentTask`, `nextAction` and `blocker` (text or null — a blocker
means the project is blocked); `updatedAt` (ISO 8601 UTC, the moment you
changed the file). Limits: version 24 characters, phase 48, currentTask 280,
nextAction 200, blocker 200. Mission Control refuses a file that breaks any
rule and keeps showing the last valid one.

## Scope

27. **A product-specific need stays in the product.** See the
    foundation-modification rule above. Do not generalise on the first use.
28. **Stop at the requested phase.** Finish it completely, report, and wait.
    Do not start the next phase, do not "while I'm here", do not polish the
    prototype into a product.

---

# Capybara Sushi's own rules

These come from the product brief and from building the Phase 0B slicing
prototype. Each carries its reason; keep the reason with the rule.

## Permanent rules (from the brief)

29. **No ads, in-app purchases, chat, accounts, analytics or data collection.**
    Loading the app and its own service-worker files is the only network
    traffic. Contract 27 fails on any other request, tracker name or outbound
    link.
30. **No fail states, punishing timers, or punishment for imperfect cuts.** A
    stroke either cuts or does nothing. A roll never expires. The game keeps
    no score, lives or misses (contract 27).
31. **Core play works without reading.** The stage draws no text. The gesture
    is taught by a hint that shows it; words exist only for assistive
    technology.
32. **Grown-up settings belong behind a parent gate.** There is no gate yet
    because there are no grown-up settings. The developer `?tune` sheet is not
    one (rule 42). Backup & data and What's new open only from `?tune` until
    the gate exists.
33. **Respect reduced motion, and let sound and haptics be turned off.**
    Reduced motion is honoured live. There is no sound or haptics yet; when
    they arrive, each gets an off switch behind the gate.

## The slicing interaction

34. **The stage owns its pointer, and only the stage.** `touch-action: none` is
    set on the canvas and nowhere else. One pointer owns the knife from its
    press until it lifts, is cancelled, loses capture, or play is interrupted
    (hidden, resized, paused, the roll finished). Holding still never loses
    it: a child pauses mid-stroke. Extra fingers are ignored. Only a new
    *primary* pointer of the same type (the browser saying the old one lifted
    unseen) takes the knife back.
35. **A stroke cuts during the crossing, once.** A pass through the roll cuts
    the moment it is deep enough (`depth`), steep enough (`angle`) and lands in
    food. Release, cancel and lost capture never undo a cut and never add one.
    The release point can complete a crossing only if the stroke has not cut.
36. **One geometry.** `pieceRects()` is the only answer to "where is the food".
    Each piece's pose (slide, tip, rock, hop, and once served its spot and
    turn) is seen through the layout's camera on the roll's own upright plane,
    as a rectangle there; the 3D scene places the piece's meshes from that same
    pose, the finger is carried onto that plane through the same camera
    (`toRoll()`) and the knife is tested there, and the flat layer draws
    through the same camera (`toStage()`). So a moving piece is cut where it
    appears, and a guide is where it cuts. The Three.js camera is set from the
    layout's camera, and contracts 22 and 30 check they agree. A gap holds no
    food. A cut is refused rather than leave a piece under `SLICE.minShare` of
    an ideal piece.
37. **Every roll can be finished.** `SLICE.minShare` stays at or below 0.5. The
    proof is in `cutTarget()`'s comment, and contract 20 plays thousands of
    random rolls against it. Changing the cutting rules means keeping this
    true, not adding a recovery system.
38. **Imperfect stays imperfect.** A cut moves at most `SLICE.maxPull` of the
    way to a guide, and only toward a guide in the same piece.
39. **Essential feedback survives reduced motion; decoration does not.** A cut
    always shows its gap and lit faces. A finished roll always shows its plate
    and mark. Springs, overshoot, the jiggle, tipping and rocking, the hop and
    turn onto the plate, sliding and the moving hint are decoration, and stop,
    live, when motion is reduced: the pieces are simply on their spots.
40. **Frames only while something moves.** `requestFrame()` keeps at most one
    frame waiting, and none at rest. One clock drives everything, capped at
    50 ms a frame and restarted after any pause, so coming back from the
    background never makes anything jump. A pause (hidden, the tuning sheet,
    or the scene not showing) keeps play in place and lets no time pass. The 3D
    scene is drawn only while something in it moves; flat marks alone never
    redraw it. At rest the only movement is Chef Capybara's occasional idle
    gesture — a blink, an ear flick, a glance — each brief, on one timer, with
    quiet between (rule 55).
41. **Feel values live in `TUNING`, rules in `SLICE`, the 3D presentation in
    `SCENE`.** A new feel value is a `TUNING_DEFAULTS` entry and a
    `TUNING_SPEC` line. The three Jiggle values scale the springs and impulses
    in `SCENE`; nothing else types a number that sets how slicing feels.

## The 3D scene

46. **The scene draws; it decides nothing.** It reads the game's state and
    geometry and never changes them. Play waits (the `'scene'` pause) until
    the scene has drawn, and whenever it is not showing, so the knife never
    meets food that is not on screen, and the flat layer draws no marks over
    it.
47. **Three.js stays pinned, unmodified and local.** `lib/three` holds the
    published files byte for byte; `lib/three/package.json` records the
    version, source, integrity and hashes, and contract 29 checks them. Never
    load it, or anything else, from another host. Never edit it: this app's
    code lives in the one script. To update it, follow ARCHITECTURE.md.
48. **Everything made for a piece is disposed when the piece is replaced.**
    Shared textures, materials and shapes are made once per app. A piece's
    geometry and material clones die with it. Contract 23 counts GPU
    geometries and textures across a hundred rolls; the browser QA counts them
    in the real renderer.
49. **A lost GPU context is never a blank or frozen screen.** Play pauses, the
    counter's colour and a spinner show, and the browser is asked for the
    context back. If it does not return, a fresh renderer on a fresh canvas is
    tried, at most `SCENE.rebuilds` times, then the scene says it is
    unavailable and offers a way to try again. The app's canvas listeners are
    attached after the renderer's own: on restore Three.js rebuilds its state
    in its listener, and drawing before that draws nothing.
50. **Colours reach the scene only through tokens.** `COLOR_TOKENS` names
    every one; scene tokens are hex, because textures are computed from them
    pixel by pixel. Textures belong to their materials, so they squash and move
    with the food. None is downloaded.
51. **The camera is a three-quarter view, and nothing may assume it is not.**
    It stands to the right of the roll and above it, with its picture turned
    less than itself (a shifted lens): that shows the roll's near end and its
    cut faces while keeping the roll within about 5–7 degrees of level. On the
    glass the roll is neither level nor evenly scaled, so never compare a
    stage pixel with a position on the roll's plane, and never draw or hit-test
    in stage pixels what belongs to the roll. Contract 30 swipes on the glass,
    through the drawn guides and at the near, middle and far parts of the roll.
52. **Served pieces show their faces, keep their sizes, and never touch.**
    `plateSpots()` lays them in one row in cut order, each on its side and
    turned by at most `SCENE.serveTurn`, standing beside the last along its
    own length; the turn shrinks rather than let the row leave the plate or
    the stage. No towers, no stacking. Contract 31 checks a thousand uneven
    rolls and every moment of the hop.
53. **Only the food reflects the room.** The counter fills most of the
    screen: giving it reflections and full shading pushed a modest GPU from
    12 to 18 ms a frame. It is plain matte, the board and plate have no
    reflection, and contract 22 keeps it that way.

## Chef Capybara

54. **The chef covers nothing the player needs, and never shrinks the food.**
    It stands behind the counter's far edge (`layout.back`), which hides it
    below its waist or shoulders. `chefSpot()` fits it by spheres posed as
    the scene poses it (`chefPoses()`, `chefSpheres()`), so in every pose it
    takes none of it shows where the knife goes — the roll cut and spread,
    from above where the hint's swipe starts to below where it ends — its face
    never shows behind the served pieces or the finished mark, and its whole
    face and hat stay inside the safe area, above the counter. The food's
    scale is decided before the chef is placed; where the safe area has spare
    height the food moves down into it, only as far as the chef can use. It
    stands across the counter above the food where there is room, beside the
    roll's near end on a phone on its side, and on a tiny screen it stays
    away. Contract 32 checks the real model against all of it on a dozen
    screens.
55. **The chef only watches: nothing in play waits for it.** Its mood
    (`chef`) is springs and envelopes on the one clock (`stepChef()`),
    started by `commitCut()` and read from the finished-roll beat, so it never
    delays, blocks or changes a cut, never lengthens the beat, pauses with
    play and cannot replay. Quick cuts make one held nod, never a queue;
    delight takes the head over from a nod. It reacts to every cut alike and
    to nothing else — no score, no verdict, never a frown. At rest it blinks,
    flicks an ear or glances at the player on one timer (`armChef()`), with
    quiet between.
56. **With reduced motion, only the chef's face changes.** No nod, lean,
    turn, rise, lifted paws or idle gestures: contentment and delight show as
    a changed face, drawn once.

## Development

42. **`?tune` is a developer route, not a setting.** It must be removed, or
    moved behind the parent gate, before any child-facing release. Its values
    live in memory only.
43. **Test touch with real input, and the scene with the real renderer.** The
    contracts dispatch pointer events straight at the stage and cannot see CSS
    hit-testing or a GPU. Browser QA drives headless Edge (hardware GPU through
    ANGLE) with CDP touch, mouse and pen input, and checks what is actually on
    screen from screenshots, not only the app's own state. Pace scripted drags
    at about 16 ms a move, and let a stroke come to rest before tapping:
    Chromium swallows a tap that follows a fling. A fast beat (a cut's recoil,
    the serve) is checked while it happens, not after.
44. **Nothing on this machine is a tablet or a phone, or has an Apple GPU.**
    Say what was not physically tested, every time. How slicing *feels*, and
    how the jiggle looks and performs on an iPhone or iPad, is a human
    judgment made on a device ([docs/DEVICE-QA.md](docs/DEVICE-QA.md)).
45. **The residue scan rejects the word loop in capitals, cool down written as
    one word, and s-q-u-a-t (spelled out so this file passes).** All three come
    naturally in game code. Call them a frame scheduler, a settle, and a
    half-height.
