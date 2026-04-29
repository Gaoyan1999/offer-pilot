"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";

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

const seedInput =
  "I am a product-minded full-stack engineer with React, Next.js, TypeScript, Node.js, SQL and OpenAI experience. I have 4 years of experience building SaaS products and AI workflow tools. I want AI product engineer roles in Sydney or remote.";

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
  if (lower.includes("frontend") || lower.includes("front-end")) return "Frontend Engineer";
  if (lower.includes("backend") || lower.includes("back-end")) return "Backend Engineer";
  if (lower.includes("product engineer")) return "Product Engineer";
  if (lower.includes("data")) return "Data Engineer";
  return "";
}

function extractLocation(text: string) {
  const locations = ["Sydney", "Melbourne", "Brisbane", "Perth", "Australia", "Singapore", "London", "New York"];
  const found = locations.filter((location) => includesWord(text, location));
  if (found.length > 0) return found.join(" / ");

  const match = text.match(/\b(?:in|near|around)\s+([A-Z][A-Za-z\s]{2,30})(?:\.|,|\n|$)/);
  return match?.[1]?.trim() ?? "";
}

function extractWorkMode(text: string): WorkMode {
  const lower = text.toLowerCase();
  if (lower.includes("remote")) return "remote";
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("onsite") || lower.includes("on-site") || lower.includes("office")) return "onsite";
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
      .map((item) => ("str" in item ? item.str : ""))
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

