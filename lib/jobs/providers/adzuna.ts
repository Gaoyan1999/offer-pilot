import { buildSearchQuery, getPrimaryLocation, inferJobSkills, inferWorkMode, slugify, stripHtml } from "../normalize";
import { Job, JobSearchProfile } from "../types";

type AdzunaJob = {
  id?: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: {
    display_name?: string;
  };
  location?: {
    display_name?: string;
  };
};

type AdzunaResponse = {
  results?: AdzunaJob[];
};

export async function fetchAdzunaJobs(profile: JobSearchProfile, signal?: AbortSignal): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) return [];

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: buildSearchQuery(profile),
    where: getPrimaryLocation(profile.targetLocation),
    "content-type": "application/json",
  });

  const response = await fetch(`https://api.adzuna.com/v1/api/jobs/au/search/1?${params.toString()}`, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Adzuna request failed with ${response.status}`);
  }

  const data = (await response.json()) as AdzunaResponse;

  return (data.results ?? [])
    .map((item): Job | null => {
      const title = item.title?.trim() ?? "";
      const company = item.company?.display_name?.trim() ?? "Unknown company";
      const location = item.location?.display_name?.trim() ?? getPrimaryLocation(profile.targetLocation);
      const description = stripHtml(item.description ?? "");
      const url = item.redirect_url?.trim() ?? "";

      if (!title || !url) return null;

      const skills = inferJobSkills(title, description, profile.skills);

      return {
        id: `adzuna-${item.id || slugify(`${title}-${company}-${location}`)}`,
        title,
        company,
        location,
        workMode: inferWorkMode(`${location} ${description}`, profile.workMode),
        source: "adzuna",
        url,
        description,
        requiredSkills: skills.requiredSkills,
        niceToHave: skills.niceToHave,
        postedAt: item.created,
      };
    })
    .filter((job): job is Job => Boolean(job));
}
