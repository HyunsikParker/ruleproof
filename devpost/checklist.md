---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Paste rules and see traceable requirements**
  Becomes usable: Paste rules, press Extract, and see grouped requirement items; clicking one highlights its source sentence.
  Why now: This is the kernel. Every later slice hangs off items that carry source offsets.
  PRD ref: `prd.md > The Core Journey` (steps 1-4), `prd.md > Extracting requirements`
  Spec ref: `spec.md > Extractor (src/extract.js)`, `spec.md > Page (index.html, src/app.js, styles.css)`, `spec.md > File Structure`
  Build: Scaffold package.json, index.html, styles.css, src/app.js, src/extract.js, src/sample.js; sentence splitting with offsets, classification, file and video detection; checklist render; highlight on click.
  Verify (mechanical): `node --test` passes extractor tests; serve the folder, load the sample, confirm items render and a click highlights the right sentence.
  Learner check: Paste a real rules page and confirm nothing on the list lacks a source.
  Commit: `Extract traceable requirements from pasted rules`

- [x] **2. Deadline in local time with a countdown**
  Becomes usable: The deadline card shows the deadline as written, in local time, and counts down.
  Why now: Second most common miss, and the learner's personal pain (US zones read from Seoul).
  PRD ref: `prd.md > Deadlines`
  Spec ref: `spec.md > Time zones (src/zones.js)`
  Build: zones.js mapping and offset math; deadline detection in extract.js; deadline card with 1-second timer.
  Verify (mechanical): zones tests for a summer and winter date; "Oct 26, 2026 @ 5:00pm EDT" renders as Oct 27 06:00 in Asia/Seoul.
  Learner check: Read the card and confirm the local time matches what you'd compute by hand.
  Commit: `Show deadlines in local time with countdown`

- [x] **3. Check a public GitHub repo against file requirements**
  Becomes usable: Paste a repo URL; required files turn green with their path or red; the public-repo item is verified.
  Why now: Completes the kernel's second half — the machine checks the paperwork.
  PRD ref: `prd.md > Checking the repository`
  Spec ref: `spec.md > Repo checker (src/repo.js)`, `spec.md > External Services and Dependencies`
  Build: parseRepoUrl, checkRepo with injectable fetch, matchFiles; repo bar UI and error states.
  Verify (mechanical): repo tests with a stubbed fetch for found, missing, private and rate-limited cases; a live check against a public repo.
  Learner check: Check this project's own repo and confirm scope.md, prd.md and spec.md show as found.
  Commit: `Check public GitHub repo against required files`

- [x] **4. Ticks, Markdown copy, and persistence**
  Becomes usable: Manual items can be ticked, the checklist copies as Markdown, and everything survives a reload.
  Why now: Turns a one-off read into a checklist you come back to.
  PRD ref: `prd.md > Manual items and export`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Data Model`
  Build: ticks keyed by stable ids, save/load, Clear, Copy as Markdown, empty and error states.
  Verify (mechanical): tick two items, reload, confirm ticks and repo result persist; copied Markdown matches statuses.
  Learner check: Use it for this entry's own submission and confirm the copied list reads right.
  Commit: `Persist checklist and add Markdown export`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 1 (real Build With AI rules pasted; video limit split across two lines was missed, fixed)
- [x] Final kick-the-tires exploration and feedback completed (desktop, 375px mobile, light and dark)

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

Wrap-up (familiar plan-first route): the one path worth knowing is `extract()` in `src/extract.js`. Each sentence keeps `start`/`end` offsets, and every item copies them, which is what lets `src/app.js` highlight the source and show the quote. File items carry `check: { type: 'file' }`, and `matchFiles()` in `src/repo.js` resolves them against the GitHub tree.

## Revisions
- "not required" was read as hard; now soft. LICENSE (and "open source license file") became a file item.
- Legal sentences about the household were dropped as noise; narrowed the noise pattern so exclusions stay.
- All-caps banners and "X is open to:" list intros were listed as requirements; filtered, and a blank line now ends a requirements list.
- Redesign: document pane with highlighter marks, ticket-style deadline, inline source quote, 4.5:1 contrast, 44px touch targets.
- Tried five other hackathons' rules: "at least a 1-minute clip" was read as a 1-minute limit. Minimum durations no longer become the video limit.
