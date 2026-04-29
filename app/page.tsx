"use client";

import type { AuthChangeEvent, AuthError, Session, User } from "@supabase/supabase-js";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";

type WorkMode = "remote" | "hybrid" | "onsite" | "";
type ActiveTab = "cv" | "jobs";
type MessageRole = "agent" | "user";
type MessageKind = "text" | "missing-info" | "status";

type ChatMessage = {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
};

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

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: Exclude<WorkMode, "">;
  source: string;
  url: string;
  description: string;
  requiredSkills: string[];
  niceToHave: string[];
};

type RankedJob = Job & {
  matchScore: number;
  matchRationale: string[];
  gaps: string[];
  risks: string[];
};

type TailoredResume = {
  summary: string;
  skills: string[];
  experience: string[];
  projects: string[];
  education: string[];
  applicationSummary: string;
  gaps: string[];
};

type AuthStatus = "checking" | "ready" | "working";

type AgentApiResponse = {
  reply?: string;
  profilePatch?: Partial<CandidateProfile>;
  usedOpenAI?: boolean;
  model?: string;
  error?: string;
  detail?: string;
};

const knownSkills = [
  "React",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Python",
  "SQL",
  "Postgres",
  "Supabase",
  "OpenAI",
  "LLM",
  "AI",
  "RAG",
  "Prompt Engineering",
  "Product Management",
  "Figma",
  "Analytics",
  "AWS",
  "Docker",
  "GraphQL",
  "REST",
  "Tailwind",
  "CSS",
  "HTML",
  "Testing",
  "Playwright",
  "Cypress",
  "Data Analysis",
  "Machine Learning",
];

const mockJobs: Job[] = [
  {
    id: "ai-product-engineer-canva",
    title: "AI Product Engineer",
    company: "Canva",
    location: "Sydney, Australia",
    workMode: "hybrid",
    source: "Fallback dataset",
    url: "https://www.canva.com/careers/",
    description:
      "Build AI-assisted product workflows with React, TypeScript, experimentation, and close collaboration with product and design teams.",
    requiredSkills: ["React", "TypeScript", "AI", "Product Management", "Analytics"],
    niceToHave: ["OpenAI", "Prompt Engineering", "Figma", "Testing"],
  },
  {
    id: "full-stack-ai-atlassian",
    title: "Full Stack Engineer, AI Platform",
    company: "Atlassian",
    location: "Remote - Australia",
    workMode: "remote",
    source: "Fallback dataset",
    url: "https://www.atlassian.com/company/careers",
    description:
      "Develop AI platform features across frontend and backend services. Role uses TypeScript, Node.js, REST APIs, telemetry, and product iteration.",
    requiredSkills: ["TypeScript", "Node.js", "React", "REST", "AI"],
    niceToHave: ["OpenAI", "AWS", "Analytics", "Testing"],
  },
  {
    id: "frontend-ai-startup",
    title: "Frontend Engineer, AI Tools",
    company: "Northstar Labs",
    location: "Melbourne, Australia",
    workMode: "hybrid",
    source: "Fallback dataset",
    url: "https://example.com/jobs/frontend-ai-tools",
    description:
      "Own UX-heavy AI tooling for internal operators. Requires strong frontend fundamentals, React, TypeScript, CSS, and pragmatic product judgment.",
    requiredSkills: ["React", "TypeScript", "CSS", "AI"],
    niceToHave: ["Playwright", "Prompt Engineering", "Analytics"],
  },
  {
    id: "backend-data-sydney",
    title: "Backend Engineer, Data Products",
    company: "Harbour Data",
    location: "Sydney, Australia",
    workMode: "onsite",
    source: "Fallback dataset",
    url: "https://example.com/jobs/backend-data-products",
    description:
      "Build backend APIs for data products using Python, SQL, Postgres, Docker, and cloud deployment practices.",
    requiredSkills: ["Python", "SQL", "Postgres", "Docker", "REST"],
    niceToHave: ["AWS", "Data Analysis", "Testing"],
  },
  {
    id: "product-engineer-remote",
    title: "Product Engineer",
    company: "RelayWorks",
    location: "Remote - APAC",
    workMode: "remote",
    source: "Fallback dataset",
    url: "https://example.com/jobs/product-engineer",
    description:
      "Ship customer-facing features end to end with React, Next.js, Node.js, SQL, and direct product discovery with users.",
    requiredSkills: ["React", "Next.js", "Node.js", "SQL", "Product Management"],
    niceToHave: ["Supabase", "Analytics", "Figma"],
  },
];

const seedMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "agent",
    kind: "text",
    content:
      "Tell me what kind of role you want, upload a CV, or ask me to search. I will collect missing details before ranking jobs.",
  },
];

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getInitialProfile(): CandidateProfile {
  return {
    rawText: "",
    name: "",
    email: "",
    phone: "",
    targetRole: "",
    targetLocation: "",
    workMode: "",
    yearsExperience: "",
    authorization: "",
    skills: [],
    experienceFacts: [],
    projectFacts: [],
    educationFacts: [],
    uploadNote: "",
  };
}

function includesWord(text: string, value: string) {
  return text.toLowerCase().includes(value.toLowerCase());
}

function extractSkills(text: string) {
  return knownSkills.filter((skill) => includesWord(text, skill));
}

function extractName(text: string) {
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 2 && item.length < 48 && !item.includes("@") && !/\d/.test(item));

  return line ?? "";
}

function extractRole(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("ai product")) return "AI Product Engineer";
  if (lower.includes("full-stack") || lower.includes("full stack")) return "Full Stack Engineer";
  if (lower.includes("frontend") || lower.includes("front-end") || lower.includes("前端")) return "Frontend Engineer";
  if (lower.includes("backend") || lower.includes("back-end") || lower.includes("后端")) return "Backend Engineer";
  if (lower.includes("software") || lower.includes("软件")) return "Software Engineer";
  if (lower.includes("product engineer")) return "Product Engineer";
  if (lower.includes("data")) return "Data Engineer";
  return "";
}

function extractLocation(text: string) {
  const locationMap: Record<string, string> = {
    Sydney: "Sydney",
    悉尼: "Sydney",
    Melbourne: "Melbourne",
    墨尔本: "Melbourne",
    Brisbane: "Brisbane",
    Perth: "Perth",
    Australia: "Australia",
    澳洲: "Australia",
    Singapore: "Singapore",
    London: "London",
    "New York": "New York",
  };
  const found = Object.entries(locationMap)
    .filter(([raw]) => includesWord(text, raw))
    .map(([, normalized]) => normalized);

  if (found.length > 0) return unique(found).join(" / ");

  const match = text.match(/\b(?:in|near|around)\s+([A-Z][A-Za-z\s]{2,30})(?:\.|,|\n|$)/);
  return match?.[1]?.trim() ?? "";
}

function extractWorkMode(text: string): WorkMode {
  const lower = text.toLowerCase();
  if (lower.includes("remote") || lower.includes("远程")) return "remote";
  if (lower.includes("hybrid") || lower.includes("混合")) return "hybrid";
  if (lower.includes("onsite") || lower.includes("on-site") || lower.includes("office") || lower.includes("办公室")) return "onsite";
  return "";
}

function extractYears(text: string) {
  const match = text.match(/(\d{1,2})\+?\s*(?:years|yrs|year|年)/i);
  return match?.[1] ?? "";
}

function extractAuthorization(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("citizen")) return "Citizen";
  if (lower.includes("permanent resident") || lower.includes("pr")) return "Permanent resident";
  if (lower.includes("visa")) return "Visa holder";
  if (lower.includes("sponsor")) return "Requires sponsorship";
  return "";
}

function collectFacts(text: string, markers: string[]) {
  const lines = text
    .split(/\r?\n|。/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 18 && line.length < 180);

  return lines.filter((line) => markers.some((marker) => includesWord(line, marker))).slice(0, 5);
}

