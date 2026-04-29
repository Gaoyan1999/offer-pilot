import Link from "next/link";

const sections = ["Summary", "Skills", "Experience", "Projects", "Education"];

export default function ResumePage() {
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
        <Link className="nav-action" href="/profile">
          Edit Profile
        </Link>
      </nav>

      <header className="page-header">
        <p className="small-caps">Resume Studio</p>
        <h1>A fixed template with room for judgment.</h1>
        <p>
          The preview emphasizes fact-based tailoring: relevant skills move forward, unsupported claims stay out, and
          job-specific framing remains visibly tied to supplied evidence.
        </p>
      </header>

      <section className="resume-layout">
        <aside className="detail-card">
          <p className="small-caps">Target Job</p>
          <h2>Northstar Labs · AI Product Engineer</h2>
          <p>
            Needs a builder who can move between product discovery, model API constraints, frontend polish, and
            customer-facing implementation.
          </p>
          <div className="rule-list">
            <p>Highlight model evaluation and product judgment.</p>
            <p>Move React, TypeScript, and API delivery into the first skills row.</p>
            <p>Flag enterprise SSO as a gap instead of inventing ownership.</p>
          </div>
        </aside>

        <article className="resume-preview">
          <div className="resume-masthead">
            <div>
              <p className="small-caps">Tailored Draft</p>
              <h2>Daniel Candidate</h2>
            </div>
            <span>Sydney · Remote APAC</span>
          </div>
          <p className="resume-summary">
            Product-minded full-stack engineer focused on AI interfaces, practical evaluation loops, and shipping tools
            that make model behavior legible to users and teams.
          </p>
          <div className="resume-sections">
            {sections.map((section) => (
              <div className="resume-section-row" key={section}>
                <span>{section}</span>
                <p>Curated content block aligned to the selected role and verified candidate profile.</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
