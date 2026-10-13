# Chef Capy — learning product specification (summary of v1.1)

This is the product direction for Capybara Sushi from 0.8.0 on. It condenses
"Chef Capy — Teacher dashboard and classroom learning product specification,
Version 1.1" (12 October 2026). Where earlier brainstorming differs (a
4-of-5 mastery rule, Letter Bento, Sushi Train, Happy Customers), this
specification wins. What this repository actually implements is listed at
the end; nothing here is a claim that it exists.

## Promise and principles

Children run a cozy sushi kitchen with Chef Capy. Teachers get a clear
picture of learning and a practical plan for what to teach next: open the
dashboard, understand the class, review tomorrow's lesson, start teaching.

- One clear learning objective per round; one primary action per child
  screen. Teach by demonstration, then play. No reading required.
- Every class insight links to its evidence and one useful action.
- Every generated lesson has an objective, sequence, groups, materials,
  differentiation and a check for learning. Teacher judgment stays visible
  and editable; groups are temporary.
- Learning status reflects demonstrated skills only. Rewards, time played,
  animation completion, speed and slicing dexterity never count as mastery.
- Missing, assisted, stale, offline and interrupted evidence stay
  distinguishable. Every lesson includes an offline activity.

Users: the classroom teacher, the kindergarten child, a teacher rotating
children on shared devices, and a family receiving a teacher-selected
report. School administration and family accounts are later.

## The child experience

Outside the cozy sushi bar → choose the teacher-assigned avatar → enter the
kitchen → Chef Capy demonstrates one task → a short round → warm feedback →
serve a customer → continue or finish. The entrance is brief and skippable
(a dissolve with reduced motion). Slicing is a playful interaction used
where it supports the task, with a tap alternative carrying the same
learning evidence. No rapid-fire slicing, reading prerequisite, public
ranking, streak penalty, time limit, or reward for answering faster.

## The five stations

| Station | Child task | Progression | Teacher evidence |
|---|---|---|---|
| **Slice & Serve** | Prepare exactly the number of pieces requested | Count 1–3 → 1–5 → 1–10 → connect quantities with numerals → recognize small quantities without counting | Exact quantities served, one-to-one counting errors, numeral/quantity mismatch |
| **Bento Builder** | Fill a tray using two groups of sushi | Totals within 5 → two parts of a whole → find a missing part → totals within 10 | Correct totals, part/whole understanding, missing-part responses |
| **Pattern Parade** | Complete the next part of a sushi conveyor pattern | Copy AB → extend AB → extend AAB/ABB → identify the repeating unit → create a pattern | Pattern type, copying versus extending, repeating-unit errors |
| **Shape Kitchen** | Sort plates and ingredients by an explicit rule | Match 2D shapes → sort by shape → rotated shapes → sort by one stated attribute → explain a sort (teacher observation) | Rule used, shape confusions, rotation transfer, same-rule consistency |
| **Sound Kitchen** | Choose the picture whose spoken name begins with a target sound | Same/different initial sounds → match an initial sound to a familiar pictured word → optional teacher-enabled sound/letter connection | Audio prompt, vocabulary check, initial-sound response, letter condition if enabled |

Sound Kitchen uses reviewed recordings and unambiguous pictures, never
microphone input. Unknown vocabulary, unavailable audio or a language
mismatch is insufficient evidence, not a failed literacy skill. Letter
naming, initial-sound matching and phoneme/grapheme matching are separate
skills.

Each station has a summarized progress layout for teachers, for example
*Slice & Serve: counts quantities 1–5 independently • working on numeral
matching • next: serve 6 pieces*, with "Not enough evidence yet" where the
evidence does not support a statement.

**Activity content contract.** Each authored activity defines its skill ID,
level, prerequisites, objective, prompt, demonstration, item variants,
accepted answers, distractor rationale, support actions, recorded evidence
fields, language requirements, accessibility alternative, offline
counterpart and content version. An educator reviews it before it enters an
assignable catalog. Runtime generation never invents a new assessed skill or
an unreviewed question.

