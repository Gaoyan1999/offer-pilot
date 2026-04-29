import { NextRequest, NextResponse } from "next/server";

import { addImportedJobs, clearImportedJobs, getImportedJobs, ImportedJobInput } from "../../../../lib/jobs/import-store";
import { rankJobsWithAgent } from "../../../../lib/jobs/ai-ranking";
import { rankJobs } from "../../../../lib/jobs/ranking";
import { JobSearchProfile, WorkMode } from "../../../../lib/jobs/types";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function parseProfile(request: NextRequest): JobSearchProfile {
  const params = request.nextUrl.searchParams;
  const workMode = params.get("workMode") ?? "";

  return {
    targetRole: params.get("targetRole") ?? "",
    targetLocation: params.get("targetLocation") ?? "",
    workMode: ["remote", "hybrid", "onsite"].includes(workMode) ? (workMode as WorkMode) : "",
    yearsExperience: params.get("yearsExperience") ?? "",
    skills: (params.get("skills") ?? "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  const profile = parseProfile(request);
  const rankingMode = request.nextUrl.searchParams.get("ranking");
  const importedJobs = getImportedJobs();
  const ranking =
    rankingMode === "local"
      ? {
          jobs: rankJobs(importedJobs, profile),
          usedAI: false,
          fallbackReason: "Loaded immediately with the local scorer.",
        }
      : await rankJobsWithAgent(importedJobs, profile);

  return NextResponse.json(
    {
      jobs: ranking.jobs,
      count: ranking.jobs.length,
      ranking: {
        usedAI: ranking.usedAI,
        model: ranking.model,
        fallbackReason: ranking.fallbackReason,
      },
    },
    {
      headers: corsHeaders,
    },
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { jobs?: ImportedJobInput[]; job?: ImportedJobInput } | null;
  const inputs = Array.isArray(body?.jobs) ? body.jobs : body?.job ? [body.job] : [];
  const accepted = addImportedJobs(inputs);

  return NextResponse.json(
    {
      accepted,
      count: getImportedJobs().length,
    },
    {
      headers: corsHeaders,
    },
  );
}

export async function DELETE() {
  clearImportedJobs();

  return NextResponse.json(
    {
      count: 0,
    },
    {
      headers: corsHeaders,
    },
  );
}
