# Capybara Sushi — the product

## What it is

A cozy children's game set in a tiny Tokyo neighbourhood. The player helps a
calm capybara chef run a sushi restaurant. The central experience is
satisfying sushi slicing:

> order → slice → pieces separate → chef reacts → plate → serve → next roll

Every cut should feel good through responsive input, movement and timing, and
eventually through sound and optional haptics. Imperfect cuts are still
accepted, and the chef stays warm and unbothered.

## Permanent rules

- No ads, in-app purchases, chat, accounts, analytics or data collection.
- No fail states, no punishing timers, and no punishment for imperfect cuts.
- Core play works without reading.
- Grown-up settings belong behind a parent gate.
- Respect reduced motion, and allow sound and haptics to be turned off.

How the code keeps these is in [CLAUDE.md](../CLAUDE.md), rules 29–33, and
contract 27.

## Audience and devices

The working audience is children of roughly 4 to 9. The exact age range and
target devices are still open. Working assumption: **tablets first, phones
usable, both orientations**. The manifest allows any orientation.

## Visual direction

Soft 3D clay-toy styling: rounded shapes, warm lighting, a miniature diorama, a
chunky capybara chef and appealing simplified sushi, after the Notion product
brief and moodboard. **Since Phase 1A the scene is real 3D, drawn with
Three.js (WebGL 2)**, vendored locally; the Phase 0B prototype used Canvas 2D.
Since Phase 1B it is seen three-quarters on, so the food's inside shows: soft
rounded forms, warm light, matte nori, gently textured rice and glossy,
simplified fish. Since Phase 1C Chef Capybara stands behind the counter: a
chunky, pear-shaped capybara in matte clay, with a long, blunt muzzle and a
darker snout, small rounded ears, calm bead eyes, stubby arms with darker
paws, a tall puffy hat and an indigo apron.

## Roadmap

0. Foundations and a slicing prototype. **(0B: gray-box prototype, v0.1.0.)**
1. One polished roll and counter, with satisfying slicing and chef reactions.
   **(1A: the first 3D slicing scene, v0.2.0. 1B: appearance, camera and
   motion, v0.3.0. 1C: Chef Capybara, v0.4.0. Praise, slice juice and the
   sound and haptics switches, v0.5.0.)**
2. Customers, orders, more rolls, plating, short shifts.
3. Rewards, recipes, decorations, outfits, local save.
4. A small Tokyo neighbourhood.
5. Playtesting, audio, accessibility, offline and launch polish.

## Phase 0B — the gray-box slicing prototype

A plain rectangle that the player swipes across and cuts into pieces, to
prove the interaction before any artwork is made. The work was to explore
slow and fast swipes, forgiving cut accuracy, how the pieces separate, and
timing.

**Success means repeatedly slicing a plain shape feels satisfying.** That is a
judgment a person makes, by hand, on a real device ([DEVICE-QA.md](DEVICE-QA.md)).
The automated contracts prove the behaviour is correct; they cannot prove it
feels good.

What the prototype does:

- One plain roll of six pieces (a hypothesis, tunable from 4 to 8), with
  subtle guide ticks where a cut can go.
- A swipe cuts during the crossing, before the finger lifts. Slow drags and
  fast, sparsely sampled flicks both work. Each gesture makes at most one cut.
- Imperfect cuts are kept, pulled only part of the way toward a guide.
  Incomplete strokes, taps and invalid gestures cost nothing.
- Pieces spring apart. A finished roll gathers on a plate under a check mark,
  clears away, and a new roll arrives.
- A ghost-finger hint shows the swipe after a quiet moment. Space, Enter or
  the down arrow also cut.
- Reduced motion keeps every essential signal (the gap, the lit cut faces, the
  plate and mark) and drops the decoration, including when the setting
  changes mid-play.
- A developer-only `?tune` sheet adjusts cut forgiveness, guide attraction,
  separation and transition timing in memory.

Deliberately not in this phase: chef artwork, customers, economy, recipes,
neighbourhood, sound, haptics, saved progress, final branding and final icons.

## Phase 1A — the first 3D slicing scene

The same slicing, in one polished 3D scene, after the playtest said cutting
and pacing felt good but the roll was too stiff and too flat.

- One salmon maki roll on a softly bevelled honey-wood board, on a warm
  cream counter, with a sage-green plate for the finished pieces. A fixed,
  slightly raised camera; no camera controls in play.
- The roll is a rounded, slightly lumpy solid: dark green, mostly matte nori
  with a soft sheen, rice bulging from its two ends, and at every cut a filled
  face of nori, rice and salmon. Textures belong to the materials and are
  computed from the design tokens.
- The roll moves as one soft body. The knife squashes it where it goes in, a
  wobble travels along whatever is still joined, the two sides of a cut tip
  apart and rock back, and each separated piece settles on its own. Quick cuts
  add to the motion rather than restarting it, and it all comes to rest.
- A finished roll is served inside the same beat as before: the pieces hop,
  the board slides away under them, the plate slides in, and they land on it.
- The swipe, its forgiveness and the pace between rolls are unchanged, and so
  are the rules that keep every roll finishable.
- `?tune` gains Jiggle strength, softness and settling.
- Landscape first; portrait still plays. The scene never stretches, respects
  safe areas, and draws only while something moves, within a pixel budget.
- If the device cannot start WebGL, or loses its context, the screen says so
  calmly and recovers, a bounded number of times.

Deliberately not in this phase: the chef, customers, restaurant systems,
sound, haptics and more recipes.

## Phase 1B — sushi you can see inside