function parseProfile(input: string, previous: CandidateProfile): CandidateProfile {
  const text = `${previous.rawText}\n${input}`.trim();
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] ?? "";
  const skills = unique([...previous.skills, ...extractSkills(text)]);

  return {
    ...previous,
    rawText: text,
    name: previous.name || extractName(text),
    email: previous.email || email,
    phone: previous.phone || phone,
    targetRole: previous.targetRole || extractRole(text),
    targetLocation: previous.targetLocation || extractLocation(text),
    workMode: previous.workMode || extractWorkMode(text),
    yearsExperience: previous.yearsExperience || extractYears(text),
    authorization: previous.authorization || extractAuthorization(text),
    skills,
    experienceFacts: unique([
      ...previous.experienceFacts,
      ...collectFacts(text, ["experience", "built", "led", "shipped", "developed", "worked", "years"]),
    ]).slice(0, 6),
    projectFacts: unique([...previous.projectFacts, ...collectFacts(text, ["project", "tool", "app", "platform", "workflow"])]).slice(
      0,
      4,
    ),
    educationFacts: unique([...previous.educationFacts, ...collectFacts(text, ["university", "degree", "school", "education"])]).slice(
      0,
      3,
    ),
  };
}

async function readPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: { str?: string }) => item.str ?? "")
      .filter(Boolean)
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n").trim();
}

function getMissingInfo(profile: CandidateProfile) {
  const missing: string[] = [];
  if (!profile.targetRole) missing.push("Target role");
  if (!profile.targetLocation) missing.push("Target location");
  if (!profile.workMode) missing.push("Remote / hybrid / onsite preference");
  if (!profile.yearsExperience) missing.push("Years of experience");
  if (profile.skills.length === 0) missing.push("Core skills");
  return missing;
}

function scoreJob(job: Job, profile: CandidateProfile): RankedJob {
  const matchedSkills = job.requiredSkills.filter((skill) => profile.skills.some((candidateSkill) => includesWord(candidateSkill, skill)));
  const niceMatches = job.niceToHave.filter((skill) => profile.skills.some((candidateSkill) => includesWord(candidateSkill, skill)));
  const roleMatch = profile.targetRole && includesWord(job.title, profile.targetRole.split(" ")[0] ?? "") ? 16 : 0;
  const locationMatch =
    profile.workMode === "remote" && job.workMode === "remote"
      ? 18
      : profile.targetLocation && includesWord(job.location, profile.targetLocation.split(" / ")[0] ?? "")
        ? 14
        : 0;
  const skillScore = matchedSkills.length * 10 + niceMatches.length * 4;
  const experienceScore = profile.yearsExperience ? 8 : 0;
  const matchScore = Math.min(98, 35 + roleMatch + locationMatch + skillScore + experienceScore);
  const missingRequired = job.requiredSkills.filter((skill) => !matchedSkills.includes(skill));

  return {
    ...job,
    matchScore,
    matchRationale: [
      matchedSkills.length > 0 ? `Matched required skills: ${matchedSkills.join(", ")}.` : "No direct required-skill match found yet.",
      niceMatches.length > 0 ? `Also matches nice-to-have skills: ${niceMatches.join(", ")}.` : "Nice-to-have overlap is limited.",
      locationMatch > 0 ? `Location/work mode preference is aligned with ${job.location}.` : "Location/work mode needs confirmation.",
    ],
    gaps: missingRequired.length > 0 ? missingRequired : ["No major required-skill gap detected from provided facts."],
    risks: [
      profile.authorization ? `Work authorization noted: ${profile.authorization}.` : "Work authorization has not been provided.",
      missingRequired.length > 2 ? "Several required skills were not found in the uploaded facts." : "Tailoring should stay within verified facts.",
    ],
  };
}

function rankJobs(profile: CandidateProfile) {
  return mockJobs.map((job) => scoreJob(job, profile)).sort((a, b) => b.matchScore - a.matchScore);
}

