# Device QA — Phase 0B slicing prototype

**Status: not done.** Nothing on this list has been tried on a real phone or
tablet. Browser QA ran in headless Edge on Windows with browser-dispatched
touch, mouse and pen input. That is simulated input, not hardware. Record
the device, OS and browser version, and the date, next to every result.

## Getting it onto a device

- **Same Wi-Fi, for feel testing.** On the PC, run
  `npx --yes http-server -p 8395 -c-1 .` in the repository. On the device,
  open `http://<the PC's local IP>:8395/`, or add `?tune` to tune. Windows may
  ask to allow Node through the firewall. A plain-http address is not a
  secure context, so the service worker, offline play and a proper
  home-screen install cannot be tested this way.
- **GitHub Pages, for install and offline.** Published as a development
  preview in Phase 0C: <https://morecobrax-dot.github.io/Capybara-Sushi/>,
  and `?tune` on the end for tuning. It uses HTTPS, so the service worker,
  offline play and home-screen install can all be tested there. Pages can take
  up to 10 minutes to show a new push.

## Judging the slicing feel (hands-on)

Play at least five rolls for each line, first as you normally would, then as
a young child might.

- [ ] A slow, deliberate drag cuts at the moment the finger crosses, not
      when it lifts, and feels like pushing a knife through.
- [ ] A quick flick cuts every time, with no stroke that "should have" cut
      and didn't.
- [ ] A sloppy swipe (off a guide, slightly slanted) still cuts. Where it
      lands looks like yours, not snapped.
- [ ] Stopping partway and lifting, tapping, or swiping along the roll does
      nothing, and never feels like a telling-off.
- [ ] The pieces parting reads as a clean cut: satisfying, not bouncy or
      sluggish. Try Pop, Bounce and Gap in `?tune`.
- [ ] Cutting fast, before the last cut has settled, still lands where you
      aim.
- [ ] The finished roll gathering on its plate, clearing, and the next roll
      arriving feels like a reward and not a wait. Try "Finished roll shown"
      and "Clear and next roll".
- [ ] A child who cannot read works out the swipe from the hint alone, and
      the hint arrives neither too soon nor too late (try "Hint after").
- [ ] Six pieces per roll is the right amount of cutting (try 4–8).
- [ ] With Reduce Motion on, a cut and a finished roll are still unmistakable.

Paste the **Copy** summary from `?tune` into the next brief to make any
values you prefer the new defaults.

## Checks only a real device can do

- [ ] Perceived latency from finger to cut, at 60 Hz and 120 Hz, and in Low
      Power Mode (iOS can drop to 30 fps).
- [ ] Real cancellations: a palm on the glass, a second hand, a notification
      or call banner, opening the app switcher mid-swipe, locking the device
      mid-stroke. The game should never get stuck or cut by itself.
- [ ] System edge gestures near the roll: iOS Notification Center, Control
      Center, the home indicator, Safari's back swipe; the Android back
      gesture and pull-to-refresh.
- [ ] Two hands on the glass: a resting finger does not block play once
      lifted, and a second finger never cuts.
- [ ] Physical rotation mid-roll; iPad Split View, Slide Over and Stage
      Manager; Android multi-window.
- [ ] Background and resume from a Safari tab and from a home-screen install.
- [ ] Safe areas on a notched or Dynamic Island phone, in both orientations.
      Browser QA simulated the insets.
- [ ] The system Reduce Motion switch changed while the game is open, on
      iOS and Android.
- [ ] Apple Pencil and an Android stylus.
- [ ] Frame rate and heat on an older or low-cost tablet.
- [ ] Once Pages is enabled: home-screen install, standalone launch, offline
      launch, and confirming that storage and cache names are
      `capybara-sushi.` and `capybara-sushi-v0.1.0` (the identity panel in
      `?tune` shows them).
