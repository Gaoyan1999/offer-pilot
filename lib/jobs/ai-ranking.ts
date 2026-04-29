import { rankJobs } from "./ranking";
import { Job, JobSearchProfile, RankedJob } from "./types";

type AiRankingResponse = {
  rankedJobs: Array<{
    id: string;
    matchScore: number;
    matchRationale: string[];
    gaps: string[];
    risks: string[];
  }>;
};

export type RankingResult = {
  jobs: RankedJob[];
  usedAI: boolean;
  model?: string;
  fallbackReason?: string;
};

const rankingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rankedJobs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: {
            type: "string",
            description: "The exact input job id.",
          },
          matchScore: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Candidate fit score from 0 to 100.",
          },
          matchRationale: {
            type: "array",
            items: { type: "string" },
            description: "Concise evidence-based reasons this job matches the candidate.",
          },
          gaps: {
            type: "array",
            items: { type: "string" },
            description: "Concrete missing or uncertain requirements.",
          },
          risks: {
            type: "array",
            items: { type: "string" },
            description: "Application risks or caveats based on available facts.",
          },
        },
        required: ["id", "matchScore", "matchRationale", "gaps", "risks"],
      },
    },
  },
  required: ["rankedJobs"],
} as const;

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const directText = "output_text" in payload ? payload.output_text : "";
  if (typeof directText === "string" && directText.trim()) return directText;

  const output = "output" in payload ? payload.output : null;
  if (!Array.isArray(output)) return "";

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) return [];
      return item.content.map((contentItem: unknown) => {
        if (!contentItem || typeof contentItem !== "object") return "";
        if ("text" in contentItem && typeof contentItem.text === "string") return contentItem.text;
        return "";
      });
    })
    .join("")
    .trim();
}

function chunkJobs(jobs: Job[], size: number) {
  const chunks: Job[][] = [];
  for (let index = 0; index < jobs.length; index += size) {
    chunks.push(jobs.slice(index, index + size));
  }
  return chunks;
}

function compactJob(job: Job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    workMode: job.workMode,
    source: job.source,
    description: job.description.slice(0, 3500),
    requiredSkills: job.requiredSkills,
    niceToHave: job.niceToHave,
  };
}

function normalizeAiRanking(jobs: Job[], aiResponse: AiRankingResponse): RankedJob[] {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const seen = new Set<string>();

  return aiResponse.rankedJobs
    .map((ranking) => {
      const job = jobsById.get(ranking.id);
      if (!job || seen.has(ranking.id)) return null;
      seen.add(ranking.id);

      return {
        ...job,
        matchScore: Math.max(0, Math.min(100, Math.round(ranking.matchScore))),
        matchRationale: ranking.matchRationale.slice(0, 4),
        gaps: ranking.gaps.slice(0, 4),
        risks: ranking.risks.slice(0, 4),
      };
    })
    .filter((job): job is RankedJob => Boolean(job));
}

async function rankJobBatchWithAI(jobs: Job[], profile: JobSearchProfile, apiKey: string, model: string) {
  const prompt = [
    "You are OfferPilot's job-fit evaluation agent.",
    "Evaluate each job against the candidate profile using only the supplied profile and job facts.",
    "Score each job from 0 to 100 for practical application fit.",
    "Consider role alignment, seniority, location/work-mode fit, required skills, nice-to-have skills, and uncertainty in the imported job text.",
    "Do not apply a fixed arithmetic formula. Use judgment and explain the most important evidence.",
    "Do not fabricate candidate experience, company details, salary, sponsorship, or unstated requirements.",
    "Return every input job exactly once, using the exact input id.",
  ].join("\n");

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: prompt }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                candidateProfile: profile,
                jobs: jobs.map(compactJob),
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "offerpilot_job_ranking",
          strict: true,
          schema: rankingSchema,
        },
      },
    }),
  });

  if (!apiResponse.ok) {
    throw new Error(await apiResponse.text());
  }

  const payload: unknown = await apiResponse.json();
  const outputText = extractResponseText(payload);
  const parsed = JSON.parse(outputText) as AiRankingResponse;
  const ranked = normalizeAiRanking(jobs, parsed);

  if (ranked.length !== jobs.length) {
    throw new Error(`AI ranking returned ${ranked.length} of ${jobs.length} jobs.`);
  }

  return ranked;
}

export async function rankJobsWithAgent(jobs: Job[], profile: JobSearchProfile): Promise<RankingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (jobs.length === 0) {
    return { jobs: [], usedAI: false, fallbackReason: "No jobs to rank." };
  }

  if (!apiKey) {
    return {
      jobs: rankJobs(jobs, profile),
      usedAI: false,
      fallbackReason: "OPENAI_API_KEY is not configured.",
    };
  }

  try {
    const rankedBatches = await Promise.all(chunkJobs(jobs, 20).map((batch) => rankJobBatchWithAI(batch, profile, apiKey, model)));
    const rankedJobs = rankedBatches.flat().sort((a, b) => b.matchScore - a.matchScore);
    return {
      jobs: rankedJobs,
      usedAI: true,
      model,
    };
  } catch (error) {
    return {
      jobs: rankJobs(jobs, profile),
      usedAI: false,
      model,
      fallbackReason: error instanceof Error ? error.message : "AI ranking failed.",
    };
  }
}