function buildTailoredResume(profile: CandidateProfile, job: RankedJob): TailoredResume {
  const relevantSkills = unique([
    ...job.requiredSkills.filter((skill) => profile.skills.some((candidateSkill) => includesWord(candidateSkill, skill))),
    ...job.niceToHave.filter((skill) => profile.skills.some((candidateSkill) => includesWord(candidateSkill, skill))),
    ...profile.skills,
  ]).slice(0, 12);
  const role = profile.targetRole || job.title;
  const years = profile.yearsExperience ? `${profile.yearsExperience} years of` : "hands-on";
  const fallbackExperience =
    profile.skills.length > 0
      ? [`Built software using ${profile.skills.slice(0, 5).join(", ")} based on user-provided profile facts.`]
      : ["Experience details were not provided. Add verified resume bullets before sending this resume."];

  return {
    summary: `${profile.name || "Candidate"} is a ${role} candidate with ${years} experience relevant to ${job.title} at ${
      job.company
    }. This summary only uses the submitted profile facts and emphasizes ${relevantSkills.slice(0, 5).join(", ") || "the provided skills"}.`,
    skills: relevantSkills,
    experience: profile.experienceFacts.length > 0 ? profile.experienceFacts : fallbackExperience,
    projects: profile.projectFacts.length > 0 ? profile.projectFacts : ["Add a verified project that demonstrates the matched skills before applying."],
    education: profile.educationFacts.length > 0 ? profile.educationFacts : ["Education not provided."],
    applicationSummary: `Best positioning for this role: emphasize ${relevantSkills.slice(0, 4).join(", ") || "verified strengths"} and directly address ${
      job.gaps[0] ?? "remaining gaps"
    }.`,
    gaps: job.gaps.filter((gap) => gap !== "No major required-skill gap detected from provided facts."),
  };
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrapLine(line: string, maxLength = 88) {
  const words = line.split(/\s+/);
  const wrapped: string[] = [];
  let current = "";

  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > maxLength) {
      if (current) wrapped.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });

  if (current) wrapped.push(current);
  return wrapped.length > 0 ? wrapped : [""];
}

