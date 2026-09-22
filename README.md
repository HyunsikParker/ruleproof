# RuleProof

Paste a hackathon's official rules and get a submission checklist. Each item links to the sentence it came from, and file requirements are checked against your public GitHub repository.

Try it: https://hyunsikparker.github.io/ruleproof/

## What it does

- Keeps only the sentences that state a requirement: deadlines, eligibility, deliverables, video limits and repository files. Legal boilerplate is skipped.
- Marks each item hard (must, required, not eligible) or soft (should, encouraged, optional), based on the wording.
- Click an item to highlight its sentence in the rules. Click a highlight to jump back to the item.
- Shows the deadline as written and in your own time zone, with a countdown. "5:00pm EDT" and "Eastern Time" are resolved with the offset in force on that date.
- Checks a public GitHub repo: required files (`scope.md`, `README`, `LICENSE`, ...) turn green with the path where they were found, or red when missing.
- Manual items get a checkbox. Everything is saved in the browser, and the list can be copied as Markdown.

Extraction is rule-based. It does not summarize or guess, so every item on the list can be traced to the text.

## Run locally

No build step and no dependencies.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. (Any static server works; ES modules need `http://`, not `file://`.)

## Tests

```bash
node --test
```

Node.js 20 or newer. The tests cover sentence splitting, hard/soft wording, file and video-limit detection, time-zone conversion and the GitHub checks (with a stubbed `fetch`).

## How it is built

| File | Role |
| --- | --- |
| `src/extract.js` | Splits the rules into sentences with character offsets, classifies them, finds files, video limits and deadlines |
| `src/zones.js` | Maps written zones (EDT, PT, Eastern Time, KST, ...) to IANA zones and converts wall-clock times to UTC |
| `src/repo.js` | Two unauthenticated GitHub API calls (repo metadata and recursive tree) and file matching |
| `src/app.js` | Rendering, highlights, countdown, ticks, persistence, Markdown export |
| `devpost/` | Scope, PRD, spec and build checklist written before the code |

## Limits

- English rules only. Dates must include a month name ("Oct 26, 2026"); numeric dates are not parsed.
- GitHub only. Unauthenticated API calls are limited to 60 per hour per IP address.
- One checklist at a time.

## Planning

Built for [Build With AI: Basics](https://learn-ai-basics.devpost.com/) with the Devpost Learn Skill Pack and Claude Code. The plan came first: [`devpost/scope.md`](devpost/scope.md), [`devpost/prd.md`](devpost/prd.md), [`devpost/spec.md`](devpost/spec.md), [`devpost/checklist.md`](devpost/checklist.md).

## License

MIT