## The teacher workspace

Primary navigation: **Today / Class / Students / Lessons / Reports**, with a
class switcher. Calm, readable, color always paired with a label, no
decorative 3D behind data.

| Screen | Purpose |
|---|---|
| Welcome and class setup | A usable first lesson without long configuration; display names or pseudonyms only; demo data clearly labeled and never mixed into a real class |
| Today | Current lesson and objective; participation, recent evidence and follow-up summaries with denominators and windows; at most three insights, each with evidence and one action |
| Class insights | A per-skill table (never one class grade): observed/roster, each status, suggested action; an evidence drawer; truthful no-data states |
| Suggested groups | Objective-named temporary groups with reason, members and evidence age; the teacher can move and lock placements |
| Student directory | Find a child and the next useful observation; no ranking or ability score |
| Student profile | One supported strength, current objective, skill pathway, evidence by source (independent first answers, prompted attempts, teacher observations), next lesson, notes |
| Lesson planner | Constraints in (time, devices, adults, materials, absences, locks); an editable draft out, from an explicit evidence snapshot |
| Lesson detail and live view | Script, timed sequence, group cards, exit check; publishing versus starting a session are different acts |
| Activities and curriculum map | What each activity teaches; teacher preview creates no evidence |
| Reports | Class summary, teacher report, family summary; PDF/CSV; family output excludes private notes and peer comparison by default |
| Classroom devices and child launch | Short-lived class sessions on enrolled devices; the visible child identity persists; switching never moves evidence |
| Settings and help | Class, account, data handling in plain language |

## Evidence and progress rules

Three kinds of data stay separate: participation (started, completed,
interrupted), game learning evidence (valid first responses, support,
coverage, repetition) and teacher evidence (observed skill, context, date).

Skills are atomic (`count.quantity.1_5`, `number.match.1_5`,
`compose.total.5`, `pattern.extend.ab`, …); unlike skills are never averaged.

| Status | Meaning | Typical next action |
|---|---|---|
| Not observed | No usable evidence | Short observation activity |
| Gathering evidence | Some usable data; coverage insufficient | More varied opportunities |
| Building | Enough observations; responses inconsistent | Model and practice |
| With support | Supported responses stronger than independent ones — **only once a skill-specific support rubric is reviewed** | Fade help, check independently |
| Independent in game | Repeated independent performance meets the rule | Transfer check or next skill |
| Needs a fresh check | Prior adequate evidence is older than the window | Brief review before advancing |

**Proposed counting rule, awaiting educator validation (count.quantity.1_5
only):** at least 12 usable independent first responses, across at least two
sessions on different instructional dates, covering at least four
quantities including 5, with at least 80% correct. Introductory and
answer-revealing items are excluded. One session cannot establish
independence. The current-evidence window is 14 **instructional** days from
the class calendar, never 14 calendar days. Other skills need their own
rubric; this rule is never copied.

Integrity rules: an independent wrong first answer followed by a hint and a
correct retry stays an independent incorrect response plus a supported
success. Replaying ordinary task audio is not support; a prompt that
supplies the answer is. Repeated identical items in one round count once.
Crashes, timeouts, skips and unfinished responses are never incorrect.
Teacher overrides change recommendations, never raw events. Insights
describe responses ("repeated over-counts"), never diagnoses.

## Reports

- **Teacher report:** reporting window, participation and coverage, skills,
  status, independent first-response fraction, support use, freshness and
  source, two concrete examples, sourced teacher observations, current
  objective, next move, offline transfer check, context limits.
- **Family summary (one page):** what we practiced / what your child showed /
  what we are working on next / try this at home. Plain language, one
  low-cost activity; no rank, private notes, diagnosis or certainty that
  sparse data cannot support. The teacher previews and edits before export.
