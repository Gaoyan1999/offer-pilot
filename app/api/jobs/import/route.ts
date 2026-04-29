import { NextRequest, NextResponse } from "next/server";

import { addImportedJobs, clearImportedJobs, getImportedJobs, ImportedJobInput } from "../../../../lib/jobs/import-store";
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
  const jobs = rankJobs(getImportedJobs(), profile);

  return NextResponse.json(
    {
      jobs,
      count: jobs.length,
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
