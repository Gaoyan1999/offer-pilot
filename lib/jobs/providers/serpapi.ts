import { buildSearchQuery, getPrimaryLocation, inferJobSkills, inferWorkMode, slugify, stripHtml } from "../normalize";
import { Job, JobSearchProfile } from "../types";

type SerpApiJob = {
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  via?: string;
  detected_extensions?: {
    posted_at?: string;
    work_from_home?: boolean;
  };
  apply_options?: Array<{
    title?: string;
    link?: string;
  }>;
  related_links?: Array<{
    text?: string;
    link?: string;
  }>;
};

type SerpApiResponse = {
  jobs_results?: SerpApiJob[];
  error?: string;
};

function getJobUrl(item: SerpApiJob) {
  return item.apply_options?.find((option) => option.link)?.link ?? item.related_links?.find((link) => link.link)?.link ?? "";
}

export async function fetchSerpApiJobs(profile: JobSearchProfile, signal?: AbortSignal): Promise<Job[]> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) return [];

  const location = getPrimaryLocation(profile.targetLocation);
  const params = new URLSearchParams({
    engine: "google_jobs",
    q: `${buildSearchQuery(profile)} jobs`,
    location,
    gl: "au",
    hl: "en",
    api_key: apiKey,
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`SerpApi request failed with ${response.status}`);
  }

  const data = (await response.json()) as SerpApiResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  return (data.jobs_results ?? [])
    .map((item): Job | null => {
      const title = item.title?.trim() ?? "";
      const company = item.company_name?.trim() ?? "Unknown company";
      const jobLocation = item.location?.trim() ?? location;
      const description = stripHtml(item.description ?? "");
      const url = getJobUrl(item);

      if (!title || !url) return null;

      const skills = inferJobSkills(title, description, profile.skills);

      return {
        id: `google-jobs-${slugify(`${title}-${company}-${jobLocation}-${url}`)}`,
        title,
        company,
        location: jobLocation,
        workMode: item.detected_extensions?.work_from_home ? "remote" : inferWorkMode(`${jobLocation} ${description}`, profile.workMode),
        source: "google_jobs",
        url,
        description,
        requiredSkills: skills.requiredSkills,
        niceToHave: skills.niceToHave,
        postedAt: item.detected_extensions?.posted_at,
      };
    })
    .filter((job): job is Job => Boolean(job));
}
