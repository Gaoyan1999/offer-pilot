"use client";

import type { AuthChangeEvent, AuthError, Session, User } from "@supabase/supabase-js";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { fallbackJobs } from "../lib/jobs/fallback";
import { rankJobs } from "../lib/jobs/ranking";
import { extractSkills, includesWord, unique } from "../lib/jobs/skills";
import { RankedJob, WorkMode } from "../lib/jobs/types";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";

type ActiveTab = "cv" | "jobs";
type MessageRole = "agent" | "user";
type MessageKind = "text" | "missing-info" | "status";
type MessageAction = "extension-search";
type MessageActionStatus = "pending" | "accepted" | "dismissed";

type ChatMessage = {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  action?: MessageAction;
  actionStatus?: MessageActionStatus;
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

type TailoredResume = {
  summary: string;
  skills: string[];
  experience: string[];
  projects: string[];
  education: string[];
  applicationSummary: string;
  gaps: string[];
};

type ProviderSearchStatus = {
  source: "adzuna" | "google_jobs";
  ok: boolean;
  count: number;
  error?: string;
};

type AuthStatus = "checking" | "ready" | "working";
type PersistenceStatus = "signed-out" | "loading" | "saving" | "saved" | "error";

type AgentApiResponse = {
  reply?: string;
  profilePatch?: Partial<CandidateProfile>;
  usedOpenAI?: boolean;
  model?: string;
  error?: string;
  detail?: string;
};

type JobSearchResponse = {
  jobs: RankedJob[];
  fallback: boolean;
  providers: ProviderSearchStatus[];
  ranking?: RankingMeta;
};

type ImportedJobsResponse = {
  jobs: RankedJob[];
  count: number;
  ranking?: RankingMeta;
};

type RankingMeta = {
  usedAI: boolean;
  model?: string;
  fallbackReason?: string;
};

type StoredWorkspace = {
  candidate_profile: unknown;
  ranked_jobs: unknown;
  selected_job_id: unknown;
  tailored_resume: unknown;
  search_status: unknown;
};

const seedMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "agent",
    kind: "text",
    content:
      "Tell me what kind of role you want, upload a CV, or ask me to search. I will collect missing details before ranking jobs.",
  },
];

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readWorkMode(value: unknown): WorkMode {
  return value === "remote" || value === "hybrid" || value === "onsite" ? value : "";
}

function normalizeStoredProfile(value: unknown): CandidateProfile {
  if (!isRecord(value)) return getInitialProfile();

  return {
    rawText: readString(value.rawText),
    name: readString(value.name),
    email: readString(value.email),
    phone: readString(value.phone),
    targetRole: readString(value.targetRole),
    targetLocation: readString(value.targetLocation),
    workMode: readWorkMode(value.workMode),
    yearsExperience: readString(value.yearsExperience),
    authorization: readString(value.authorization),
    skills: readStringArray(value.skills),
    experienceFacts: readStringArray(value.experienceFacts),
    projectFacts: readStringArray(value.projectFacts),
    educationFacts: readStringArray(value.educationFacts),
    uploadNote: readString(value.uploadNote),
  };
}

function normalizeStoredResume(value: unknown): TailoredResume | null {
  if (!isRecord(value)) return null;

  return {
    summary: readString(value.summary),
    skills: readStringArray(value.skills),
    experience: readStringArray(value.experience),
    projects: readStringArray(value.projects),
    education: readStringArray(value.education),
    applicationSummary: readString(value.applicationSummary),
    gaps: readStringArray(value.gaps),
  };
}

