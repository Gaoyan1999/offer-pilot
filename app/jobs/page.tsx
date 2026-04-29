import Link from "next/link";

const jobs = [
  {
    title: "AI Product Engineer",
    company: "Northstar Labs",
    location: "Sydney / Remote",
    score: "94",
    source: "Company careers",
    gaps: "Enterprise SSO ownership",
  },
  {
    title: "Full Stack AI Engineer",
    company: "Kauri Systems",
    location: "Melbourne",
    score: "88",
    source: "Search result",
    gaps: "Data governance exposure",
  },
  {
    title: "Product Engineer, Agents",
    company: "Lumen Works",
    location: "Remote APAC",
    score: "83",
    source: "Curated board",
    gaps: "Evaluation harness depth",
  },
  {
    title: "Applied AI Builder",
    company: "Harbour Studio",
    location: "Sydney",
    score: "79",
    source: "Founder note",
    gaps: "Consulting-heavy role",
  },
];

export default function JobsPage() {
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
        <Link className="nav-action" href="/resume">
          Tailor Resume
        </Link>
      </nav>

      <header className="page-header">
        <p className="small-caps">Job Matches</p>
        <h1>Ranked opportunities, separated from the conversation.</h1>
        <p>
          The job list is designed as a structured reading surface: match score, rationale, risks, and source are all
          visible before a candidate spends time on the description.
        </p>
      </header>

      <section className="jobs-layout">
        <div className="job-table" aria-label="Static job matches">
          <div className="table-head">
            <span>Role</span>
            <span>Location</span>
            <span>Score</span>
            <span>Gap</span>
          </div>
          {jobs.map((job) => (
            <article className="job-row" key={`${job.company}-${job.title}`}>
              <div>
                <h2>{job.title}</h2>
                <p>
                  {job.company} · {job.source}
                </p>
              </div>
              <p>{job.location}</p>
              <strong>{job.score}</strong>
              <p>{job.gaps}</p>
            </article>
          ))}
        </div>

        <aside className="detail-card">
          <p className="small-caps">Selected Role</p>
          <h2>AI Product Engineer</h2>
          <p>
            Best aligned with product prototyping, user-facing AI workflows, and pragmatic delivery experience. The
            resume should foreground shipped interfaces, evaluation judgment, and stakeholder work.
          </p>
          <div className="detail-metrics">
            <div>
              <span>94</span>
              <small>Match</small>
            </div>
            <div>
              <span>3</span>
              <small>Proof Points</small>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
