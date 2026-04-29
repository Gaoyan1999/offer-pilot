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

## Deploy on Vercel from GitHub

1. Push this repository to GitHub.
2. In Vercel, create a new project and import the GitHub repository.
3. Vercel will read `vercel.json` and use:
   - Framework: Next.js
   - Install command: `pnpm install --frozen-lockfile`
   - Build command: `pnpm run build`
   - Development command: `pnpm run dev`
4. Add these environment variables in Vercel Project Settings for Production and Preview:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

5. If Supabase Auth is enabled, add the deployed callback URL in Supabase:

```text
https://your-vercel-domain.vercel.app/auth/callback
```

Use the production custom domain instead of `your-vercel-domain.vercel.app` after assigning one.
