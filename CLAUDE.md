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
2. **Never hard-code a font size, font family, or colour.** Use the tokens. A
   genuine exception is marked `/* fs-exempt: reason */` on the lines above it.
3. **Never add a lock/unlock pair to an overlay.** The engine's observer handles
   scroll lock, focus, stacking and ARIA. A hand-rolled pair reintroduces the
   bug the engine exists to prevent.
4. **Never touch `localStorage` outside the storage adapter.** Anything else is
   an unnamespaced key and an origin collision waiting to happen.
5. **Never edit `sw.js`, `manifest.webmanifest` or the derived `<head>` block by
   hand.** Edit `APP_CONFIG`, run `npm run config:sync`.
6. **Never reference a path outside the repository** in application or tooling
   code. The starter is self-contained.
7. **No `alert()`, `confirm()` or `prompt()`.** Use `toast()` and
   `confirmAction()`.
8. **No new dependency, framework, or build step** without the user explicitly
   asking for one. The value here is proven behaviour, not stack novelty.

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
    The renderer paints it and the knife is tested against it, so a moving
    piece is cut where it appears. A gap holds no food. A cut is refused rather
    than leave a piece under `SLICE.minShare` of an ideal piece.
37. **Every roll can be finished.** `SLICE.minShare` stays at or below 0.5. The
    proof is in `cutTarget()`'s comment, and contract 20 plays thousands of
    random rolls against it. Changing the cutting rules means keeping this
    true, not adding a recovery system.
38. **Imperfect stays imperfect.** A cut moves at most `SLICE.maxPull` of the
    way to a guide, and only toward a guide in the same piece.
39. **Essential feedback survives reduced motion; decoration does not.** A cut
    always shows its gap and lit faces. A finished roll always shows its plate
    and mark. Springs, overshoot, the tap jiggle, sliding and the moving hint
    are decoration, and stop, live, when motion is reduced.
40. **Frames only while something moves.** `requestFrame()` keeps at most one
    frame waiting, and none at rest. One clock drives everything, capped at
    50 ms a frame and restarted after any pause, so coming back from the
    background never makes anything jump. A pause (hidden, or the tuning sheet)
    keeps play in place and lets no time pass.
41. **Feel values live in `TUNING`, rules in `SLICE`.** A new feel value is a
    `TUNING_DEFAULTS` entry and a `TUNING_SPEC` line. Nothing else types a
    number that sets how slicing feels.

## Development

42. **`?tune` is a developer route, not a setting.** It must be removed, or
    moved behind the parent gate, before any child-facing release. Its values
    live in memory only.
43. **Test touch with real input.** The contracts dispatch pointer events
    straight at the stage and cannot see CSS hit-testing. Browser QA drives
    headless Edge with CDP touch, mouse and pen input. Pace scripted drags at
    about 16 ms a move, and let a stroke come to rest before tapping: Chromium
    swallows a tap that follows a fling.
44. **Nothing on this machine is a tablet or a phone.** Say what was not
    physically tested, every time. How slicing *feels* is a human judgment
    made on a device ([docs/DEVICE-QA.md](docs/DEVICE-QA.md)).
45. **The residue scan rejects the word loop in capitals, and cool down written
    as one word.** Both come naturally in game code. Call them a frame
    scheduler and a settle.
