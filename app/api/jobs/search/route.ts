import { NextRequest, NextResponse } from "next/server";

import { fallbackJobs } from "../../../../lib/jobs/fallback";
import { rankJobsWithAgent } from "../../../../lib/jobs/ai-ranking";
import { dedupeJobs } from "../../../../lib/jobs/normalize";
import { fetchAdzunaJobs } from "../../../../lib/jobs/providers/adzuna";
import { fetchSerpApiJobs } from "../../../../lib/jobs/providers/serpapi";
import { Job, JobSearchProfile, WorkMode } from "../../../../lib/jobs/types";

export const runtime = "nodejs";

type ProviderStatus = {
  source: "adzuna" | "google_jobs";
  ok: boolean;
  count: number;
  error?: string;
};

function parseProfile(request: NextRequest): JobSearchProfile {
  const params = request.nextUrl.searchParams;
  const workMode = params.get("workMode") ?? "";

  return {
    targetRole: params.get("targetRole") ?? "",
    targetLocation: params.get("targetLocation") ?? "Australia",
    workMode: ["remote", "hybrid", "onsite"].includes(workMode) ? (workMode as WorkMode) : "",
    yearsExperience: params.get("yearsExperience") ?? "",
    skills: (params.get("skills") ?? "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
  };
}

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function runProvider(source: ProviderStatus["source"], work: (signal: AbortSignal) => Promise<Job[]>): Promise<{
  jobs: Job[];
  status: ProviderStatus;
}> {
  try {
    const jobs = await withTimeout(work, 8000);
    return {
      jobs,
      status: {
        source,
        ok: true,
        count: jobs.length,
      },
    };
  } catch (error) {
    return {
      jobs: [],
      status: {
        source,
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : "Unknown provider error",
      },
    };
  }
}

export async function GET(request: NextRequest) {
  const profile = parseProfile(request);
  const [adzuna, serpApi] = await Promise.all([
    runProvider("adzuna", (signal) => fetchAdzunaJobs(profile, signal)),
    runProvider("google_jobs", (signal) => fetchSerpApiJobs(profile, signal)),
  ]);

  const realJobs = dedupeJobs([...adzuna.jobs, ...serpApi.jobs]);
  const jobs = realJobs.length > 0 ? realJobs : fallbackJobs;
  const ranking = await rankJobsWithAgent(jobs, profile);

  return NextResponse.json({
    jobs: ranking.jobs,
    fallback: realJobs.length === 0,
    providers: [adzuna.status, serpApi.status],
    ranking: {
      usedAI: ranking.usedAI,
      model: ranking.model,
      fallbackReason: ranking.fallbackReason,
    },
  });
}
