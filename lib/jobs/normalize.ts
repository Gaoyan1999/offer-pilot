import { extractSkills, unique } from "./skills";
import { Job, JobSearchProfile, WorkMode } from "./types";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function inferWorkMode(value: string, fallback: WorkMode = ""): Exclude<WorkMode, ""> {
  const lower = value.toLowerCase();
  if (lower.includes("remote") || lower.includes("work from home") || fallback === "remote") return "remote";
  if (lower.includes("hybrid") || fallback === "hybrid") return "hybrid";
  return "onsite";
}

export function inferJobSkills(title: string, description: string, profileSkills: string[]) {
  const detected = unique([...extractSkills(`${title} ${description}`), ...profileSkills.filter((skill) => description.toLowerCase().includes(skill.toLowerCase()))]);
  return {
    requiredSkills: detected.slice(0, 6),
    niceToHave: detected.slice(6, 10),
  };
}

export function buildSearchQuery(profile: JobSearchProfile) {
  const workMode = profile.workMode === "remote" ? "remote" : "";
  return unique([profile.targetRole, workMode, ...profile.skills.slice(0, 3)]).join(" ") || "software engineer";
}

export function getPrimaryLocation(location: string) {
  return location.split("/")[0]?.trim() || "Australia";
}

function canonicalUrl(value: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((param) => url.searchParams.delete(param));
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function textKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function dedupeJobs(jobs: Job[]) {
  const seen = new Set<string>();
  const deduped: Job[] = [];

  jobs.forEach((job) => {
    const key = canonicalUrl(job.url) || `${textKey(job.title)}|${textKey(job.company)}|${textKey(job.location)}`;
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(job);
  });

  return deduped;
}
