export const knownSkills = [
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

export function includesWord(text: string, value: string) {
  return text.toLowerCase().includes(value.toLowerCase());
}

export function extractSkills(text: string) {
  return knownSkills.filter((skill) => includesWord(text, skill));
}

export function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
