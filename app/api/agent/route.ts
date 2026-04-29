import { NextRequest, NextResponse } from "next/server";

type WorkMode = "remote" | "hybrid" | "onsite" | "";

type CandidateProfile = {
  rawText: string;
  name: string;
  email: string;
  phone: string;
  targetRole: string;
  targetLocation: string;
  workMode: WorkMode;
  yearsExperience: string;
  authorization: string;
  skills: string[];
  experienceFacts: string[];
  projectFacts: string[];
  educationFacts: string[];
  uploadNote: string;
};

type AgentRequest = {
  message: string;
  profile: CandidateProfile;
  missingInfo: string[];
};

type AgentResponse = {
  reply: string;
  profilePatch: Partial<CandidateProfile>;
};

const agentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
      description: "Short agent reply to show in the chat UI.",
    },
    profilePatch: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        targetRole: { type: "string" },
        targetLocation: { type: "string" },
        workMode: { type: "string", enum: ["remote", "hybrid", "onsite", ""] },
        yearsExperience: { type: "string" },
        authorization: { type: "string" },
        skills: {
          type: "array",
          items: { type: "string" },
        },
        experienceFacts: {
          type: "array",
          items: { type: "string" },
        },
        projectFacts: {
          type: "array",
          items: { type: "string" },
        },
        educationFacts: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "name",
        "email",
        "phone",
        "targetRole",
        "targetLocation",
        "workMode",
        "yearsExperience",
        "authorization",
        "skills",
        "experienceFacts",
        "projectFacts",
        "educationFacts",
      ],
    },
  },
  required: ["reply", "profilePatch"],
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

function isAgentRequest(value: unknown): value is AgentRequest {
  if (!value || typeof value !== "object") return false;
  return "message" in value && typeof value.message === "string" && "profile" in value && typeof value.profile === "object";
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();

  if (!isAgentRequest(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        reply: "OpenAI API key is not configured, so I used the local parser for now.",
        profilePatch: {},
        usedOpenAI: false,
      },
      { status: 200 },
    );
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const prompt = [
    "You are OfferPilot, a job-search and resume-tailoring agent.",
    "Read the user's latest message and update the candidate profile only with facts the user provided.",
    "Infer common job-search intent when reasonable, for example 'software jobs in Sydney' means targetRole 'Software Engineer' and targetLocation 'Sydney'.",
    "Do not fabricate companies, dates, projects, education, quantified outcomes, or skills.",
    "Decide for yourself whether the profile has enough information for the user's requested next step; do not treat currentMissingInfo as a rigid checklist.",
    "If no resume, CV, work history, project history, or meaningful background evidence is available, briefly guide the user to upload a resume or paste resume text.",
    "Only ask follow-up questions when the missing detail materially blocks the next step.",
    "Return JSON that exactly matches the schema.",
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
                latestMessage: body.message,
                currentProfile: body.profile,
                currentMissingInfo: body.missingInfo,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "offerpilot_agent_response",
          strict: true,
          schema: agentSchema,
        },
      },
    }),
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    return NextResponse.json(
      {
        error: "OpenAI request failed.",
        detail: errorText,
      },
      { status: 502 },
    );
  }

  const payload: unknown = await apiResponse.json();
  const outputText = extractResponseText(payload);

  try {
    const parsed = JSON.parse(outputText) as AgentResponse;
    return NextResponse.json({
      ...parsed,
      usedOpenAI: true,
      model,
    });
  } catch {
    return NextResponse.json(
      {
        error: "OpenAI returned an unreadable structured response.",
        detail: outputText,
      },
      { status: 502 },
    );
  }
}
