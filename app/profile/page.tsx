import Link from "next/link";

const signals = [
  "AI product engineering",
  "Full-stack delivery",
  "Customer pilots",
  "Sydney or remote APAC",
  "Work authorization supplied",
];

const documents = ["Resume.pdf", "portfolio.md", "background note"];

export default function ProfilePage() {
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
        <Link className="nav-action" href="/jobs">
          See Matches
        </Link>
      </nav>

      <header className="page-header">
        <p className="small-caps">Candidate Profile</p>
        <h1>The search begins with a disciplined brief.</h1>
        <p>
          This static profile view shows the kind of information OfferPilot needs before searching: evidence, target
          direction, preferences, and the gaps that should prompt follow-up questions.
        </p>
      </header>

      <section className="profile-layout">
        <article className="profile-card accent-top">
          <p className="small-caps">Profile Signals</p>
          <h2>Ready for first-pass matching</h2>
          <div className="signal-list">
            {signals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </article>

        <article className="profile-card">
          <p className="small-caps">Source Material</p>
          <h2>Evidence Library</h2>
          <div className="document-list">
            {documents.map((document) => (
              <div key={document}>
                <span />
                <p>{document}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="profile-card wide-card">
          <p className="small-caps">Open Questions</p>
          <h2>Ask only what improves the search.</h2>
          <div className="question-grid">
            <p>Which role title should be treated as the primary target?</p>
            <p>Are contract roles acceptable for the first search pass?</p>
            <p>Should early-stage startups rank above larger product teams?</p>
          </div>
        </article>
      </section>
    </main>
  );
}
