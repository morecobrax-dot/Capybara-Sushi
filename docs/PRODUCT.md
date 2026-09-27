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
chunky capybara chef and appealing simplified sushi. This describes the look
that is wanted, not the technology. **The permanent renderer is undecided.**
Phase 0B uses Canvas 2D as a prototype choice only.

## Roadmap

0. Foundations and a slicing prototype. **(0B: gray-box prototype, v0.1.0.)**
1. One polished roll and counter, with satisfying slicing and chef reactions.
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

## Decisions so far

- APP_ID `capybara-sushi`, name **Capybara Sushi**, short name **Capy Sushi**
  (the home-screen label is limited to 12 characters).
- The existing web/PWA foundation, Canvas 2D, no new dependencies; touch,
  mouse and pen through Pointer Events.
- Gameplay and tuning are kept in memory; nothing is saved.
- Gray-box visuals and the placeholder icons.
- Local commits only. Nothing is pushed or deployed until the user approves
  it, and GitHub Pages is not enabled.