- **CSV evidence export:** one row per student/skill/window with internal
  IDs, status rule version, independent correct/attempted, supported
  responses, distinct sessions/dates, evidence age and exclusions.

## Automatic lesson planning

The app prepares an editable draft from the latest evidence snapshot, using
reviewed templates and deterministic rules — no generative AI is required.
Inputs: roster, date and timezone, skill evidence and its age, prerequisites,
teacher observations and target, recent assignments, minutes, devices,
adult capacity, materials, absences, access needs, locks. With inadequate
evidence it plans an observation lesson, not remediation.

Every lesson has: objective, success check, rationale, preparation, an exact
opening script, a timed sequence summing to the block, groups (members,
task, adult support, reason, alternative), differentiation, an offline
activity, an individual exit check, and a follow-up rule.

Safety rules: duration never exceeds the block; concurrent adult-led groups
never exceed adults; device demand never exceeds devices (pairs or rotation
are explicit); missing materials get a reviewed substitute or a surfaced
constraint; every participating child has one valid path; prerequisites are
not bypassed without a recorded override; published plans are immutable
versions; later evidence never rewrites a published rationale; regeneration
preserves teacher edits and locks. Plan lifecycle: Draft → Reviewed →
Published → In session → Completed → Archived. An unfinished-observation
queue is a normal output, not an error.

## Data, devices and privacy

Core records: Teacher, Class, Student, SkillDefinition, ActivityDefinition,
Assignment, ClassSession, AttemptEvent (append-only, unique IDs, first
response, support condition, device sequence, recorded and received times,
versions), TeacherObservation, SkillEvidenceSummary (derived, versioned),
GroupSuggestion, LessonPlan, ReportSnapshot, AuditEvent.

A real classroom needs a small authenticated backend: class-scoped
authorization checked server-side, idempotent event ingestion and durable
storage. A browser-only prototype may simulate the workflow but must not
claim cross-device synchronization. Collect the minimum; no child
advertising, third-party tracking, public scoreboards or model training on
student data; define retention and deletion before any real pilot. This
specification makes no legal or standards-compliance claim.

## Release sequence

- **Phase A — Playable learning foundation.** The sushi-bar entrance, one
  Slice & Serve skill family, teacher preview, accessible interactions and a
  trustworthy event stream; supervised usability sessions with children.
- **Phase B — Teacher classroom loop.** Roster, classroom devices, Today,
  class insights, student profiles, observations and one reviewed lesson
  template; identity isolation, event sync, honest denominators.
- **Phase C — Planning and reports.** Deterministic drafts, editable groups,
  constraints, publication, the live teaching view, teacher and family
  reports, PDF/CSV.
- **Phase D — Complete five-station V1.** Bento Builder, Pattern Parade, Shape
  Kitchen and Sound Kitchen, each after content, access, rubric and lesson
  review.
- **Later.** School administration, verified standards mappings, more
  languages, co-teachers, family accounts, LMS integration, longitudinal
  analysis; more customers, decorating and recipes. Child chatbots,
  diagnostic scoring, leaderboards and automated family messages are held.

## What 0.8.0 and 0.9.0 implement

A connected, **single-device development prototype** of one slice: Slice &
Serve counting 1–5 → evidence on this device → teacher summary → an
editable lesson draft → a student report, with fictional profiles. It has no
teacher sign-in, no backend and no synchronization between devices; the
times-table gate in front of the teacher workspace is not authentication.
Its content and counting rule await educator review. 0.9.0 makes the same
slice clearer — only sliced pieces can be plated, the order is the
customer's picture request, the teacher screens lead with the action and
the current evidence, and a lesson can be stepped through on the same
device — and adds a guide for a supervised try-out ([TRY-OUT.md](TRY-OUT.md)).
It changes no threshold or rule. See
[ARCHITECTURE.md](../ARCHITECTURE.md) (Learning prototype) and
[REMAINING-WORK.md](REMAINING-WORK.md) for exactly what exists and what the
multi-device milestone needs.
