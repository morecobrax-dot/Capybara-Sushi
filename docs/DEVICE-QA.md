# Device QA — Phase 1A, the 3D slicing scene

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
  version a device is running (0.2.0 for this phase).
- **Same Wi-Fi, for quick feel testing.** On the PC, run
  `npx --yes http-server -p 8395 -c-1 .` in the repository. On the device,
  open `http://<the PC's local IP>:8395/`. A plain-http address is not a
  secure context, so the service worker, offline play and a proper
  home-screen install cannot be tested this way.

## Judging the feel and the look (hands-on)

Play at least five rolls for each line, first as you normally would, then as
a young child might.

The slicing, which should feel as it did in 0.1.0:

- [ ] A slow, deliberate drag cuts at the moment the finger crosses, and a
      quick flick cuts every time.
- [ ] A sloppy swipe still cuts, and where it lands looks like yours.
- [ ] Stopping partway, tapping, or swiping along the roll does nothing, and
      never feels like a telling-off.
- [ ] Cutting fast, before the last cut has settled, still lands where you
      aim, including on a piece that is still tipping.
- [ ] The pace between rolls (finished roll shown, clear, next roll) still
      feels like a reward and not a wait.

The new movement and look:

- [ ] The knife's squash, the wobble along the roll, the two sides tipping
      apart and the rock back read as one soft, springy roll — satisfying,
      not rubbery, sluggish or jittery. Try Jiggle strength, softness and
      settling in `?tune`.
- [ ] Separated pieces settle on their own, and quick cuts blend rather than
      restart.
- [ ] Nothing floats above the board or sinks into it, and no piece passes
      into its neighbour.
- [ ] The roll looks like appetising food: dark green nori, rice at the ends,
      and a clearly filled face of nori, rice and salmon at every cut.
- [ ] The hop onto the plate and the plate leaving feel like serving.
- [ ] The food is large enough to enjoy and easy to aim at on a phone, held
      either way.
- [ ] With Reduce Motion on, a cut (its gap and lit faces) and a finished
      roll (its plate and mark) are still unmistakable, and nothing wobbles.

Paste the **Copy** summary from `?tune` into the next brief to make any
values you prefer the new defaults.

## Checks only a real device can do

- [ ] Frame rate while the roll jiggles, at 60 Hz and 120 Hz, and in Low Power
      Mode. Warmth and battery after ten minutes of play, on the oldest device
      you have.
- [ ] How the lighting, textures and colours look on an Apple screen: the
      desktop GPU and colour pipeline are not Safari's.
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
      `capybara-sushi-v0.2.0` (the identity panel in `?tune` shows them).
- [ ] If you have a device on iOS older than 16.4: it shows the note and
      the try-again button, not a blank screen.
