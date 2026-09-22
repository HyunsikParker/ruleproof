---
doc: spec
status: approved
---

# RuleProof — Technical Spec

## How This Works, In Plain Language
RuleProof is one web page with no server. The page has three small pieces of logic:
- **The extractor** reads the pasted rules, cuts them into sentences, and keeps the ones that state a requirement, a deadline, a video limit or a required file. Each item remembers the exact character range of its sentence.
- **The repo checker** asks GitHub's public API for the repository and its file list, then marks each required file as found or missing.
- **The page** shows the rules with highlights, the checklist, and the deadline card, and saves everything in the browser's local storage.

The extractor has no knowledge of the page and the page has no parsing logic, so the extractor can be tested with plain Node.js.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. User pastes rules → `app.js` stores the text → **Extract** calls `extract(text)` in `extract.js`.
2. `extract` → `splitSentences` → each sentence is classified (`classify`) and scanned for files, video limits and deadlines → returns `{ items, deadlines }`, each with `start`/`end` offsets.
3. `app.js` renders the checklist; clicking an item wraps `text.slice(start, end)` in a `<mark>` in the rules view and scrolls to it.
4. The deadline card uses `deadlines` (already converted to UTC epoch ms) and `Intl.DateTimeFormat` for local display; a 1-second timer updates the countdown.
5. **Check repo** → `parseRepoUrl` → `checkRepo(owner, repo)` in `repo.js` → two GitHub API calls → `matchFiles(tree, fileItems)` → statuses stored and rendered.
6. Every change calls `save()`; page load calls `load()`.

## Stack
- HTML, CSS, JavaScript ES modules. No framework and no build step — the whole app is three modules and a stylesheet; a framework would be more code than the app.
- Node.js 22 built-in test runner (`node --test`) for the extractor and URL/file matching. Docs: https://nodejs.org/api/test.html
- `Intl.DateTimeFormat` with IANA time zones for offset math. Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

## Where It Runs and How Someone Tries It
- Runs in any modern browser. ES modules need an HTTP origin, so locally: `npx serve .` or `python3 -m http.server 8000`, then open http://localhost:8000.
- Tests: `node --test`.
- Deployment (chosen, optional): GitHub Pages from the `main` branch root, so reviewers can try it without cloning.
- Demo recording: load the Build With AI: Basics rules, extract, click the file item, check the RuleProof repo itself.

## Look and Feel
From `prd.md > Look and Feel`. CSS custom properties for colors with a `prefers-color-scheme: dark` block. Font stacks: `ui-monospace, SFMono-Regular, Menlo, monospace` for labels/status/dates/files; `system-ui, -apple-system, Segoe UI, sans-serif` for sentences. Status pills: green `#1f8a4c`, amber `#b7791f`, red `#c0392b`, grey `#6b7280`. 8px spacing grid, 1px borders, 6px radius. Copy is short and literal ("found in devpost/scope.md", "missing").

## Components

### Extractor (`src/extract.js`)
- `splitSentences(text)` → `[{ text, start, end }]`. Splits on `.`, `!`, `?`, `;` and on newlines/bullets, keeps offsets into the original string, ignores abbreviations like "e.g." and "a.m." and decimals.
- `classify(sentence)` → `{ category, strength }` or `null`. Categories: `deadline`, `eligibility`, `deliverable`, `video`, `repository`.
- `findFiles(sentence)` → file names matching `name.ext` for a fixed extension list, excluding domains and URLs.
- `findVideoLimit(sentence)` → `{ maxMinutes, minMinutes }` or `null`; understands digits, number words, "three (3)" and ranges.
- `findDeadlines(sentence)` → `[{ label, epochMs, zone }]`.
- `extract(text)` → `{ items, deadlines }`. Items: `{ id, category, strength, label, start, end, check }` where `check` is `{ type: 'file', name }`, `{ type: 'public' }` or `{ type: 'manual' }`.
PRD ref: `prd.md > Extracting requirements`, `prd.md > Deadlines`.

