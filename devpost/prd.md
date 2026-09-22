---
doc: prd
status: approved
---

# RuleProof — Product Requirements

A single-page tool for solo hackathon entrants: paste the official rules, get a traceable submission checklist, and verify a public GitHub repo against it.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
1. The user opens RuleProof. With nothing saved, they see an empty rules box, a "Load sample rules" link, and a short line explaining what the tool does.
2. They paste the full rules text and press **Extract**.
3. The checklist appears, grouped into **Deadlines**, **Eligibility**, **Deliverables**, **Video**, and **Repository**. Each item has a short label, a hard/soft badge, and a status.
4. They click an item. The rules pane scrolls to the source sentence and highlights it.
5. The deadline card shows the deadline as written, the same moment in the user's local time zone, and a countdown.
6. They paste a public GitHub repo URL and press **Check repo**. Each required file becomes green (found, with its path) or red (missing). The public-repo item turns green if the API can read the repo.
7. They tick manual items (for example "video uploaded") as they finish them.
8. They press **Copy as Markdown** to paste the checklist into their notes or README.
9. Later they reopen the page; the rules, ticks and last repo result are still there.

Success: every hard requirement in the text is on the list with its source, and every file requirement shows a verified state.

## Screens and Layout
One screen, two columns on desktop, stacked on mobile.
- **Header:** name, one-line purpose, "Load sample rules", "Clear".
- **Left column — Rules:** a large text area. After extraction it switches to a read-only view of the same text with highlights; an "Edit rules" button returns to the text area.
- **Right column — Checklist:** the deadline card at the top, then the repo check bar, then the grouped checklist, then "Copy as Markdown".

## Look and Feel
Preflight-checklist feel. Neutral background, dark text, one accent. Monospace for labels, statuses, dates and file names; readable sans-serif for sentences. Status colors: green = verified, amber = needs a manual tick, red = missing, grey = soft/optional. Dense but calm; no illustrations, no gradients. Must work in light and dark mode. Source: `scope.md > Inspiration & Identity`.

## Features and Behavior

### Extracting requirements
- Splits the text into sentences and keeps those that state a requirement, eligibility condition, deliverable, time limit or deadline.
- **Hard** when the sentence uses must / required / shall / need to / will not be eligible / is not open to / only. **Soft** when it uses should / encouraged / recommended / optional / may.
- Recognizes file names with common extensions (`scope.md`, `README.md`, `requirements.txt`, …) and creates one file item per name.
- Recognizes video length limits ("less than three (3) minutes", "1 to 3 minutes", "under 2 minutes") and shows them as a single video item with the limit in minutes.
- Recognizes public-repository requirements.
- Duplicate sentences produce one item.

- As an entrant, I want every item to show where it came from so that I can trust the list.
  - [ ] Clicking any item highlights exactly its source sentence in the rules view.
  - [ ] No item exists without a source sentence.

### Deadlines
- Finds date + time + zone phrases such as "Oct 26, 2026 @ 5:00pm EDT", "October 26, 2026 (5:00 pm Eastern Time)", "11:59 PM PT", "23:59 UTC".
- Converts each to the browser's local time zone and shows a countdown for the latest future deadline found in a sentence about submissions (or the latest one overall if none).
  - [ ] "Oct 26, 2026 @ 5:00pm EDT" shows as Oct 27, 06:00 in Asia/Seoul.
  - [ ] A deadline in the past shows "passed" instead of a negative countdown.

### Checking the repository
- Accepts `https://github.com/owner/repo` (with or without `.git`, trailing slash, or `/tree/branch`).
- Reads repo metadata and the full file tree through the public GitHub API.
- A required file is found when a file with the same name (case-insensitive) exists anywhere in the tree; the path is shown.
  - [ ] RuleProof's own repo shows `scope.md`, `prd.md`, `spec.md` as found under `devpost/`.
  - [ ] A private or missing repo shows "not reachable publicly" in red, and file items stay unverified.

### Manual items and export
- Every item that is not machine-checked has a checkbox.
- "Copy as Markdown" copies `- [x]` / `- [ ]` lines with the label and status, grouped by category.

## States and Boundaries
- **First use / empty** — rules box, sample link, one-line explanation; checklist column shows "Paste rules to begin".
- **Nothing found** — "No requirement sentences found. Is this the rules page?" with the text still editable.
- **Repo errors** — invalid URL, not found/private, and GitHub rate limit each get their own plain message; the checklist stays usable.
- **Persistence** — rules text, extracted items, ticks, repo URL and last repo result are stored in this browser only. "Clear" removes them.

## Product Decisions
- Extraction is rule-based and deterministic, not an LLM — the learner wants a list they can audit; an invented rule is as bad as a missed one.
- Paste instead of URL fetch — no server, works on any rules page.
- Hard vs soft is decided by the wording of the sentence itself — the learner decides by the text, not by guessing intent.
- Local time conversion uses the browser's zone — the learner's real problem is US zones read from Seoul.

## What We're Building
Paste → extract → traceable grouped checklist with highlights → local-time deadline with countdown → public GitHub repo check for file and visibility items → manual ticks → Markdown copy → browser persistence → sample rules.

## Deferred From the POC
- Multiple saved hackathons — needs a list view and naming; one checklist proves the loop.
- Rule-page fetching — needs a proxy server.

## Possible Later Enhancements
- `.ics` export of the deadline.
- GitLab / Bitbucket checks.
- Checking a YouTube link is public and within the limit.

## Non-Goals
- Judging whether a project is good. RuleProof checks paperwork, not quality.
- Legal interpretation. It shows the sentences; the entrant reads them.
- Non-English rules.

## Open Questions
- None blocking `4-spec`.
