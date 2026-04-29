import { Job } from "./types";

export const fallbackJobs: Job[] = [
  {
    id: "ai-product-engineer-canva",
    title: "AI Product Engineer",
    company: "Canva",
    location: "Sydney, Australia",
    workMode: "hybrid",
    source: "fallback",
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
    source: "fallback",
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
    source: "fallback",
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
    source: "fallback",
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
    source: "fallback",
    url: "https://example.com/jobs/product-engineer",
    description:
      "Ship customer-facing features end to end with React, Next.js, Node.js, SQL, and direct product discovery with users.",
    requiredSkills: ["React", "Next.js", "Node.js", "SQL", "Product Management"],
    niceToHave: ["Supabase", "Analytics", "Figma"],
  },
];
