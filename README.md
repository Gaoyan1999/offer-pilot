# OfferPilot MVP

A one-page Next.js MVP for the flow described in `OFFERPILOT_PLAN.md`.

## What it does

- Accepts free-form background text and resume uploads (`.pdf`, `.md`, `.txt`).
- Extracts a lightweight candidate profile with skills, role target, location, work mode, years of experience, and verified resume facts.
- Asks follow-up questions when key job-search information is missing.
- Uses a local fallback job dataset and ranks jobs by match score.
- Shows job details, match reasoning, gaps, and risks outside the chat/input area.
- Generates a fact-based tailored resume preview for the selected job.
- Downloads a fixed-template PDF resume.

## Run

```bash
pnpm install
pnpm run dev
```

Open http://localhost:3000.

## Verify

```bash
pnpm run typecheck
pnpm run build
```
