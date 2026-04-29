# OfferPilot

OfferPilot is an AI job-search assistant that helps candidates move from a resume to a targeted job application.

It reads a candidate's CV, understands the job-search goal, finds or imports relevant jobs, ranks them by fit, explains the CV/JD gaps, and generates a tailored PDF resume for a selected job.

## Demo Summary

OfferPilot combines four common job-search steps into one workflow:

1. Upload or paste a CV.
2. Tell the agent what kind of job you want.
3. Review ranked jobs with match reasons, gaps, and risks.
4. Polish the CV for a selected job and download a PDF.

Example prompt:

```text
I want software jobs in Sydney.
```

OfferPilot can search job providers directly, and it can also use the browser extension to collect jobs from sites such as LinkedIn, SEEK, and Indeed.

## Core Features

- **CV parsing**: accepts `.pdf`, `.md`, and `.txt` resumes.
- **Candidate profile extraction**: detects skills, target role, location, work mode, years of experience, contact details, projects, education, and verified resume facts.
- **Agent chat**: accepts free-form instructions and asks follow-up questions when important job-search information is missing.
- **Job search**: searches Adzuna and Google Jobs through SerpApi when API keys are configured.
- **Browser job import**: Chrome extension can import visible job listings and current job details from supported job sites.
- **Job ranking**: ranks jobs with an OpenAI-powered evaluator when available, with a local fallback scorer when not.
- **CV/JD analysis**: compares the selected job description with the candidate's verified CV facts.
- **CV polishing**: rewrites and reorders the resume for the selected JD without inventing unsupported experience.
- **PDF export**: downloads a fixed-template PDF resume.
- **Workspace persistence**: signed-in users can save profile, ranked jobs, selected job, resume preview, and search status through Supabase.

## Tech Stack

- **Framework**: Next.js App Router
- **UI**: React and CSS modules in `app/globals.css`
- **AI**: OpenAI Responses API
- **Auth and persistence**: Supabase Auth and Postgres
- **Job providers**: Adzuna API and SerpApi Google Jobs
- **CV parsing**: `pdfjs-dist` for PDF text extraction
- **Browser extension**: Manifest V3 Chrome extension under `extension/`

## Project Structure

```text
app/
  page.tsx                         Main one-page OfferPilot UI
  api/agent/route.ts               General profile/intake agent
  api/agent/analysis/route.ts      CV/JD gap analysis agent
  api/agent/polish/route.ts        CV polishing agent
  api/jobs/search/route.ts         Adzuna + Google Jobs search
  api/jobs/import/route.ts         Browser extension job import endpoint
  auth/callback/route.ts           Supabase OAuth callback

lib/
  jobs/                            Job normalization, ranking, providers, fallback data
  supabase/                        Supabase browser configuration

extension/                         Chrome extension for importing job listings
supabase/schema.sql                Tables, triggers, grants, and RLS policies
```

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create an environment file:

```bash
cp .env.example .env.local
```

Fill in the values you want to use:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
ADZUNA_APP_ID=your-adzuna-app-id
ADZUNA_APP_KEY=your-adzuna-app-key
SERPAPI_KEY=your-serpapi-key
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
```

Start the app:

```bash
pnpm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Recommended | Supabase project URL for auth and workspace persistence. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Recommended | Supabase browser key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported by the config helper. |
| `OPENAI_API_KEY` | Optional | Enables AI profile extraction, AI job ranking, CV/JD analysis, and CV polishing. |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4.1-mini`. |
| `ADZUNA_APP_ID` | Optional | Enables Adzuna job search. |
| `ADZUNA_APP_KEY` | Optional | Enables Adzuna job search. |
| `SERPAPI_KEY` | Optional | Enables Google Jobs search through SerpApi. |

If OpenAI or job-provider keys are missing, OfferPilot still works with local parsing, local ranking, and fallback jobs.

## Supabase Setup

Run the SQL in:

```text
supabase/schema.sql
```

The schema creates:

- `user_workspaces` for saved candidate profiles, ranked jobs, selected jobs, tailored resumes, and search status.
- `user_notes` for simple user-owned notes.
- Row Level Security policies so authenticated users can only access their own rows.

If Google OAuth is enabled in Supabase, add this local callback URL:

```text
http://localhost:3000/auth/callback
```

For production, add the deployed callback URL as well.

## Chrome Extension Setup

The extension is stored in:

```text
extension/
```

To load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` folder.
5. Keep OfferPilot running at `http://localhost:3000`.

The extension can import jobs from supported pages into:

```text
http://localhost:3000/api/jobs/import
```

Supported hosts are configured in `extension/manifest.json` and currently include LinkedIn, SEEK, and Indeed.

## Useful Commands

```bash
pnpm run dev
pnpm run typecheck
pnpm run build
```

## Suggested Demo Flow

1. Open the app.
2. Upload a CV.
3. Type: `I want software jobs in Sydney`.
4. Show the ranked job list and match scores.
5. Select one job.
6. Click **Analysis** to show CV/JD gaps.
7. Click **Polish CV** to generate and download the tailored PDF.
8. Mention that the browser extension can automatically search or import jobs from LinkedIn.

## Deployment on Vercel

1. Push the repository to GitHub.
2. Import the repository in Vercel.
3. Vercel will read `vercel.json` and use:
   - Framework: Next.js
   - Install command: `pnpm install --frozen-lockfile`
   - Build command: `pnpm run build`
   - Development command: `pnpm run dev`
4. Add the same environment variables in Vercel Project Settings.
5. Add the deployed callback URL in Supabase:

```text
https://your-vercel-domain.vercel.app/auth/callback
```

Use the production custom domain after assigning one.

## Design Principle

OfferPilot is designed to stay fact-based. It can improve wording, reorder skills, and highlight relevant experience, but it should not invent companies, projects, dates, outcomes, education, certifications, or skills that are not supported by the user's CV or profile.
