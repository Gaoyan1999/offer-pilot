import Link from "next/link";

const matches = [
  {
    role: "AI Product Engineer",
    company: "Northstar Labs",
    place: "Sydney / Remote",
    score: "94",
    note: "Strong overlap across product prototyping, model APIs, and customer-facing delivery.",
  },
  {
    role: "Full Stack AI Engineer",
    company: "Kauri Systems",
    place: "Melbourne",
    score: "88",
    note: "Excellent technical fit with one gap around enterprise authentication ownership.",
  },
  {
    role: "Product Engineer, Agents",
    company: "Lumen Works",
    place: "Remote APAC",
    score: "83",
    note: "Relevant agent workflow experience, moderate gap in evaluation infrastructure.",
  },
];

const questions = ["Target location", "Remote preference", "Years of experience"];

export default function Home() {
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
          View Matches
        </Link>
      </nav>

      <section className="hero-section">
        <div className="section-label">
          <span />
          <p>Candidate Command Desk</p>
          <span />
        </div>
        <h1>Shape the search before the market sees you.</h1>
        <p className="hero-copy">
          A quiet workspace for turning a resume, a target role, and a few constraints into considered job matches and
          a tailored application draft.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/profile">
            Start Profile
          </Link>
          <Link className="button button-secondary" href="/resume">
            Preview Resume
          </Link>
        </div>
      </section>

      <section className="workspace-grid" aria-label="OfferPilot workspace preview">
        <article className="input-panel">
          <p className="small-caps">Free Input</p>
          <h2>Tell OfferPilot what kind of work should find you.</h2>
          <div className="paper-field">
            <p>
              I am targeting AI product engineer roles in Sydney or remote APAC. I have shipped full-stack tools,
              evaluated model outputs, and led customer pilots from prototype to production.
            </p>
          </div>
          <div className="upload-strip">
            <span>PDF Resume</span>
            <span>Markdown</span>
            <span>Plain Text</span>
          </div>
        </article>

        <aside className="question-panel">
          <p className="small-caps">Follow-Up</p>
          <h3>Three details refine the first pass.</h3>
          <div className="question-list">
            {questions.map((question) => (
              <div className="question-row" key={question}>
                <span />
                <p>{question}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="section-block">
        <div className="section-label">
          <span />
          <p>Top Matches</p>
          <span />
        </div>
        <div className="match-list">
          {matches.map((match) => (
            <article className="match-card" key={`${match.company}-${match.role}`}>
              <div>
                <p className="small-caps">{match.company}</p>
                <h3>{match.role}</h3>
                <p>{match.place}</p>
              </div>
              <p className="match-note">{match.note}</p>
              <div className="score-lockup">
                <span>{match.score}</span>
                <small>Match</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
