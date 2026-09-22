---
doc: scope
status: approved
---

# RuleProof

Paste a hackathon's official rules and get a submission checklist where every item points back to the exact sentence it came from.

## The Unique Kernel
Every checklist item is tied to the rule sentence that created it. Click an item and the sentence lights up in the rules text. If a requirement isn't in the text, it isn't on the list, so nothing is invented.
The file-level items ("your repo must include X") are then checked against your real public GitHub repository, so the most common pass/fail miss gets caught by the machine instead of by memory.

## Who It's For
A solo developer who enters two to five online hackathons a month on Devpost and similar sites. Each event has its own 30–40 KB rules page. Today they skim it, copy a few lines into a notes file, and hope. The usual misses: a required file in the repo, a video over the time limit, or a deadline written in a US time zone that falls on a different day where they live.

## The Core Loop
1. Open RuleProof and paste the rules text.
2. Read the checklist: deadline, eligibility, deliverables, video, repository. Each item has its source sentence one click away.
3. Paste the public repo URL. File requirements turn green or red.
4. Tick the manual items as they get done.
5. Come back before the deadline; the checklist is still there.

They come back because the checklist is the one place that says "you are done" for this entry.

## Inspiration & Identity
Aviation preflight checklists: short lines, binary states, nothing decorative. Calm, dense, readable. Status colors do the talking (green done, amber manual, red missing).

## Why This Matters to the Learner
"I lose more entries to paperwork than to code. I want a tool that reads the rules the way a judge's pass/fail screen does."

## What "Working" Looks Like
Paste the Build With AI: Basics rules. The checklist shows the deadline as "Oct 26, 5:00 PM EDT" and in local time with a countdown, the 1–3 minute video limit, and "public repo must include scope.md, prd.md, spec.md". Paste RuleProof's own repository URL and those three files turn green.
The "oh, that's cool" beat: the app checks its own repository against the rules of the hackathon it is entered in.

## The POC Boundary
- Rules are pasted as text (English).
- Extraction covers: deadlines with time zones, required file names, video length limits, public-repo requirements, and sentences with hard requirement language ("must", "required", "will not be eligible").
- Source sentence shown and highlighted for every item.
- Public GitHub repositories only, checked through the unauthenticated GitHub API.
- One checklist saved in the browser.
- Copy the checklist as Markdown.

## Later
- Several hackathons at once, with a deadline dashboard.
- Calendar (.ics) export for the deadline.
- GitLab and Bitbucket repositories.
- Checking that the demo video link is public and within the length limit.

## Explicitly Cut
- **LLM summarization of the rules.** The failure being prevented is a missed or invented requirement; a summary can do both. Plain extraction with the source sentence is auditable.
- **Fetching the rules page by URL.** Browsers block cross-site fetches from a static page, and a proxy server adds hosting for little gain. Pasting takes two seconds.
- **Accounts and sync.** No backend in a proof of concept; the browser keeps one checklist.