export default function Home() {
  const [freeText, setFreeText] = useState(seedInput);
  const [profile, setProfile] = useState<CandidateProfile>(getInitialProfile);
  const [jobs, setJobs] = useState<RankedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [trace, setTrace] = useState<string[]>(["Ready. Add resume/background details and start the agent."]);

  const missingInfo = useMemo(() => getMissingInfo(profile), [profile]);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;

  function pushTrace(message: string) {
    setTrace((current) => [message, ...current].slice(0, 8));
  }

  function updateProfile(next: Partial<CandidateProfile>) {
    setProfile((current) => ({ ...current, ...next }));
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const content = await readPdfText(file);
        if (!content) {
          throw new Error("No readable text found in the PDF.");
        }
        setFreeText((current) => `${current.trim()}\n\n${content}`.trim());
        updateProfile({
          uploadNote: `${file.name} parsed as PDF resume text.`,
        });
        pushTrace(`Extracted resume text from ${file.name}.`);
      } catch (error) {
        updateProfile({
          uploadNote: `${file.name} uploaded, but text extraction failed. Paste resume text to continue.`,
        });
        pushTrace(error instanceof Error ? error.message : "PDF text extraction failed.");
      }
      return;
    }

    const content = await file.text();
    setFreeText((current) => `${current.trim()}\n\n${content}`.trim());
    updateProfile({
      uploadNote: `${file.name} loaded as resume text.`,
    });
    pushTrace(`Loaded text from ${file.name}.`);
  }

  function handleStartAgent() {
    const nextProfile = parseProfile(freeText, profile);
    setProfile(nextProfile);
    setResume(null);
    setSelectedJobId("");
    const missing = getMissingInfo(nextProfile);

    if (missing.length > 0) {
      setJobs([]);
      pushTrace(`Need follow-up info before search: ${missing.join(", ")}.`);
      return;
    }

    const ranked = rankJobs(nextProfile);
    setJobs(ranked);
    setSelectedJobId(ranked[0]?.id ?? "");
    pushTrace("No search API key configured; used fallback mock jobs and ranked by profile fit.");
  }

  function handleSearchWithProfile() {
    const nextProfile = parseProfile("", profile);
    const missing = getMissingInfo(nextProfile);
    setProfile(nextProfile);
    setResume(null);

    if (missing.length > 0) {
      setJobs([]);
      pushTrace(`Still missing: ${missing.join(", ")}.`);
      return;
    }

    const ranked = rankJobs(nextProfile);
    setJobs(ranked);
    setSelectedJobId(ranked[0]?.id ?? "");
    pushTrace("Search completed with fallback mock dataset.");
  }

  function handleSelectJob(jobId: string) {
    setSelectedJobId(jobId);
    setResume(null);
    pushTrace("Selected job and opened match detail.");
  }

  function handleGenerateResume() {
    if (!selectedJob) return;
    const generated = buildTailoredResume(profile, selectedJob);
    setResume(generated);
    pushTrace("Generated fact-based tailored resume preview.");
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
    pushTrace("Downloaded fixed-template PDF resume.");
  }

  return (
    <main className="page-shell">
      <nav className="top-nav" aria-label="Primary navigation">
        <Link className="wordmark" href="/">
          OfferPilot
        </Link>
        <div className="nav-links">
          <Link href="/jobs">Jobs</Link>
          <Link href="/resume">Resume</Link>
          <Link href="/profile">Profile</Link>
        </div>
        <button className="nav-action" type="button" onClick={handleStartAgent}>
          Start Agent
        </button>
      </nav>

      <section className="hero-section">
        <div className="section-label">
          <span />
          <p>OfferPilot MVP</p>
          <span />
        </div>
        <h1>Job discovery and tailored resume generator.</h1>
        <p className="hero-copy">
          Upload a resume or describe your background, answer missing profile details, rank matching roles, and generate
          a fact-based tailored resume for the selected job.
        </p>
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={handleStartAgent}>
            Parse Profile
          </button>
          <button className="button button-secondary" type="button" onClick={handleSearchWithProfile}>
            Search Jobs
          </button>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="input-panel">
          <p className="small-caps">Free Input</p>
          <h2>Tell OfferPilot what kind of work should find you.</h2>

          <label htmlFor="resumeUpload">Upload resume</label>
          <input id="resumeUpload" type="file" accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" onChange={handleFileChange} />
          {profile.uploadNote ? <p>{profile.uploadNote}</p> : null}

          <label htmlFor="freeText">Background and target</label>
          <div className="paper-field">
            <textarea id="freeText" value={freeText} onChange={(event) => setFreeText(event.target.value)} rows={10} />
          </div>

          <div className="upload-strip">
            <span>PDF Resume</span>
            <span>Markdown</span>
            <span>Plain Text</span>
          </div>
        </article>

        <aside className="question-panel">
          <p className="small-caps">Follow-Up</p>
          <h3>{missingInfo.length === 0 ? "Profile is ready for search." : "Missing details before search."}</h3>
          <div className="question-list">
            {(missingInfo.length > 0 ? missingInfo : ["Enough information is available to search and rank jobs."]).map((item) => (
              <div className="question-row" key={item}>
                <span />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="profile-layout">
        <article className="profile-card accent-top">
          <p className="small-caps">Profile Controls</p>
          <h2>Complete the search profile.</h2>
          <div className="question-grid">
            <label>
              Target role
              <input value={profile.targetRole} onChange={(event) => updateProfile({ targetRole: event.target.value })} placeholder="AI Product Engineer" />
            </label>
            <label>
              Target location
              <input value={profile.targetLocation} onChange={(event) => updateProfile({ targetLocation: event.target.value })} placeholder="Sydney / Remote" />
            </label>
            <label>
              Work mode
              <select value={profile.workMode} onChange={(event) => updateProfile({ workMode: event.target.value as WorkMode })}>
                <option value="">Select</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </label>
            <label>
              Years
              <input value={profile.yearsExperience} onChange={(event) => updateProfile({ yearsExperience: event.target.value })} placeholder="4" />
            </label>
            <label>
              Work authorization
              <input
                value={profile.authorization}
                onChange={(event) => updateProfile({ authorization: event.target.value })}
                placeholder="Citizen, PR, visa holder, sponsorship required"
              />
            </label>
          </div>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={handleSearchWithProfile}>
              Search Jobs
            </button>
          </div>
        </article>

        <article className="profile-card">
          <p className="small-caps">Agent Trace</p>
          <h2>Latest execution steps.</h2>
          <div className="document-list">
            {trace.map((item, index) => (
              <div key={`${item}-${index}`}>
                <span />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="section-block">
        <div className="section-label">
          <span />
          <p>Job Matches</p>
          <span />
        </div>

        {jobs.length === 0 ? (
          <article className="detail-card">
            <p className="small-caps">Waiting</p>
            <h2>No ranked jobs yet.</h2>
            <p>Parse a profile with enough target information to see ranked job matches.</p>
          </article>
        ) : (
          <div className="jobs-layout">
            <div className="job-table" aria-label="Ranked job matches">
              <div className="table-head">
                <span>Role</span>
                <span>Location</span>
                <span>Score</span>
                <span>Gap</span>
              </div>
              {jobs.map((job) => (
                <button className="job-row" type="button" key={job.id} onClick={() => handleSelectJob(job.id)}>
                  <div>
                    <h2>{job.title}</h2>
                    <p>
                      {job.company} · {job.source}
                    </p>
                  </div>
                  <p>{job.location}</p>
                  <strong>{job.matchScore}</strong>
                  <p>{job.gaps[0]}</p>
                </button>
              ))}
            </div>

            {selectedJob ? (
              <aside className="detail-card">
                <p className="small-caps">Selected Role</p>
                <h2>{selectedJob.title}</h2>
                <p>
                  {selectedJob.company} · {selectedJob.location} · {selectedJob.workMode}
                </p>
                <p>{selectedJob.description}</p>
                <Link href={selectedJob.url} target="_blank" rel="noreferrer">
                  Open job URL
                </Link>
                <div className="detail-metrics">
                  <div>
                    <span>{selectedJob.matchScore}</span>
                    <small>Match</small>
                  </div>
                  <div>
                    <span>{selectedJob.matchRationale.length}</span>
                    <small>Reasons</small>
                  </div>
                </div>
                <div className="rule-list">
                  {[...selectedJob.matchRationale, ...selectedJob.gaps, ...selectedJob.risks].map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </aside>
            ) : null}
          </div>
        )}
      </section>

      <section className="resume-layout">
        <article className="profile-card accent-top">
          <p className="small-caps">Tailored Resume</p>
          <h2>Generate only from verified facts.</h2>
          <p>
            The preview rewrites positioning, reorders matched skills, and lists missing evidence instead of inventing
            experience.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={handleGenerateResume} disabled={!selectedJob}>
              Generate Resume
            </button>
            <button className="button button-secondary" type="button" onClick={handleDownloadPdf} disabled={!resume || !selectedJob}>
              Download PDF
            </button>
          </div>
        </article>

        <article className="resume-preview">
          {resume ? (
            <>
              <div className="resume-masthead">
                <h2>{profile.name || "Candidate"}</h2>
                <span>{[profile.email, profile.phone, profile.targetLocation].filter(Boolean).join(" · ")}</span>
              </div>
              <p className="resume-summary">{resume.summary}</p>
              <div className="resume-sections">
                <div className="resume-section-row">
                  <span>Skills</span>
                  <p>{resume.skills.join(", ") || "No skills provided."}</p>
                </div>
                <div className="resume-section-row">
                  <span>Experience</span>
                  <p>{resume.experience.join(" ")}</p>
                </div>
                <div className="resume-section-row">
                  <span>Projects</span>
                  <p>{resume.projects.join(" ")}</p>
                </div>
                <div className="resume-section-row">
                  <span>Gaps</span>
                  <p>
                    {(resume.gaps.length > 0 ? resume.gaps : ["No major required-skill gap detected from provided facts."]).join(
                      " ",
                    )}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="resume-masthead">
                <h2>Resume Preview</h2>
                <span>Fixed template</span>
              </div>
              <p className="resume-summary">Select a job and generate a fact-based resume preview.</p>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