### Time zones (`src/zones.js`)
- Maps written zones to IANA names: EDT/EST/ET/Eastern → America/New_York; CDT/CST/CT/Central → America/Chicago; MDT/MST/MT/Mountain → America/Denver; PDT/PST/PT/Pacific → America/Los_Angeles; UTC/GMT/Z → UTC; BST → Europe/London; CET/CEST → Europe/Paris; IST → Asia/Kolkata; KST → Asia/Seoul; JST → Asia/Tokyo; SGT → Asia/Singapore; AEST/AEDT → Australia/Sydney.
- `zonedToEpoch(y, m, d, hh, mm, ianaZone)` finds the UTC instant by computing the zone offset with `Intl.DateTimeFormat(...).formatToParts` and correcting once.
PRD ref: `prd.md > Deadlines`.

### Repo checker (`src/repo.js`)
- `parseRepoUrl(url)` → `{ owner, repo }` or `null`.
- `checkRepo(owner, repo, fetchFn = fetch)` → `{ ok, public, defaultBranch, createdAt, paths }` or `{ ok: false, reason }` with reasons `not_found`, `rate_limited`, `network`.
- `matchFiles(paths, names)` → `{ [name]: path | null }`, case-insensitive basename match, shortest path wins.
PRD ref: `prd.md > Checking the repository`.

### Page (`index.html`, `src/app.js`, `styles.css`)
Rendering, highlight, countdown, ticks, Markdown copy, persistence, sample rules.
PRD ref: `prd.md > Screens and Layout`, `prd.md > Manual items and export`, `prd.md > States and Boundaries`.

## Data Model
One object in `localStorage['ruleproof:v1']`:
```
{ rules: string, items: Item[], deadlines: Deadline[],
  ticks: { [itemId]: boolean },
  repo: { url: string, result: RepoResult | null, checkedAt: string | null } }
```
Item ids are a hash of category + source offsets, so ticks survive a reload. Re-extracting after editing the rules keeps ticks whose ids still exist. "Clear" deletes the key.

## File Structure
```
ruleproof/
├── index.html          # single page
├── styles.css          # tokens, light/dark, layout
├── src/
│   ├── app.js          # UI, state, persistence
│   ├── extract.js      # sentences, classification, files, video, deadlines
│   ├── zones.js        # zone names → IANA, local-time math
│   ├── repo.js         # GitHub API calls and file matching
│   └── sample.js       # bundled sample rules (original text)
├── tests/
│   ├── extract.test.js
│   ├── zones.test.js
│   └── repo.test.js
├── devpost/            # Devpost learning workspace (scope, prd, spec, checklist)
├── package.json        # "type": "module", test script
└── README.md
```

## External Services and Dependencies
- **GitHub REST API, unauthenticated.**
  - `GET https://api.github.com/repos/{owner}/{repo}` → `private`, `default_branch`, `created_at`. 404 for private or missing.
  - `GET https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1` → `tree[].path` for `type: "blob"`.
  - Rate limit: 60 requests/hour per IP; a 403 with `x-ratelimit-remaining: 0` → `rate_limited`. No key, no cost. Docs: https://docs.github.com/en/rest/git/trees
- **GitHub Pages** for optional hosting. Free.

## Important Failure Modes
- **Rules written in an unusual date format** → the sentence still appears under Deadlines as a manual item; the countdown only shows parsed dates.
- **GitHub rate limit** → red banner "GitHub rate limit reached, try again in an hour"; file items stay unverified, manual ticks still work.
- **Very large trees (truncated response)** → a note that the listing was truncated and missing files may be false negatives.

## What Was Simplified and Why
- **Keyword rules** instead of a language model — auditable and deterministic; a model would need a key and could invent requirements.
- **Paste** instead of fetching rule pages — no proxy server.
- **One saved checklist** instead of a library — enough to prove the loop.

## Decisions and Open Issues
- Learner choice: deterministic extraction over LLM (traceability is the kernel).
- Learner choice: vanilla modules, no build — fast to run, easy to host on Pages.
- Implementation detail: offsets-based ids so ticks survive reloads.
- Learner uncertainty discussed: whether zone abbreviations like "ET" mean EDT or EST depends on the date. Resolved by mapping to the IANA zone and letting `Intl` pick the correct offset for that date; `zones.test.js` checks a summer and a winter date.
- Open: none.
