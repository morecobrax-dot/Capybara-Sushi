# Remaining work

None of this is done. It is listed so nothing here reads as finished.

## For a real classroom: the multi-device milestone (not built)

0.8.0 is a single-device development prototype. Before any real class uses
it, it needs a small authenticated backend, which has **not** been chosen,
provisioned or paid for. What that backend must do, whatever it is:

- **Teacher accounts and sign-in.** Real authentication (for example
  passwordless email or a school identity provider), sessions that expire,
  and sign-out on shared devices. The times-table question is a parent gate
  and must never be treated as teacher access.
- **Class-scoped authorization, checked on the server.** Every read and
  write is allowed only for a teacher of that class; a child device can only
  append events for its current class session; nothing trusts a class or
  child id sent by the client.
- **Classroom devices and child launch.** Enrolling a device to a class,
  short-lived class sessions, and the teacher-assigned avatar list; a child
  device never sees other classes or the teacher workspace.
- **Idempotent event ingestion.** Events keep their client ids
  (`<session>.<seq>`) as idempotency keys; the server records received time
  next to the device's time, accepts a batch more than once without
  doubling it, and keeps an offline queue's order. The current
  `data.learn.events.<session>` keys are the natural outbox.
- **Durable storage and versioning.** Append-only events, derived summaries
  recomputed by rule version, immutable published plans and report
  snapshots, and an audit trail.
- **Data handling before a pilot.** Minimum fields (display names or
  pseudonyms), retention and deletion, export, a privacy notice, and a
  review of the school's own obligations. Nothing here makes a legal or
  standards-compliance claim.
- **What the prototype does instead.** One prototype class and a DEMO class
  on one browser; the workspace says so on every screen.

## Before a learning release

- An educator reviews the counting activity, rule r1, the statuses' wording,
  lesson template t1 and the family report.
- Supervised usability sessions with children (Phase A).
- "With support" needs a reviewed support rubric for `count.quantity.1_5`.
- The other four stations (Phase D), each after its own content, access,
  rubric and lesson review.

## Known limits (0.8.0: the first connected learning slice)

- The workspace's records live in one browser's storage, shared with every
  app under `morecobrax-dot.github.io` (about 5 MB). Clearing site data
  deletes them; nothing is backed up but the developer's Backup & data.
- The prototype class's time zone is the device's at first use, and its
  calendar is Monday to Friday with no closures; neither can be edited yet.
- Only English. Chef Capy speaks only with an English voice installed on
  the device; where there is none it is silent and the picture carries the
  order. Which devices have one was not checked.
- The teacher workspace has no live teaching view and does not distribute
  plans: "publish" keeps a fixed copy on this device.
- In counting rounds the plate waits behind the board on every screen, and
  the order is on the dock's card; the cat's bubble is not drawn.
- **In landscape, on tablets, desktops and phones alike, the cat has no seat in counting rounds**:
  the dock takes the room it sat in, and the knife's ground fills the rest.
  The order card stands for it (its cat face is pleased when the plate
  arrives), and the plate slides off toward the dock. Held upright, the cat
  sits at the counter as before. Seating it in landscape needs the counter
  restaged for the dock, which is design work for a later milestone.
- The leftover piece of a roll stays on the board until the next customer
  comes; at a round's end it waits under the panel.
- `?tune`, Backup & data and What's new are still developer routes.

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
- Move Backup & data and What's new behind the parent gate (0.5.0 built the
  gate for the sound and haptics switches only). The rest of the Grown-up
  area card — reset progress, session length — is Phase 5 work.
- Haptics reach only browsers with the Vibration API (Chrome and Edge on
  Android); Safari on iPhone and iPad has none, so there is no haptic there.
  Whether a device actually vibrates cannot be known from the page.
- The foundation's "this browser is not saving" notice is not used; since
  0.8.0 the teacher workspace says on every screen whether records are being
  kept on this device.
- All apps under `morecobrax-dot.github.io` share one origin. `APP_ID` keeps
  their storage and caches apart, but they share one browser storage quota
  (about 5 MB), and Cache Storage too. That matters once Phase 3 saves
  progress; the 3D library alone is 2.1 MB in this app's cache.
- Devices on iOS or iPadOS older than 16.4 cannot run the 3D scene (it shows
  a note instead). If they matter, an older Three.js release would need a
  deliberate decision.

## Known limits (0.7.0: the first customer)

- One customer, one order: the Animal customer cast card is partial (no
  other animals, personalities or outfits), and there are no shifts.
- On a phone held sideways the wall behind the counter has no room for the
  cat, so it waits off the counter's end: its order stands at the counter's
  end pointing off the stage, steps aside while the served plate is on show
  and on its way, and shows a heart when the plate reaches it.
- The noren gives way to the cat on phones held upright, so it now shows on
  tablets only.
- The delivered plate may run partly off the stage's edge in front of the
  cat on some screens; it never covers a face or the order.
- From the last cut to the next roll now takes 2.1 s (0.6.0: 1.25 s).

## Known limits (0.6.0: noren and breathing)

- The noren shows on tablets and phones held upright; on a phone held
  sideways the wall behind the counter is too thin and it is left out.
- At rest the chef's breath keeps frames running and the scene drawn about
  14 times a second (0.5.0: about 7, for idle gestures only); the flat layer
  is not redrawn for it. Measured on a desktop GPU, not a device.
- A roll's last stars may sit below or above the food, or beside it, rather
  than over the cut, and last no longer than the finished roll shows.

## Known limits (0.5.0: praise, sound and haptics)

- The rating thresholds (a tenth and a quarter of a guide spacing, with 7 and
  16 px floors) are first guesses for a hands-on trial: they are in `RATING`,
  not in `?tune`. Whether children find them encouraging is untested.
- Sound starts only after a finger lifts or a key is pressed, as browsers
  require, so the first cut of a visit is silent. The sounds are synthesized
  and were measured, not listened to on a device.
- Keyboard cuts land on their guide and are always Perfect.
- The chef has no separate shrug for a Nice cut: every cut gets the same warm
  nod, and a Perfect a brighter face.
- At a Perfect cut the squash wave and the faces' glow run slower for about
  0.4 s; the pieces and the beat do not.

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
