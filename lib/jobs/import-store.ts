import { dedupeJobs, inferJobSkills, inferWorkMode, slugify, stripHtml } from "./normalize";
import { Job, JobSource, WorkMode } from "./types";

export type ImportedJobInput = {
  title?: string;
  company?: string;
  location?: string;
  workMode?: WorkMode;
  source?: string;
  url?: string;
  description?: string;
  postedAt?: string;
};

const importedJobs: Job[] = [];

function normalizeSource(source: string | undefined): JobSource {
  const value = source?.toLowerCase() ?? "";
  if (value.includes("linkedin")) return "linkedin";
  if (value.includes("seek")) return "seek";
  if (value.includes("indeed")) return "indeed";
  return "browser_extension";
}

function normalizeImportedJob(input: ImportedJobInput): Job | null {
  const title = stripHtml(input.title ?? "");
  const company = stripHtml(input.company ?? "") || "Unknown company";
  const location = stripHtml(input.location ?? "") || "Location not listed";
  const description = stripHtml(input.description ?? "");
  const url = input.url?.trim() ?? "";

  if (!title || !url) return null;

  const skills = inferJobSkills(title, description, []);
  const source = normalizeSource(input.source);

  return {
    id: `${source}-${slugify(`${title}-${company}-${location}-${url}`)}`,
    title,
    company,
    location,
    workMode: inferWorkMode(`${location} ${description}`, input.workMode ?? ""),
    source,
    url,
    description: description || "No job description was imported from the browser page.",
    requiredSkills: skills.requiredSkills,
    niceToHave: skills.niceToHave,
    postedAt: input.postedAt,
  };
}

export function addImportedJobs(inputs: ImportedJobInput[]) {
  const normalized = inputs.map(normalizeImportedJob).filter((job): job is Job => Boolean(job));
  const merged = dedupeJobs([...normalized, ...importedJobs]).slice(0, 100);
  importedJobs.splice(0, importedJobs.length, ...merged);
  return normalized.length;
}

export function getImportedJobs() {
  return [...importedJobs];
}

export function clearImportedJobs() {
  importedJobs.splice(0, importedJobs.length);
}
