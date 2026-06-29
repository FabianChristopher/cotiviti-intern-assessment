# TPO Agentic Reviewer — Proof of Concept

A general-purpose **two-agent reasoning pipeline**, grounded in a small
retrieved reference library, that reviews short healthcare-adjacent
records — spanning **Treatment, Payment, and Operations (TPO)** — and
flags pattern anomalies with a fully explained, two-stage decision trail
you can inspect step by step.

**Live demo: https://tpo-agentic-reviewer.vercel.app**

## What this demonstrates

Given an uploaded or pasted record (a claim, a treatment-adherence note,
or an operations/staffing log), the pipeline runs in three genuine,
separately-timed stages:

1. **Retrieval** (`/api/review/retrieve`) — extracts the record's plain
   text and matches it against a small static library of reference
   guideline snippets using keyword overlap. No LLM call; this stage
   completes in well under a second.
2. **Analyst agent** (`/api/review/analyst`) — reads the record plus its
   retrieved snippets and reasons about whether it looks anomalous,
   producing a decision, a qualitative certainty level, a one-line
   summary, and a short list of scannable key-point bullets.
3. **Auditor agent** (`/api/review/auditor`) — independently reviews the
   record, the same retrieved snippets, and the Analyst's full output,
   actively looking for gaps or overreach, and produces the final,
   authoritative verdict (which may confirm or overturn the Analyst).

Each stage is a real, separate network request — the UI's loading state
for each step reflects genuine latency, not a simulated delay. The two
agents are orchestrated with plain, sequential `await` calls, not a
multi-agent framework: with only two fixed-order agents and no
branching/looping, a framework would manage complexity that doesn't
exist here. Full architectural rationale and a consolidated Q&A
(orchestration, RAG storage, what's LLM-generated vs static, etc.) live
in the parent project's `context/POC_Design_Decisions.md`.

## UI

A two-pane dashboard (no full-page scrolling):

- **Left pane** — choose a bundled sample record, upload your own
  `.txt`/`.csv`/`.pdf`, or paste text directly. Switches to a **History**
  view (past completed reviews, persisted in `localStorage`) via the
  header toggle.
- **Right pane** — a 4-step clickable navigator (Retrieval / Analyst /
  Auditor / Verdict). Click any completed step to view its content
  individually; nothing is stacked into one long scrolling list, and the
  Verdict view shows only the final outcome, never repeated bullet
  content.

Includes a light/dark theme toggle (persisted, no flash on load).

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Anthropic Claude API** (`claude-sonnet-4-6`) for both agents
- **unpdf** for extracting text from uploaded PDF records (no OCR —
  the bundled sample PDFs are text-based documents authored for this
  project, not scanned images). Chosen over the more commonly-tutorialed
  `pdf-parse` because it has zero dependencies and is purpose-built for
  serverless/edge runtimes — `pdf-parse`'s dependency chain pulls in an
  optional native binary that worked locally but crashed in production
  on Vercel; see `context/POC_Design_Decisions.md` for the full incident
- No database, no vector store — the reference library is a static
  TypeScript array (`lib/retrieval/snippets.ts`); History uses the
  browser's `localStorage`
- Deployed on **Vercel**

## Project layout

```
poc/
├── app/
│   ├── page.tsx                       # the single page: layout, orchestration, network calls
│   ├── layout.tsx                     # root layout, metadata, theme-flash-prevention script
│   ├── globals.css                    # theme variable system (light/dark), base reset
│   ├── page.module.css                # two-pane dashboard shell
│   └── api/review/
│       ├── retrieve/route.ts          # stage 1: text extraction + keyword retrieval
│       ├── analyst/route.ts           # stage 2: Analyst agent
│       └── auditor/route.ts           # stage 3: Auditor agent (final verdict)
├── lib/
│   ├── agents/
│   │   ├── analyst.ts                 # Analyst prompt, validation, runAnalyst()
│   │   ├── auditor.ts                 # Auditor prompt, validation, runAuditor()
│   │   └── parse-json-response.ts     # shared JSON-from-model-text parsing
│   ├── retrieval/
│   │   ├── snippets.ts                # the 9 static reference snippets
│   │   └── match.ts                   # keyword-overlap retrieval
│   ├── parsing/extract-text.ts        # .txt/.csv/.pdf -> plain text
│   ├── claude-client.ts               # thin Anthropic SDK wrapper
│   ├── sample-records.ts              # metadata for the 6 bundled samples
│   ├── history.ts                     # localStorage-backed History persistence
│   └── theme.ts                       # shared theme storage key
├── components/
│   ├── upload-panel.tsx               # record selection (sample/file/paste)
│   ├── step-navigator.tsx             # 4-step clickable progress indicator
│   ├── step-content-panel.tsx         # per-step content view
│   ├── history-list.tsx               # past-reviews list (History mode)
│   ├── category-tag.tsx               # shared PAY/TRT/OPS pill
│   └── theme-toggle.tsx               # light/dark toggle
├── public/samples/                    # 6 bundled sample TPO records (.txt + .pdf)
├── scripts/generate-sample-pdfs.cjs   # one-off authoring tool for the 3 sample PDFs (not part of the app)
└── types/review.ts                    # shared TypeScript types for the whole pipeline
```

## Running locally

```bash
npm install
cp .env.local.example .env.local   # then fill in ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), pick a sample record
on the left, and click **Run Review**.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Used by both the Analyst and Auditor agents to call the Claude API |

See `.env.local.example` for the template. `.env.local` itself is
git-ignored and must never be committed.