The playtest liked the cutting and the pace but found the first 3D scene
stiff and flat; a review of it found the side-on camera hid the rice and
salmon, the nori looked smooth and uniform, and a long green cylinder filled
the picture. Phase 1B keeps the interaction and changes how the food looks
and moves. None of it is approved until it has been seen on a device.

- **A three-quarter camera.** It stands to the right of the roll and above
  it, and its picture is turned less than the camera itself (a shifted
  lens), so the roll's near end shows its rice and salmon and every cut face
  can be seen, while the roll lies within about 5–7 degrees of level for the
  same downward swipe. No camera controls, shake or dramatic perspective.
- **The knife follows the camera.** Every touch is carried through the
  camera onto the roll's own upright plane, where the rules of a cut are
  measured as before; guides, the hint and the incision are drawn through
  the same camera, so what is drawn is where the knife cuts, near, middle
  or far.
- **Framing.** Landscape shows the food large and, where it costs the food
  little, the whole board and plate. Portrait makes the food as large as the
  width allows and stands the plate behind the board, where the pieces hop
  back onto it, instead of leaving most of the screen as empty counter.
- **The food.** Deep green, matte nori with a fine irregular texture, a soft
  broad sheen and a wrap seam; the nori's own band round every face; plump
  short-grain rice with deeper grains between; a softly squared, glossy
  salmon with restrained pale bands, set a little differently in every
  piece. The proportions stay: a piece is about 0.7 of its width long, a
  chunky clay maki, with room for six comfortable cuts.
- **Motion.** The soft-body jiggle is unchanged in strength and timing; each
  cut now reacts a little differently, and a quick flick snaps a little
  harder than a slow drag.
- **Serving.** Finished pieces go to the plate in one row, in cut order, at
  their real sizes, each on its side and turned so its face shows; no
  towers, no stacking, and no two ever touch.

The swipe, its forgiveness, the pace between rolls and every tuning value
are unchanged. Deliberately not in this phase: the chef, customers,
restaurant systems, sound, haptics and more recipes.

## Phase 1C — Chef Capybara joins the slicing scene

One character, so the player feels they are helping a calm, friendly chef.
"Chef Capybara" is a working name; a personal name is still to be decided.
Neither the chef nor the food is approved until it has been seen on a device.

- **The character.** Built after the approved moodboard figure: a chunky
  pear of a body, a long blocky head with a broad, blunt muzzle and a darker
  snout, small rounded ears set high and back, glossy bead eyes with a spark
  of light under a soft brow, stubby arms with darker paws, a tall puffy
  hat and an indigo apron. The eyes are larger than the reference's slits,
  as the moodboard asks, so the face reads at phone size. It is real 3D in
  the same Three.js scene, made of smooth shapes baked into a dozen meshes,
  with no new library, asset or download.
- **Where it stands.** Behind the counter, which now ends in a soft edge
  behind the food; the edge hides the chef below its waist or shoulders.
  It never shows where the knife goes, from above where a swipe starts to
  below where it ends, and its face never shows behind the served pieces or
  the finished mark. On tablets and upright phones it stands across the
  counter above the food, and on tablets the food moves down to make room,
  at the same size. On a phone held sideways, where the food fills the
  screen, it stands small beside the roll's near end. The camera and the
  food's size are unchanged.
- **How it reacts.** At rest it is calm, and now and then blinks, flicks an
  ear or glances at the player. While a finger is down it leans in a little
  and its head follows the knife along the roll. Every cut, neat or not,
  gets a small, pleased nod with a contented squint and smile; quick cuts
  make one longer nod, not a string of them. A finished roll gets delight —
  happy closed eyes, a wider smile, a blush, a small rise and lifted paws —
  inside the serving beat, and it is calm again as the next roll arrives.
  It never frowns, scolds or judges, and it never holds play up.
- **Reduced motion.** Its face still changes, but it does not move.

The swipe, its forgiveness, the camera, the food's size and every tuning
value and timing are unchanged. Deliberately not in this phase: customers,
orders, an economy, the neighbourhood, sound and haptics, a naming screen.

## Decisions so far

- APP_ID `capybara-sushi`, name **Capybara Sushi**, short name **Capy Sushi**
  (the home-screen label is limited to 12 characters).
- The existing web/PWA foundation; touch, mouse and pen through Pointer
  Events. Phase 0B drew with Canvas 2D and no dependencies.
- Phase 1A, with the user's approval: Three.js r186 (npm `three@0.186.1`),
  pinned and served from this app's own folder, never from a CDN; no other
  framework, physics engine or build step. It needs WebGL 2 and, on iPhone
  and iPad, iOS or iPadOS 16.4 or newer.
- Phase 1B: a three-quarter camera with a shifted picture, and hit testing
  on the roll's own plane through that camera; the plate waits behind the
  board in portrait. No new dependency.
- Phase 1C: Chef Capybara, built in the same scene from smooth shapes, with
  no new dependency or asset. The counter gained a back edge, and the food
  moves down on tablets to make room above it, never shrinking.
- Gameplay and tuning are kept in memory; nothing about play is saved. Since
  0.5.0 the one stored thing is a grown-up's sound and haptics choice.
- 0.5.0: cuts are praised Nice, Great or Perfect from where the swipe went,
  before the guide's pull; sound is made on the device with no files; haptics
  use the Vibration API where it exists and are honestly absent on iPhone and
  iPad; the parent gate is a times-table question.
- Gray-box visuals and the placeholder icons.
- Phase 0C, with the user's approval: pushed to `main` and published on GitHub
  Pages as a development preview for real-device playtesting
  (<https://morecobrax-dot.github.io/Capybara-Sushi/>). It is not a release
  for children. Every later push still needs the user's approval.
