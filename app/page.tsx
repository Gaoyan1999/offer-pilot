"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import { fallbackJobs } from "../lib/jobs/fallback";
import { extractSkills, includesWord, unique } from "../lib/jobs/skills";
import { rankJobs } from "../lib/jobs/ranking";
import { RankedJob, WorkMode } from "../lib/jobs/types";

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

type JobSearchResponse = {
  jobs: RankedJob[];
  fallback: boolean;
  providers: ProviderSearchStatus[];
};

type ImportedJobsResponse = {
  jobs: RankedJob[];
  count: number;
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("cv");
  const [chatInput, setChatInput] = useState("");
  const [profile, setProfile] = useState<CandidateProfile>(getInitialProfile);
  const [jobs, setJobs] = useState<RankedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [searchStatus, setSearchStatus] = useState("Waiting for instructions");

  const missingInfo = useMemo(() => getMissingInfo(profile), [profile]);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("importedJobs") !== "1") return;

    params.delete("importedJobs");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
    void loadImportedJobs({ silentIfEmpty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function completeSearch(nextProfile: CandidateProfile) {
    setActiveTab("jobs");
    setSearchStatus("Searching Adzuna and Google Jobs");
    addMessage("agent", "Searching Adzuna first and Google Jobs as a supplemental source.", "status");

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

      setJobs(ranked);
      setSelectedJobId(ranked[0]?.id ?? "");
      setResume(null);
      setSearchStatus(`Ranked ${ranked.length} jobs from ${sourceSummary}`);
      addMessage("agent", `I found and ranked ${ranked.length} roles from ${sourceSummary}. Select a job on the right to inspect fit, gaps, and resume options.`, "status");
    } catch (error) {
      const ranked = rankJobs(fallbackJobs, nextProfile);
      setJobs(ranked);
      setSelectedJobId(ranked[0]?.id ?? "");
      setResume(null);
      setSearchStatus(`Ranked ${ranked.length} jobs with fallback dataset`);
      addMessage(
        "agent",
        `Real job search was unavailable, so I ranked the fallback dataset instead. ${error instanceof Error ? error.message : "Unknown error"}`,
        "status",
      );
    }
  }

  async function evaluateProfileForSearch(nextProfile: CandidateProfile) {
    const missing = getMissingInfo(nextProfile);
    setProfile(nextProfile);
    setResume(null);

    if (missing.length > 0) {
      setJobs([]);
      setSelectedJobId("");
      setSearchStatus(`Needs ${missing.length} missing details`);
      addMessage("agent", `I need ${missing.join(", ")} before I can search and rank jobs.`, "missing-info");
      return;
    }

    await completeSearch(nextProfile);
  }

  async function loadImportedJobs(options: { silentIfEmpty?: boolean } = {}) {
    setActiveTab("jobs");
    setSearchStatus("Loading browser-imported jobs");

    try {
      const response = await fetch(`/api/jobs/import?${buildSearchParams(profile).toString()}`);
      if (!response.ok) {
        throw new Error(`Imported job load failed with ${response.status}`);
      }

      const result = (await response.json()) as ImportedJobsResponse;
      if (!Array.isArray(result.jobs) || result.jobs.length === 0) {
        setSearchStatus("No browser-imported jobs found");
        if (!options.silentIfEmpty) {
          addMessage("agent", "No imported jobs are available yet. Use the Chrome extension on a job search page, then load imported jobs again.", "status");
        }
        return;
      }

      setJobs(result.jobs);
      setSelectedJobId(result.jobs[0]?.id ?? "");
      setResume(null);
      setSearchStatus(`Ranked ${result.jobs.length} browser-imported jobs`);
      addMessage("agent", `Loaded and ranked ${result.jobs.length} jobs imported from your browser.`, "status");
    } catch (error) {
      setSearchStatus("Imported job load failed");
      addMessage("agent", error instanceof Error ? error.message : "Could not load imported jobs.", "status");
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

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt) return;

    setChatInput("");
    addMessage("user", prompt);
    const nextProfile = parseProfile(prompt, profile);
    void evaluateProfileForSearch(nextProfile);
  }

  function handleMissingInfoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = parseProfile("", profile);
    void evaluateProfileForSearch(nextProfile);
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
          <span className="wordmark">OfferPilot</span>
          <p>Autonomous job search and tailored resume generation.</p>
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
          <div className="sidebar-actions">
            <button className="primary-action sidebar-action" type="button" onClick={handleSearchWithExtension}>
              Search with Extension
            </button>
            <button className="secondary-action sidebar-action" type="button" onClick={handleLoadImportedJobs}>
              Load Imported Jobs
            </button>
          </div>
        </section>
      </aside>

      <section className="chat-column" aria-label="Agent chat">
        <header className="chat-header">
          <div>
            <p className="small-caps">Agent Chat</p>
            <h1>Tell OfferPilot what to do.</h1>
          </div>
          <div className="chat-header-actions">
            <button className="primary-action header-action" type="button" onClick={handleSearchWithExtension}>
              Search with Extension
            </button>
            <div className="status-pill">{searchStatus}</div>
          </div>
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
        </div>

        <form className="composer" onSubmit={handleChatSubmit}>
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Example: I want software jobs in Sydney"
            aria-label="Chat with OfferPilot"
          />
          <button className="primary-action" type="submit">
            Send
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
                    <p>{job.company} - {job.location} - {formatSource(job.source)}</p>
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
