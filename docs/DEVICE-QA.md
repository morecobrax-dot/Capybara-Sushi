# Device QA — noren, breathing, praise (0.6.0)

**Status: not done on a device.** Nothing on this list has been tried on a
real phone or tablet. Browser QA ran in headless Edge on Windows, on an Intel
integrated GPU through ANGLE (Direct3D 11), with browser-dispatched touch,
mouse and pen input. That is simulated input on a desktop GPU, not an
iPhone, an iPad or Safari. Record the device, OS and browser version, and the
date, next to every result.

**What a device needs.** WebGL 2, and on iPhone and iPad, iOS or iPadOS 16.4
or newer: the Three.js build uses JavaScript that older Safari cannot read.
An older device shows a short note and a try-again button instead of the
kitchen. The first visit needs a connection; after that the library is kept
on the device for offline play.

## Getting it onto a device

- **GitHub Pages, for everything.** <https://morecobrax-dot.github.io/Capybara-Sushi/>,
  and `?tune` on the end for tuning. It uses HTTPS, so the service worker,
  offline play and home-screen install all work there. Pages can take up to
  10 minutes to show a new push. The identity panel in `?tune` shows which
  version a device is running (0.6.0 for this phase).
- **Same Wi-Fi, for quick feel testing.** On the PC, run
  `npx --yes http-server -p 8395 -c-1 .` in the repository. On the device,
  open `http://<the PC's local IP>:8395/`. A plain-http address is not a
  secure context, so the service worker, offline play and a proper
  home-screen install cannot be tested this way.

## Judging the feel and the look (hands-on)

Play at least five rolls for each line, first as you normally would, then as
a young child might.

The slicing, which should feel as it did in 0.1.0 and 0.2.0:

- [ ] A slow, deliberate drag cuts at the moment the finger crosses, and a
      quick flick cuts every time.
- [ ] A sloppy swipe still cuts, and where it lands looks like yours.
- [ ] Stopping partway, tapping, or swiping along the roll does nothing, and
      never feels like a telling-off.
- [ ] Cutting fast, before the last cut has settled, still lands where you
      aim, including on a piece that is still tipping.
- [ ] The pace between rolls (finished roll shown, clear, next roll) still
      feels like a reward and not a wait.
- [ ] The three-quarter view does not make aiming harder: swipe straight down
      through the guides at the far (left) end, the middle and the near
      (right) end, slowly and as a flick. Each cut lands where the finger
      crossed the roll, on a phone held either way as well as a tablet.

The new movement and look:

- [ ] The knife's squash, the wobble along the roll, the two sides tipping
      apart and the rock back read as one soft, springy roll — satisfying,
      not rubbery, sluggish or jittery. Try Jiggle strength, softness and
      settling in `?tune`.
- [ ] Separated pieces settle on their own, and quick cuts blend rather than
      restart.
- [ ] Nothing floats above the board or sinks into it, and no piece passes
      into its neighbour.
- [ ] The roll looks like appetising sushi at a glance: the near end shows
      rice and salmon; the nori is deep green and matte with a fine texture
      and a soft sheen, not a smooth plastic tube; the rice reads as grains,
      not foam or gravel; the salmon is warm, glossy and clearly salmon.
- [ ] Every cut shows its faces as the pieces part, and each served piece
      shows its face on the plate. The pieces' proportions look like maki.
- [ ] No two cuts look stamped alike: a quick flick snaps a little harder
      than a slow drag, and the jiggle is no stronger than in 0.2.0.
- [ ] The hop onto the plate and the plate leaving feel like serving. With a
      phone held upright, the plate waits behind the board and the pieces hop
      back onto it: does that read well, and is there still too much empty
      counter?
- [ ] The food is large enough to enjoy and easy to aim at on a phone, held
      either way.
- [ ] With Reduce Motion on, a cut (its gap and lit faces) and a finished
      roll (its plate and mark) are still unmistakable, and nothing wobbles.

The noren and the breath (new in 0.6.0; not approved yet):

- [ ] The noren reads as cloth at a doorway and makes the counter feel like a
      tiny, calm restaurant — not a floating object, and never in the way.
- [ ] Its indigo sits well beside the chef's apron on an Apple screen.
- [ ] The chef's breathing is noticeable when you look, calm, never a bob;
      it blends with nods and delight; it stops with Reduce Motion.
- [ ] Battery and warmth after ten minutes left idle: the breath keeps the
      scene drawing about 14 times a second at rest.
