# INTERN Assessment — Fabian Christopher — Northeastern University

This repository contains my submission for the Cotiviti Intern performance-based assessment. The assessment asked candidates to choose one healthcare topic, then produce a written report, a hackathon-style proof-of-concept demo, a slide presentation, and a recorded video walkthrough.

**Topic chosen: Clinical Decision Making and Pattern Recognition in Health Care** — specifically, agentic reasoning and pattern recognition for **Treatment, Payment, and Operations (TPO)** in healthcare.

**Live demo: https://tpo-agentic-reviewer.vercel.app** (no login required)

**Video walkthrough: https://www.loom.com/share/ad75acc0b6554e41a37b3f29260d3047** (also included locally in `video/`)

---

## What's in this repo

```
cotiviti-intern-assessment/
├── README.md          <- you are here
├── report/             <- written report (Word doc) + bibliography
├── slides/             <- PowerPoint presentation
├── video/              <- recorded video walkthrough (or a link to it)
└── poc/                <- the working proof-of-concept application
```

| Deliverable | Location | Status |
|---|---|---|
| Written report | `report/` | Complete |
| Slide presentation | `slides/` | Complete |
| Video walkthrough | `video/` ([Loom link](https://www.loom.com/share/ad75acc0b6554e41a37b3f29260d3047)) | Complete |
| Proof-of-concept demo | `poc/` | Fully working — see below and `poc/README.md` |

---

## The Proof of Concept: TPO Agentic Reviewer

The core of this submission is a working demonstration of **agentic reasoning and pattern recognition** applied to healthcare records spanning all three TPO categories — Treatment, Payment, and Operations.

### The idea, in plain terms

Rather than building a single AI model that reads a record and spits out a verdict, this POC demonstrates a **two-agent review pattern**: one agent proposes a judgment, a second agent independently audits that judgment before it becomes final. This mirrors how careful human review actually works (a second opinion, a peer review, an audit step) and is a deliberately general-purpose pattern — it is not built to mimic any single existing commercial product, and it is shown working identically across three different kinds of healthcare records (a payment claim, a treatment-adherence note, and an operations staffing log) to demonstrate that the underlying technique is domain-agnostic.

### How it works

A submitted record (uploaded as a `.txt`/`.csv`/`.pdf` file, or pasted as text) flows through three genuine, separately-timed stages:

1. **Retrieval** — the record's text is matched, by keyword overlap, against a small library of reference guideline snippets (generic billing-policy rules, treatment-guideline excerpts, and operations/staffing norms). No AI model call is involved in this step; it is fast, transparent, deterministic matching.
2. **Analyst agent** — reads the record together with whatever reference snippets were retrieved for it, reasons step by step about whether the record looks anomalous, and produces a decision, a certainty level, a one-line summary, and a short list of supporting bullet points — citing exactly which reference snippet(s) informed its reasoning.
3. **Auditor agent** — independently reviews the same record and reference snippets, *plus* the Analyst's full output, actively looking for gaps, overreach, or misapplied reasoning. It produces the final, authoritative verdict, which may confirm or **overturn** the Analyst's original call.

Each of those three stages is its own real network request to the application's backend, which in turn makes a real call to Anthropic's Claude API for the two agent stages. There is no simulated timing anywhere — every loading indicator in the UI reflects work that is genuinely still in progress.

### What the demo shows you

A two-pane web dashboard:

- **Left pane** — pick one of six bundled, fully fictional sample records (two per TPO category, a mix of `.txt` and `.pdf`), upload your own file, or paste text directly.
- **Right pane** — a four-step progress navigator (Retrieval → Analyst → Auditor → Verdict). Each step becomes clickable as soon as it completes, and clicking it shows that step's content individually — the retrieved reference snippets, the Analyst's reasoning, the Auditor's critique, or the final verdict — rather than everything being dumped into one long scrolling page.
- A **History** view that keeps a record of every completed review in the current browser session, so past results can be revisited without re-running anything.
- A light/dark theme toggle.

### Why this design

The assessment brief explicitly states that the proof of concept will be evaluated on demonstrating "basic technological competency" through fast, simple hacking — not on technical sophistication for its own sake. In that spirit, this demo deliberately:

- Uses plain, sequential function calls to orchestrate the two agents rather than a multi-agent orchestration framework, since there are only two agents in a fixed order with no branching or looping to justify one.
- Uses simple keyword matching for retrieval rather than a vector database and embeddings model, since the reference library is only nine short documents — a vector index would add real infrastructure to solve a search problem that doesn't exist at this scale.
- Stores demo history in the browser rather than a database, since the only requirement is that a result survive a page navigation within one demonstration session.

Each of these choices, along with the full architectural reasoning, alternatives considered, and rejected approaches, is documented in detail inside `poc/README.md` and in the in-code comments throughout `poc/lib/` and `poc/app/`.

### Running the demo locally

```bash
cd poc
npm install
cp .env.local.example .env.local   # then fill in your own ANTHROPIC_API_KEY
npm run dev
```

Then open `http://localhost:3000`, pick a sample record on the left, and click **Run Review**.

Full setup details, environment variables, and a complete file-by-file project layout are in [`poc/README.md`](poc/README.md).

---

## Tools and Technologies Used

In the spirit of the assessment's own instruction to "be resourceful... use ANY tools or technologies available," this submission was built with the help of:

- **GitHub Copilot** and **Claude** (Anthropic) — AI-assisted coding tools used during development of the proof-of-concept application.
- **Google Search** — used for the company/industry research behind the written report.

Separately from development-time tooling, the proof-of-concept *itself* runs on the **Anthropic Claude API** as the large language model powering its Analyst and Auditor agents at runtime — this is a core part of the application's own architecture, not a development tool, and is described in detail in `poc/README.md` and `context/POC_Design_Decisions.md`.

---

## Submission contact

This repository has been shared with `jesus.hurtado@cotiviti.com` per the assessment instructions.

— Fabian Christopher, Northeastern University
