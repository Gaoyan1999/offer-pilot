import { includesWord } from "./skills";
import { Job, JobSearchProfile, RankedJob } from "./types";

export function scoreJob(job: Job, profile: JobSearchProfile): RankedJob {
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
      profile.yearsExperience ? `${profile.yearsExperience} years of experience noted.` : "Years of experience has not been provided.",
      missingRequired.length > 2 ? "Several required skills were not found in the uploaded facts." : "Tailoring should stay within verified facts.",
    ],
  };
}

export function rankJobs(jobs: Job[], profile: JobSearchProfile) {
  return jobs.map((job) => scoreJob(job, profile)).sort((a, b) => b.matchScore - a.matchScore);
}