- [ ] A roll's last stars never cover the pieces hopping to the plate, on a
      tablet held upright especially.

Praise, sound and haptics (new in 0.5.0; none of it approved yet):

- [ ] The stars read at a glance, on a phone held either way and on a tablet:
      one, two or three, without reading. They never hide where the next
      swipe starts.
- [ ] A careful, slow swipe on a guide can get three stars; a quick, rough
      one still gets praise. Do children want the three stars, and never feel
      bad about one? (Watch a child; do not ask leading questions.)
- [ ] The cut sound is soft and crisp on the device's speaker and on
      headphones, not harsh or hissy; the Perfect chime is pleasant, not a
      slot machine; five quick cuts never turn into a harsh burst.
- [ ] The first swipe of a visit is silent until a finger has lifted once
      (browsers require it). After locking the device, taking a call or
      switching apps, sound returns with the next touch.
- [ ] Haptics on an Android phone in Chrome: a light tap per cut, a double
      one for Perfect, nothing once switched off. On iPhone and iPad the
      switch says vibration is not available and play is unchanged.
- [ ] The slow-motion moment on a Perfect cut feels good, and never makes
      the next swipe feel late.
- [ ] The grown-ups button: a child tapping it meets only a question; the
      right answer opens Sound and Haptics; muting is immediate; the choice
      is still there after closing and reopening the app.
- [ ] With Reduce Motion on, the stars still show, with no sparkle or slow
      motion.

Chef Capybara (new in 0.4.0; a first version, not an approved look):

- [ ] It reads as a capybara at a glance — not a bear, hamster or beaver —
      and as calm and friendly, on a phone held either way and on a tablet.
- [ ] Its face is readable: the eyes and their spark, the snout, the smile.
      On a phone held sideways it is small, in the top corner beside the
      roll: is it still worth having there, and is it big enough?
- [ ] It never gets in the way: swipe straight down through every guide, far
      end to near end, on each device; nothing of the chef is where your
      finger starts or goes, nor behind the served plate or the tick mark.
- [ ] A cut gets a small, pleased nod; quick cuts make one longer nod, not a
      bobbing head; a stroke that does not cut gets nothing. It never looks
      cross or disappointed.
- [ ] A finished roll gets happy eyes, a smile, a blush and lifted paws, and
      the chef is calm again as the next roll arrives; the pace between
      rolls feels as before.
- [ ] While you rest it only blinks, flicks an ear or glances your way now
      and then, and never feels busy or distracting.
- [ ] With Reduce Motion on its face still changes, but it never moves.
- [ ] The counter's far edge, with the plain wall behind it, looks right;
      on a tablet the food sits a little lower than in 0.3.0.

Paste the **Copy** summary from `?tune` into the next brief to make any
values you prefer the new defaults.

## Checks only a real device can do

- [ ] Frame rate while the roll jiggles and the chef reacts, at 60 Hz and
      120 Hz, and in Low Power Mode. Warmth and battery after ten minutes of
      play, on the oldest device you have.
- [ ] How the lighting, textures and colours look on an Apple screen: the
      desktop GPU and colour pipeline are not Safari's. The nori's sheen and
      the salmon's gloss come from a reflection that only an Apple GPU can
      show as it will really look.
- [ ] How long the kitchen takes to appear on the first visit over mobile data
      (the 3D library is about 0.45 MB compressed), and on later visits.
- [ ] Leave the app in the background for a few minutes, or lock the device,
      and come back: the kitchen reappears (iOS may take the GPU context away;
      a spinner shows while it comes back).
- [ ] Real cancellations: a palm on the glass, a second hand, a notification
      or call banner, the app switcher or the lock button mid-swipe. The game
      never gets stuck or cuts by itself.
- [ ] System edge gestures near the roll: Notification Center, Control
      Center, the home indicator, Safari's back swipe.
- [ ] Physical rotation mid-roll, including while it jiggles; iPad Split
      View, Slide Over and Stage Manager.
- [ ] Safe areas on a notched or Dynamic Island phone, both ways up. Browser
      QA simulated the insets.
- [ ] The status bar's clock and battery stay readable over the warm scene in
      the home-screen app.
- [ ] Apple Pencil.
- [ ] Home-screen install, standalone launch, and an offline launch after
      one online visit; storage and cache names `capybara-sushi.` and
      `capybara-sushi-v0.6.0` (the identity panel in `?tune` shows them).
- [ ] If you have a device on iOS older than 16.4: it shows the note and
      the try-again button, not a blank screen.