function normalizeStoredJobs(value: unknown) {
  return Array.isArray(value) ? (value.filter(isRecord) as RankedJob[]) : [];
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (!isRecord(error)) return fallback;

  return [error.message, error.details, error.hint]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join(" ")
    .trim() || fallback;
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
  const hasResumeEvidence =
    Boolean(profile.uploadNote) ||
    profile.experienceFacts.length > 0 ||
    profile.projectFacts.length > 0 ||
    profile.educationFacts.length > 0;

  if (!hasResumeEvidence) missing.push("Resume");
  return missing;
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

function formatSource(source: RankedJob["source"] | ProviderSearchStatus["source"]) {
  if (source === "adzuna") return "Adzuna";
  if (source === "google_jobs") return "Google Jobs";
  if (source === "linkedin") return "LinkedIn";
  if (source === "seek") return "SEEK";
  if (source === "indeed") return "Indeed";
  if (source === "browser_extension") return "Browser Extension";
  return "Fallback";
}

function buildSearchParams(profile: CandidateProfile) {
  return new URLSearchParams({
    targetRole: profile.targetRole,
    targetLocation: profile.targetLocation,
    workMode: profile.workMode,
    yearsExperience: profile.yearsExperience,
    skills: profile.skills.join(","),
  });
}

function hasJobSearchIntent(input: string) {
  const normalized = input.toLowerCase();
  const explicitChineseIntent = /找工作|找岗位|找职位|搜工作|搜索工作|求职|投简历|看招聘/.test(input);
  const explicitEnglishIntent =
    /\b(?:find|search|look for|hunt for|apply to|browse|discover)\b/.test(normalized) &&
    /\b(?:job|jobs|role|roles|position|positions|opening|openings|vacancy|vacancies)\b/.test(normalized);
  const roleRequest = /\b(?:i want|i need|looking for|interested in)\b/.test(normalized) && /\b(?:jobs|roles|positions)\b/.test(normalized);

  return explicitChineseIntent || explicitEnglishIntent || roleRequest;
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
  const [loadedWorkspaceUserId, setLoadedWorkspaceUserId] = useState("");
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>("signed-out");
  const saveSequenceRef = useRef(0);
  const importOnLoadRef = useRef(false);
  const importedLoadSequenceRef = useRef(0);

  const missingInfo = useMemo(() => getMissingInfo(profile), [profile]);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const userAvatar = getUserAvatar(authUser);
  const userName = getUserName(authUser);
  const hasCandidateProfile = Boolean(
    profile.rawText ||
      profile.uploadNote ||
      profile.name ||
      profile.email ||
      profile.phone ||
      profile.targetRole ||
      profile.targetLocation ||
      profile.workMode ||
      profile.yearsExperience ||
      profile.authorization ||
      profile.skills.length > 0 ||
      profile.experienceFacts.length > 0 ||
      profile.projectFacts.length > 0 ||
      profile.educationFacts.length > 0,
  );
  const persistenceLabel = authUser
    ? persistenceStatus === "loading"
      ? "Loading saved workspace"
      : persistenceStatus === "saving"
        ? "Saving workspace"
        : persistenceStatus === "error"
          ? "Workspace sync failed"
          : "Workspace saved"
    : "Log in to sync workspace";

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

  useEffect(() => {
    const userId = authUser?.id ?? "";
    if (!userId) {
      setLoadedWorkspaceUserId("");
      setPersistenceStatus("signed-out");
      return;
    }

    let isMounted = true;
    setPersistenceStatus("loading");

    async function loadWorkspace() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("user_workspaces")
          .select("candidate_profile, ranked_jobs, selected_job_id, tailored_resume, search_status")
          .eq("user_id", userId)
          .maybeSingle();

        if (!isMounted) return;
        if (error) throw error;

        const workspace = data as StoredWorkspace | null;
        if (importOnLoadRef.current) {
          setLoadedWorkspaceUserId(userId);
          setPersistenceStatus("saved");
          return;
        }

        if (workspace) {
          const restoredProfile = normalizeStoredProfile(workspace.candidate_profile);
          const restoredJobs = normalizeStoredJobs(workspace.ranked_jobs);
          const restoredSelectedJobId = readString(workspace.selected_job_id);

          setProfile(restoredProfile);
          setJobs(restoredJobs);
          setSelectedJobId(restoredJobs.some((job) => job.id === restoredSelectedJobId) ? restoredSelectedJobId : "");
          setResume(normalizeStoredResume(workspace.tailored_resume));
          setSearchStatus(readString(workspace.search_status) || "Waiting for instructions");
          setActiveTab(restoredJobs.length > 0 ? "jobs" : "cv");
        }

        setLoadedWorkspaceUserId(userId);
        setPersistenceStatus("saved");
      } catch (error) {
        if (!isMounted) return;
        setLoadedWorkspaceUserId(userId);
        setPersistenceStatus("error");
        setAuthError(getErrorMessage(error, "Unable to load saved workspace."));
      }
    }

    void loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, [authUser?.id]);

  useEffect(() => {
    const userId = authUser?.id ?? "";
    if (!userId || loadedWorkspaceUserId !== userId) return;

    const timeout = window.setTimeout(async () => {
      const sequence = saveSequenceRef.current + 1;
      saveSequenceRef.current = sequence;
      setPersistenceStatus("saving");

      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.from("user_workspaces").upsert(
          {
            user_id: userId,
            candidate_profile: profile,
            ranked_jobs: jobs,
            selected_job_id: selectedJobId,
            tailored_resume: resume,
            search_status: searchStatus,
          },
          { onConflict: "user_id" },
        );

        if (error) throw error;
        if (saveSequenceRef.current === sequence) {
          setPersistenceStatus("saved");
        }
      } catch (error) {
        if (saveSequenceRef.current === sequence) {
          setPersistenceStatus("error");
          setAuthError(getErrorMessage(error, "Unable to save workspace."));
        }
      }
    }, 600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [authUser?.id, jobs, loadedWorkspaceUserId, profile, resume, searchStatus, selectedJobId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("importedJobs") !== "1") return;

    importOnLoadRef.current = true;
    params.delete("importedJobs");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
    void loadImportedJobs({ silentIfEmpty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addMessage(role: MessageRole, content: string, kind: MessageKind = "text", action?: MessageAction) {
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        kind,
        content,
        action,
        actionStatus: action ? "pending" : undefined,
      },
    ]);
  }

  function addExtensionSearchPrompt() {
    setMessages((current) => {
      if (current.some((message) => message.action === "extension-search" && message.actionStatus === "pending")) {
        return current;
      }

      return [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "agent",
          kind: "status",
          content: "I can use the Chrome extension to search LinkedIn from your current intent. Do you want me to start Search with Extension?",
          action: "extension-search",
          actionStatus: "pending",
        },
      ];
    });
  }

  function handleExtensionPromptResponse(messageId: string, accepted: boolean) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              actionStatus: accepted ? "accepted" : "dismissed",
            }
          : message,
      ),
    );

    if (accepted) {
      handleSearchWithExtension();
    }
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

  async function completeSearch(nextProfile: CandidateProfile, options?: { suppressMessage?: boolean }) {
    importedLoadSequenceRef.current += 1;
    setActiveTab("jobs");
    setSearchStatus("Searching Adzuna and Google Jobs");
    if (!options?.suppressMessage) {
      addMessage("agent", "Searching Adzuna first and Google Jobs as a supplemental source.", "status");
    }

    try {
      const response = await fetch(`/api/jobs/search?${buildSearchParams(nextProfile).toString()}`);
      if (!response.ok) {
        throw new Error(`Job search failed with ${response.status}`);
      }

      const result = (await response.json()) as JobSearchResponse;
      if (!Array.isArray(result.jobs)) {
        throw new Error("Job search returned an invalid response.");
      }

      const ranked = result.jobs;
      const activeProviders = result.providers.filter((provider) => provider.ok && provider.count > 0);
      const sourceSummary = result.fallback
        ? "fallback dataset"
        : activeProviders.map((provider) => `${formatSource(provider.source)} (${provider.count})`).join(" and ") || "real job sources";
      const rankingSummary = result.ranking?.usedAI ? `AI-ranked with ${result.ranking.model ?? "OpenAI"}` : "ranked with the local fallback scorer";

      setJobs(ranked);
      setSelectedJobId("");
      setResume(null);
      setSearchStatus(`${rankingSummary}: ${ranked.length} jobs from ${sourceSummary}`);
      if (!options?.suppressMessage) {
        addMessage("agent", `I found ${ranked.length} roles from ${sourceSummary} and ${rankingSummary}. Select a job from the left list to inspect fit, gaps, and resume options.`, "status");
      }
    } catch (error) {
      const ranked = rankJobs(fallbackJobs, nextProfile);
      setJobs(ranked);
      setSelectedJobId("");
      setResume(null);
      setSearchStatus(`Ranked ${ranked.length} jobs with fallback dataset`);
      if (!options?.suppressMessage) {
        addMessage(
          "agent",
          `Real job search was unavailable, so I ranked the fallback dataset instead. ${error instanceof Error ? error.message : "Unknown error"}`,
          "status",
        );
      }
    }
  }

  async function evaluateProfileForSearch(nextProfile: CandidateProfile, options?: { suppressMessage?: boolean }) {
    const missing = getMissingInfo(nextProfile);
    setProfile(nextProfile);
    setResume(null);

    if (missing.length > 0) {
      setJobs([]);
      setSelectedJobId("");
      setSearchStatus("Resume needed");
      if (!options?.suppressMessage) {
        addMessage("agent", "Upload a resume or paste resume text so I can rank jobs and tailor applications from verified facts.", "missing-info");
      }
      return;
    }

    await completeSearch(nextProfile, options);
  }

  async function loadImportedJobs(options: { silentIfEmpty?: boolean } = {}) {
    const sequence = importedLoadSequenceRef.current + 1;
    importedLoadSequenceRef.current = sequence;
    setActiveTab("jobs");
    setSearchStatus("Loading browser-imported jobs");
    const localParams = buildSearchParams(profile);
    localParams.set("ranking", "local");

    try {
      const response = await fetch(`/api/jobs/import?${localParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Imported job load failed with ${response.status}`);
      }

      const result = (await response.json()) as ImportedJobsResponse;
      if (!Array.isArray(result.jobs) || result.jobs.length === 0) {
        if (importedLoadSequenceRef.current !== sequence) return;
        setSearchStatus("No browser-imported jobs found");
        if (!options.silentIfEmpty) {
          addMessage("agent", "No imported jobs are available yet. Use the Chrome extension on a job search page, then load imported jobs again.", "status");
        }
        return;
      }

      if (importedLoadSequenceRef.current !== sequence) return;
      setJobs(result.jobs);
      setSelectedJobId("");
      setResume(null);
      setSearchStatus(`Loaded ${result.jobs.length} browser-imported jobs; AI ranking is running`);
      addMessage("agent", `Loaded ${result.jobs.length} selected jobs from your browser. I am ranking them in the background.`, "status");
      const aiParams = buildSearchParams(profile);
      aiParams.set("ranking", "ai");
      void refreshImportedJobsWithAi(aiParams, sequence);
    } catch (error) {
      if (importedLoadSequenceRef.current !== sequence) return;
      setSearchStatus("Imported job load failed");
      addMessage("agent", error instanceof Error ? error.message : "Could not load imported jobs.", "status");
    }
  }

  async function refreshImportedJobsWithAi(params: URLSearchParams, sequence: number) {
    try {
      const response = await fetch(`/api/jobs/import?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`AI ranking failed with ${response.status}`);
      }

      const result = (await response.json()) as ImportedJobsResponse;
      if (importedLoadSequenceRef.current !== sequence) return;
      if (!Array.isArray(result.jobs) || result.jobs.length === 0) return;

      setJobs(result.jobs);
      setSelectedJobId((current) => (result.jobs.some((job) => job.id === current) ? current : ""));
      const rankingSummary = result.ranking?.usedAI ? `AI-ranked with ${result.ranking.model ?? "OpenAI"}` : "kept the local fallback ranking";
      setSearchStatus(`${rankingSummary}: ${result.jobs.length} browser-imported jobs`);
      if (result.ranking?.usedAI) {
        addMessage("agent", `Finished AI ranking for ${result.jobs.length} browser-imported jobs.`, "status");
      }
    } catch (error) {
      if (importedLoadSequenceRef.current !== sequence) return;
      setSearchStatus("Loaded browser-imported jobs; AI ranking failed");
      addMessage("agent", error instanceof Error ? error.message : "Could not finish AI ranking.", "status");
    }
  }

  async function handleLoadImportedJobs() {
    await loadImportedJobs();
  }

  function handleSearchWithExtension() {
    setActiveTab("jobs");
    setSearchStatus("Waiting for Chrome extension");

    const timeout = window.setTimeout(() => {
      setSearchStatus("Chrome extension not detected");
      addMessage("agent", "I could not detect the OfferPilot Chrome extension. Load the extension, refresh this page, and try again.", "status");
      window.removeEventListener("message", handleExtensionResponse);
    }, 2200);

    function handleExtensionResponse(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== "offerpilot-extension" || event.data.type !== "OFFERPILOT_EXTENSION_SEARCH_STARTED") {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener("message", handleExtensionResponse);

      const payload = event.data.payload as { ok?: boolean; count?: number; error?: string };
      if (!payload.ok) {
        setSearchStatus("Extension search failed to start");
        addMessage("agent", payload.error || "The Chrome extension could not start the search.", "status");
        return;
      }

      setSearchStatus("Extension search preview opened");
      addMessage(
        "agent",
        `The Chrome extension opened LinkedIn with the OfferPilot panel on the right and found ${payload.count ?? 0} jobs. Confirm jobs in the side panel and I will load them here automatically.`,
        "status",
      );
    }

    window.addEventListener("message", handleExtensionResponse);
    window.postMessage(
      {
        source: "offerpilot-web",
        type: "OFFERPILOT_START_EXTENSION_SEARCH",
        payload: {
          targetRole: profile.targetRole || "Software Engineer",
          targetLocation: profile.targetLocation || "Sydney",
          workMode: profile.workMode,
          yearsExperience: profile.yearsExperience,
          skills: profile.skills,
        },
      },
      "*",
    );
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

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

  function handleClearCandidateProfile() {
    setActiveTab("cv");
    setProfile(getInitialProfile());
    setJobs([]);
    setSelectedJobId("");
    setResume(null);
    setSearchStatus("Candidate profile cleared");
    addMessage("agent", "Cleared the saved candidate profile, CV text, job matches, and tailored resume preview.", "status");
  }

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt) return;
    const shouldOfferExtensionSearch = hasJobSearchIntent(prompt);

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
      await evaluateProfileForSearch(nextProfile, { suppressMessage: true });
      if (shouldOfferExtensionSearch) {
        addExtensionSearchPrompt();
      }
    } catch (error) {
      const nextProfile = locallyParsedProfile;
      addMessage(
        "agent",
        error instanceof Error
          ? `GPT is unavailable right now, so I used the local parser instead. ${error.message}`
          : "GPT is unavailable right now, so I used the local parser instead.",
        "status",
      );
      await evaluateProfileForSearch(nextProfile);
      if (shouldOfferExtensionSearch) {
        addExtensionSearchPrompt();
      }
    } finally {
      setIsThinking(false);
    }
  }

  function handleSelectJob(jobId: string) {
    const job = jobs.find((item) => item.id === jobId);
    setSelectedJobId(jobId);
    setResume(null);
    if (job) {
      addMessage("agent", `Selected ${job.title} at ${job.company}. I opened the match detail on the right.`, "status");
    }
  }

  function handleDeleteJob(jobId: string) {
    importedLoadSequenceRef.current += 1;
    const job = jobs.find((item) => item.id === jobId);
    const nextJobs = jobs.filter((item) => item.id !== jobId);

    setJobs(nextJobs);
    setSelectedJobId((current) => {
      if (current && current !== jobId && nextJobs.some((item) => item.id === current)) {
        return current;
      }

      return "";
    });

    if (!selectedJob || selectedJob.id === jobId) {
      setResume(null);
    }

    setSearchStatus(nextJobs.length > 0 ? `${nextJobs.length} jobs remaining` : "No ranked jobs yet");
    if (job) {
      addMessage("agent", `Removed ${job.title} at ${job.company} from the job list.`, "status");
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
          <p className="sync-status">{persistenceLabel}</p>
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
          <div className="panel-title-row">
            <p className="small-caps">Source Document</p>
            <button
              className="clear-profile-button"
              type="button"
              onClick={handleClearCandidateProfile}
              disabled={!hasCandidateProfile}
              aria-label="Clear candidate profile"
              title="Clear candidate profile"
            >
              ×
            </button>
          </div>
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

          <div className="fact-list">
            <p className="small-caps">Detected Skills</p>
            <p>{profile.skills.length > 0 ? profile.skills.slice(0, 12).join(", ") : "No skills detected yet."}</p>
          </div>
        </section>

        <section className={activeTab === "jobs" ? "sidebar-panel jobs-panel" : "sidebar-panel jobs-panel hidden-panel"}>
          {jobs.length === 0 ? (
            <section className="sidebar-empty">
              <p>No candidates yet.</p>
              <span>{missingInfo.length > 0 ? "Upload a resume or paste resume text to start." : "Send an instruction to start search."}</span>
            </section>
          ) : (
            <div className="job-list sidebar-job-list" aria-label="Job candidates">
              {jobs.map((job) => (
                <article className={selectedJob?.id === job.id ? "job-item active" : "job-item"} key={job.id}>
                  <button className="job-select" type="button" onClick={() => handleSelectJob(job.id)}>
                    <span>{job.matchScore}</span>
                    <div>
                      <strong>{job.title}</strong>
                      <p>{job.company} - {job.location} - {formatSource(job.source)}</p>
                    </div>
                  </button>
                  <button className="job-delete" type="button" onClick={() => handleDeleteJob(job.id)} aria-label={`Remove ${job.title}`} title="Remove job">
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </aside>

      <section className="chat-column" aria-label="Agent chat">
        <header className="chat-header">
          <h1>Tell OfferPilot what to do.</h1>
        </header>

        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <article className={`message ${message.role} ${message.kind} ${message.action ? "action-message" : ""}`} key={message.id}>
              <span>{message.role === "agent" ? "AI" : "You"}</span>
              <p>{message.content}</p>
              {message.action === "extension-search" ? (
                <div className="message-actions" aria-label="Search with Extension confirmation">
                  {message.actionStatus === "pending" ? (
                    <>
                      <button
                        className="icon-action accept"
                        type="button"
                        onClick={() => handleExtensionPromptResponse(message.id, true)}
                        aria-label="Start Search with Extension"
                        title="Start Search with Extension"
                      >
                        ✓
                      </button>
                      <button
                        className="icon-action dismiss"
                        type="button"
                        onClick={() => handleExtensionPromptResponse(message.id, false)}
                        aria-label="Dismiss extension search"
                        title="Dismiss"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <p className="action-result">{message.actionStatus === "accepted" ? "Extension search requested." : "Extension search skipped."}</p>
                  )}
                </div>
              ) : null}
            </article>
          ))}

          {latestMissingMessage ? (
            <section className="missing-card" aria-label="Resume needed">
              <div>
                <p className="small-caps">Resume Needed</p>
                <h2>Upload a resume to continue.</h2>
                <p>OfferPilot needs resume text before ranking jobs or tailoring applications from verified facts.</p>
              </div>
              <label className="primary-action upload-action" htmlFor="resumeUpload">
                Upload CV
              </label>
            </section>
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
          <h2>{selectedJob ? "Selected Job" : "Waiting"}</h2>
        </header>

        {!selectedJob ? (
          <section className="empty-state">
            <p>{jobs.length > 0 ? "Select a candidate from the left." : "No selected job yet."}</p>
            <span>{jobs.length > 0 ? "The job detail panel will appear here." : "Search results will appear in the Job Search tab."}</span>
          </section>
        ) : (
          <section className="selected-job-panel">
            <article className="job-detail">
              <div className="detail-heading">
                <div>
                  <p className="small-caps">Match Detail</p>
                  <h3>{selectedJob.title}</h3>
                  <p>{selectedJob.company} - {selectedJob.location} - {selectedJob.workMode} - {formatSource(selectedJob.source)}</p>
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
