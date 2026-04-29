export type WorkMode = "remote" | "hybrid" | "onsite" | "";

export type JobSource = "adzuna" | "google_jobs" | "linkedin" | "seek" | "indeed" | "browser_extension" | "fallback";

export type JobSearchProfile = {
  targetRole: string;
  targetLocation: string;
  workMode: WorkMode;
  yearsExperience: string;
  skills: string[];
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: Exclude<WorkMode, "">;
  source: JobSource;
  url: string;
  description: string;
  requiredSkills: string[];
  niceToHave: string[];
  postedAt?: string;
};

export type RankedJob = Job & {
  matchScore: number;
  matchRationale: string[];
  gaps: string[];
  risks: string[];
};