function createPdfBlob(lines: string[]) {
  const pageLines = lines.flatMap((line) => wrapLine(line));
  const chunks: string[][] = [];
  for (let index = 0; index < pageLines.length; index += 44) {
    chunks.push(pageLines.slice(index, index + 44));
  }

  const pageCount = Math.max(chunks.length, 1);
  const fontObjectNumber = 3 + pageCount * 2;
  const objects: string[] = [];
  const pageRefs: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");

  for (let index = 0; index < pageCount; index += 1) {
    const pageObjectNumber = 3 + index * 2;
    pageRefs.push(`${pageObjectNumber} 0 R`);
  }

  objects.push(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageCount} >>`);

  chunks.forEach((chunk, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const textCommands = [
      "BT",
      "/F1 10 Tf",
      "13 TL",
      "50 750 Td",
      ...chunk.map((line, lineIndex) => `${lineIndex === 0 ? "" : "T* "}${`(${escapePdfText(line)}) Tj`}`),
      "ET",
    ].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(`<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formatProfileSummary(profile: CandidateProfile) {
  return [
    profile.targetRole || "Role not set",
    profile.targetLocation || "Location not set",
    profile.workMode || "Work mode not set",
    profile.yearsExperience ? `${profile.yearsExperience} years` : "Years not set",
  ];
}

function getUserAvatar(user: User | null) {
  const metadata = user?.user_metadata;
  const avatar = metadata?.avatar_url ?? metadata?.picture;
  return typeof avatar === "string" ? avatar : "";
}

function getUserName(user: User | null) {
  const metadata = user?.user_metadata;
  const name = metadata?.full_name ?? metadata?.name ?? user?.email;
  return typeof name === "string" ? name : "Signed in user";
}

function getUserInitial(user: User | null) {
  return getUserName(user).trim().charAt(0).toUpperCase() || "U";
}

function mergeProfilePatch(base: CandidateProfile, patch?: Partial<CandidateProfile>): CandidateProfile {
  if (!patch) return base;

  const next = { ...base };
  const stringKeys: Array<keyof Pick<
    CandidateProfile,
    "name" | "email" | "phone" | "targetRole" | "targetLocation" | "yearsExperience" | "authorization"
  >> = ["name", "email", "phone", "targetRole", "targetLocation", "yearsExperience", "authorization"];
  const arrayKeys: Array<keyof Pick<CandidateProfile, "skills" | "experienceFacts" | "projectFacts" | "educationFacts">> = [
    "skills",
    "experienceFacts",
    "projectFacts",
    "educationFacts",
  ];

  stringKeys.forEach((key) => {
    const value = patch[key];
    if (typeof value === "string" && value.trim()) {
      next[key] = value.trim();
    }
  });

  if (patch.workMode === "remote" || patch.workMode === "hybrid" || patch.workMode === "onsite") {
    next.workMode = patch.workMode;
  }

  arrayKeys.forEach((key) => {
    const value = patch[key];
    if (Array.isArray(value) && value.length > 0) {
      next[key] = unique([...next[key], ...value.map((item) => item.trim()).filter(Boolean)]);
    }
  });

  return next;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("cv");
  const [chatInput, setChatInput] = useState("");
  const [profile, setProfile] = useState<CandidateProfile>(getInitialProfile);
  const [jobs, setJobs] = useState<RankedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [searchStatus, setSearchStatus] = useState("Waiting for instructions");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [authError, setAuthError] = useState("");
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const missingInfo = useMemo(() => getMissingInfo(profile), [profile]);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
  const userAvatar = getUserAvatar(authUser);
  const userName = getUserName(authUser);

  useEffect(() => {
    let isMounted = true;

    try {
      const supabase = getSupabaseBrowserClient();

      supabase.auth.getSession().then(({ data, error }: { data: { session: Session | null }; error: AuthError | null }) => {
        if (!isMounted) return;
        if (error) {
          setAuthError(error.message);
        }
        setAuthUser(data.session?.user ?? null);
        setAuthStatus("ready");
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
        setAuthUser(session?.user ?? null);
        setAuthStatus("ready");
        setAuthMenuOpen(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to initialize authentication.");
      setAuthStatus("ready");
      return () => {
        isMounted = false;
      };
    }
  }, []);

  function addMessage(role: MessageRole, content: string, kind: MessageKind = "text") {
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        kind,
        content,
      },
    ]);
  }

  function updateProfile(next: Partial<CandidateProfile>) {
    setProfile((current) => ({ ...current, ...next }));
  }

  async function handleGoogleSignIn() {
    setAuthError("");
    setAuthMenuOpen(false);
    setAuthStatus("working");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setAuthError(error.message);
        setAuthStatus("ready");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to start Google sign in.");
      setAuthStatus("ready");
    }
  }

  async function handleSignOut() {
    setAuthError("");
    setAuthMenuOpen(false);
    setAuthStatus("working");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
      } else {
        setAuthUser(null);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setAuthStatus("ready");
    }
  }

  function completeSearch(nextProfile: CandidateProfile, options?: { suppressMessage?: boolean }) {
    const ranked = rankJobs(nextProfile);
    setJobs(ranked);
    setSelectedJobId(ranked[0]?.id ?? "");
    setResume(null);
    setActiveTab("jobs");
    setSearchStatus(`Ranked ${ranked.length} jobs with fallback dataset`);
    if (!options?.suppressMessage) {
      addMessage("agent", `I found and ranked ${ranked.length} roles. Select a job on the right to inspect fit, gaps, and resume options.`, "status");
    }
  }

  function evaluateProfileForSearch(nextProfile: CandidateProfile, options?: { suppressMessage?: boolean }) {
    const missing = getMissingInfo(nextProfile);
    setProfile(nextProfile);
    setResume(null);

    if (missing.length > 0) {
      setJobs([]);
      setSelectedJobId("");
      setSearchStatus(`Needs ${missing.length} missing details`);
      if (!options?.suppressMessage) {
        addMessage("agent", `I need ${missing.join(", ")} before I can search and rank jobs.`, "missing-info");
      }
      return;
    }

    completeSearch(nextProfile, options);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setActiveTab("cv");
    setSearchStatus("Reading uploaded CV");
    addMessage("agent", `Reading ${file.name} and extracting profile facts.`, "status");

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const content = await readPdfText(file);
        if (!content) {
          throw new Error("No readable text found in the PDF.");
        }
        const nextProfile = parseProfile(content, {
          ...profile,
          uploadNote: `${file.name} parsed as PDF resume text.`,
        });
        nextProfile.uploadNote = `${file.name} parsed as PDF resume text.`;
        setProfile(nextProfile);
        setSearchStatus("CV parsed");
        addMessage("agent", "I extracted the CV text. I can now use it as verified evidence for matching and resume tailoring.", "status");
      } catch (error) {
        updateProfile({
          uploadNote: `${file.name} uploaded, but text extraction failed. Paste resume text to continue.`,
        });
        setSearchStatus("CV parsing failed");
        addMessage("agent", error instanceof Error ? error.message : "PDF text extraction failed.", "status");
      }
      return;
    }

    const content = await file.text();
    const nextProfile = parseProfile(content, {
      ...profile,
      uploadNote: `${file.name} loaded as resume text.`,
    });
    nextProfile.uploadNote = `${file.name} loaded as resume text.`;
    setProfile(nextProfile);
    setSearchStatus("CV parsed");
    addMessage("agent", "I loaded the resume text and updated your profile facts.", "status");
  }

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt) return;

    setChatInput("");
    addMessage("user", prompt);
    setSearchStatus("Thinking with GPT");
    setIsThinking(true);

    const locallyParsedProfile = parseProfile(prompt, profile);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          profile: locallyParsedProfile,
          missingInfo: getMissingInfo(locallyParsedProfile),
        }),
      });
      const data = (await response.json()) as AgentApiResponse;

      if (!response.ok || data.error) {
        throw new Error(data.detail || data.error || "GPT request failed.");
      }

      const nextProfile = mergeProfilePatch(locallyParsedProfile, data.profilePatch);
      const missing = getMissingInfo(nextProfile);
      const reply =
        data.reply ||
        (data.usedOpenAI ? "I updated the profile with GPT and will continue the workflow." : "I used the local parser and will continue the workflow.");

      addMessage("agent", reply, missing.length > 0 ? "missing-info" : "status");
      evaluateProfileForSearch(nextProfile, { suppressMessage: true });
    } catch (error) {
      const nextProfile = locallyParsedProfile;
      addMessage(
        "agent",
        error instanceof Error
          ? `GPT is unavailable right now, so I used the local parser instead. ${error.message}`
          : "GPT is unavailable right now, so I used the local parser instead.",
        "status",
      );
      evaluateProfileForSearch(nextProfile);
    } finally {
      setIsThinking(false);
    }
  }

  function handleMissingInfoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = parseProfile("", profile);
    evaluateProfileForSearch(nextProfile);
  }

  function handleSelectJob(jobId: string) {
    const job = jobs.find((item) => item.id === jobId);
    setSelectedJobId(jobId);
    setResume(null);
    if (job) {
      addMessage("agent", `Selected ${job.title} at ${job.company}. I opened the match detail on the right.`, "status");
    }
  }

  function handleGenerateResume() {
    if (!selectedJob) return;
    const generated = buildTailoredResume(profile, selectedJob);
    setResume(generated);
    setSearchStatus("Tailored resume preview ready");
    addMessage("agent", `Generated a fact-based resume preview for ${selectedJob.title} at ${selectedJob.company}.`, "status");
  }

  function handleDownloadPdf() {
    if (!resume || !selectedJob) return;

    const lines = [
      profile.name || "Candidate",
      [profile.email, profile.phone, profile.targetLocation].filter(Boolean).join(" | "),
      "",
      `Target role: ${selectedJob.title} - ${selectedJob.company}`,
      "",
      "Professional Summary",
      resume.summary,
      "",
      "Skills",
      resume.skills.join(", ") || "No skills provided.",
      "",
      "Experience",
      ...resume.experience.map((item) => `- ${item}`),
      "",
      "Projects",
      ...resume.projects.map((item) => `- ${item}`),
      "",
      "Education",
      ...resume.education.map((item) => `- ${item}`),
      "",
      "Tailored Application Summary",
      resume.applicationSummary,
      "",
      "Known Gaps",
      ...(resume.gaps.length > 0 ? resume.gaps.map((item) => `- ${item}`) : ["- No major required-skill gap detected from provided facts."]),
    ];

    downloadBlob(createPdfBlob(lines), `offerpilot-${selectedJob.company.toLowerCase().replace(/\W+/g, "-")}-resume.pdf`);
    addMessage("agent", "Downloaded the fixed-template PDF resume.", "status");
  }

  const profileSummary = formatProfileSummary(profile);
  const latestMissingMessage = messages.some((message) => message.kind === "missing-info") && missingInfo.length > 0;

  return (
    <main className="agent-shell">
      <aside className="sidebar" aria-label="OfferPilot workspace">
        <div className="brand-block">
          <div className="auth-control">
            {authUser ? (
              <>
                <button
                  className="avatar-button"
                  type="button"
                  onClick={() => setAuthMenuOpen((current) => !current)}
                  title={userName}
                  aria-label={`${userName} account menu`}
                  aria-expanded={authMenuOpen}
                >
                  {userAvatar ? <img src={userAvatar} alt="" referrerPolicy="no-referrer" /> : <span>{getUserInitial(authUser)}</span>}
                </button>
                {authMenuOpen ? (
                  <div className="auth-popover" role="menu">
                    <div>
                      <strong>{userName}</strong>
                      {authUser.email ? <span>{authUser.email}</span> : null}
                    </div>
                    <button type="button" onClick={handleSignOut} role="menuitem">
                      Log out
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <button className="google-login-button" type="button" onClick={handleGoogleSignIn} disabled={authStatus !== "ready"}>
                {authStatus === "checking" ? "Checking" : authStatus === "working" ? "Opening" : "Log in"}
              </button>
            )}
          </div>
          <span className="wordmark">OfferPilot</span>
          <p>Autonomous job search and tailored resume generation.</p>
          {authError ? <p className="auth-error">{authError}</p> : null}
        </div>

        <div className="sidebar-tabs" role="tablist" aria-label="Workspace sections">
          <button className={activeTab === "cv" ? "tab-button active" : "tab-button"} type="button" onClick={() => setActiveTab("cv")}>
            Uploaded CV
          </button>
          <button className={activeTab === "jobs" ? "tab-button active" : "tab-button"} type="button" onClick={() => setActiveTab("jobs")}>
            Job Search
          </button>
        </div>

        <section className={activeTab === "cv" ? "sidebar-panel" : "sidebar-panel hidden-panel"}>
          <p className="small-caps">Source Document</p>
          <label className="upload-zone" htmlFor="resumeUpload">
            <span>Upload CV</span>
            <small>PDF, Markdown, or plain text</small>
          </label>
          <input
            className="visually-hidden"
            id="resumeUpload"
            type="file"
            accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
            onChange={handleFileChange}
          />
          <p className="panel-note">{profile.uploadNote || "No CV uploaded yet. Chat instructions can still start the profile."}</p>

          <div className="profile-facts">
            {profileSummary.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <div className="fact-list">
            <p className="small-caps">Detected Skills</p>
            <p>{profile.skills.length > 0 ? profile.skills.slice(0, 12).join(", ") : "No skills detected yet."}</p>
          </div>
        </section>

        <section className={activeTab === "jobs" ? "sidebar-panel" : "sidebar-panel hidden-panel"}>
          <p className="small-caps">Search State</p>
          <div className="metric-stack">
            <div>
              <strong>{jobs.length}</strong>
              <span>Jobs ranked</span>
            </div>
            <div>
              <strong>{selectedJob ? selectedJob.matchScore : "--"}</strong>
              <span>Selected match</span>
            </div>
          </div>
          <div className="fact-list">
            <p className="small-caps">Current Intent</p>
            <p>{profile.targetRole || "Any role"} in {profile.targetLocation || "any location"}</p>
            <p>{searchStatus}</p>
          </div>
          <div className="fact-list">
            <p className="small-caps">Resume</p>
            <p>{resume ? "Tailored preview generated." : "Select a job to generate a tailored PDF resume."}</p>
          </div>
        </section>
      </aside>

      <section className="chat-column" aria-label="Agent chat">
        <header className="chat-header">
          <div>
            <p className="small-caps">Agent Chat</p>
            <h1>Tell OfferPilot what to do.</h1>
          </div>
          <div className="status-pill">{searchStatus}</div>
        </header>

        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <article className={`message ${message.role} ${message.kind}`} key={message.id}>
              <span>{message.role === "agent" ? "AI" : "You"}</span>
              <p>{message.content}</p>
            </article>
          ))}

          {latestMissingMessage ? (
            <form className="missing-card" onSubmit={handleMissingInfoSubmit}>
              <div>
                <p className="small-caps">Missing Information</p>
                <h2>Complete the search profile.</h2>
              </div>
              <div className="missing-grid">
                <label>
                  Target role
                  <input value={profile.targetRole} onChange={(event) => updateProfile({ targetRole: event.target.value })} placeholder="Software Engineer" />
                </label>
                <label>
                  Target location
                  <input value={profile.targetLocation} onChange={(event) => updateProfile({ targetLocation: event.target.value })} placeholder="Sydney" />
                </label>
                <label>
                  Years
                  <input value={profile.yearsExperience} onChange={(event) => updateProfile({ yearsExperience: event.target.value })} placeholder="4" />
                </label>
                <label>
                  Core skills
                  <input
                    value={profile.skills.join(", ")}
                    onChange={(event) =>
                      updateProfile({
                        skills: event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="React, TypeScript, Node.js"
                  />
                </label>
              </div>
              <div className="work-mode-row" aria-label="Work mode">
                {(["remote", "hybrid", "onsite"] as const).map((mode) => (
                  <button
                    className={profile.workMode === mode ? "chip-button active" : "chip-button"}
                    type="button"
                    key={mode}
                    onClick={() => updateProfile({ workMode: mode })}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button className="primary-action" type="submit">
                Continue Search
              </button>
            </form>
          ) : null}

          {isThinking ? (
            <article className="message agent loading-message" aria-label="OfferPilot is thinking">
              <span>AI</span>
              <div className="typing-indicator" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </article>
          ) : null}
        </div>

        <form className="composer" onSubmit={handleChatSubmit}>
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Example: I want software jobs in Sydney"
            aria-label="Chat with OfferPilot"
            disabled={isThinking}
          />
          <button className="primary-action" type="submit">
            {isThinking ? "Thinking" : "Send"}
          </button>
        </form>
      </section>

      <aside className="context-panel" aria-label="Structured results">
        <header className="context-header">
          <p className="small-caps">Context Panel</p>
          <h2>{resume ? "Tailored Resume" : selectedJob ? "Selected Job" : jobs.length > 0 ? "Job Matches" : "Waiting"}</h2>
        </header>

        {jobs.length === 0 ? (
          <section className="empty-state">
            <p>No ranked jobs yet.</p>
            <span>{missingInfo.length > 0 ? `Missing: ${missingInfo.join(", ")}` : "Send an instruction to start search."}</span>
          </section>
        ) : (
          <section className="job-results">
            <div className="job-list" aria-label="Ranked jobs">
              {jobs.map((job) => (
                <button className={selectedJob?.id === job.id ? "job-item active" : "job-item"} type="button" key={job.id} onClick={() => handleSelectJob(job.id)}>
                  <span>{job.matchScore}</span>
                  <div>
                    <strong>{job.title}</strong>
                    <p>{job.company} - {job.location}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedJob ? (
              <article className="job-detail">
                <div className="detail-heading">
                  <div>
                    <p className="small-caps">Match Detail</p>
                    <h3>{selectedJob.title}</h3>
                    <p>{selectedJob.company} - {selectedJob.location} - {selectedJob.workMode}</p>
                  </div>
                  <strong>{selectedJob.matchScore}</strong>
                </div>
                <p>{selectedJob.description}</p>
                <a href={selectedJob.url} target="_blank" rel="noreferrer">
                  Open job URL
                </a>
                <div className="detail-list">
                  {[...selectedJob.matchRationale, ...selectedJob.gaps, ...selectedJob.risks].map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
                <div className="panel-actions">
                  <button className="primary-action" type="button" onClick={handleGenerateResume}>
                    Generate Resume
                  </button>
                  <button className="secondary-action" type="button" onClick={handleDownloadPdf} disabled={!resume}>
                    Download PDF
                  </button>
                </div>
              </article>
            ) : null}

            {resume ? (
              <article className="resume-preview">
                <div className="resume-masthead">
                  <div>
                    <h3>{profile.name || "Candidate"}</h3>
                    <p>{[profile.email, profile.phone, profile.targetLocation].filter(Boolean).join(" - ") || "Contact details pending"}</p>
                  </div>
                  <span>Fixed template</span>
                </div>
                <p className="resume-summary">{resume.summary}</p>
                <div className="resume-sections">
                  <section>
                    <span>Skills</span>
                    <p>{resume.skills.join(", ") || "No skills provided."}</p>
                  </section>
                  <section>
                    <span>Experience</span>
                    <p>{resume.experience.join(" ")}</p>
                  </section>
                  <section>
                    <span>Projects</span>
                    <p>{resume.projects.join(" ")}</p>
                  </section>
                  <section>
                    <span>Gaps</span>
                    <p>{(resume.gaps.length > 0 ? resume.gaps : ["No major required-skill gap detected from provided facts."]).join(" ")}</p>
                  </section>
                </div>
              </article>
            ) : null}
          </section>
        )}
      </aside>
    </main>
  );
}
