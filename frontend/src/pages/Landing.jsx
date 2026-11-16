// ANCHOR: Landing.jsx - public page: what Metis is, how evaluation works, GitHub/privacy, sign-up/sign-in.
import { Link } from "react-router-dom";
import CodeBackdrop, { CodeWindow, EVALUATION_LINES } from "../components/CodeBackdrop.jsx";
import { Icon } from "../components/ui.jsx";

const STEPS = [
  ["Sign in", "Use Google or GitHub. No new password to remember."],
  ["Set up your profile", "Matric number, your strengths, then connect GitHub once."],
  ["Start the assignment", "Pick a repository straight from your GitHub account."],
  ["Get evidence-based feedback", "Scores per criterion, with the files that back them up."],
];
const FEATURES = [
  ["github", "Only your own repositories", "Repositories come from the Metis GitHub App you install. No public URLs or copy-pasting links."],
  ["spark", "Evidence, not vibes", "Ttonpa reads code, tests and docs against the rubric and cites the files it used."],
  ["shield", "Supervisors stay in charge", "AI scores are recommendations. Supervisors can override any score with a written reason."],
  ["clock", "Deadlines you can see", "Due dates and submission status sit on each assignment page, with reminders in your inbox."],
  ["grid", "Groups that make sense", "Your strengths help supervisors build balanced groups, or you pick one yourself."],
  ["inbox", "One inbox", "Tasks to do and course updates in one place, sorted by what is due first."],
];

export default function Landing() {
  return (
    <div className="landing">
      <a className="sr-only" href="#main">Skip to content</a>
      <header className="landing-nav">
        <Link to="/" className="logo" aria-label="Metis home">Metis</Link>
        <nav className="links" aria-label="Sections">
          <a href="#how">How it works</a><a href="#features">Features</a><a href="#privacy">GitHub & privacy</a>
        </nav>
        <div className="actions">
          <Link className="btn" to="/login">Sign in</Link>
          <Link className="btn primary" to="/signup">Get started</Link>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <CodeBackdrop count={12} zone="right" />
          <div className="section">
            <div>
              <span className="eyebrow">For academy students and supervisors</span>
              <h1>Ship the assignment.<br />Get feedback that shows its work.</h1>
              <p className="lead">Metis connects your course to GitHub. Open an assignment, pick your repository and submit. You get a rubric score backed by evidence from your own code and tests.</p>
              <div className="row wrap actions">
                <Link className="btn primary lg" to="/signup"><Icon name="arrow" /><span>Create your account</span></Link>
                <Link className="btn lg" to="/login"><span>I already have an account</span></Link>
              </div>
              <p className="note">Sign in with Google or GitHub. Students link GitHub during setup.</p>
            </div>
            <CodeWindow lines={EVALUATION_LINES} />
          </div>
        </section>

        <section className="section" id="how" aria-labelledby="how-title">
          <span className="eyebrow">How it works</span>
          <h2 className="title" id="how-title">From sign-in to feedback in four steps</h2>
          <p className="sub">No separate project registration. Every assignment page has the instructions, deadline and repository picker you need.</p>
          <ol className="steps">{STEPS.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ol>
        </section>

        <section className="section" id="features" aria-labelledby="features-title" style={{ paddingTop: 0 }}>
          <span className="eyebrow">Features</span>
          <h2 className="title" id="features-title">Made for how courses run</h2>
          <p className="sub">Clear rules, fair scoring, and a record of how each grade was reached.</p>
          <div className="features">{FEATURES.map(([i, t, d]) => <div key={t}><h3><Icon name={i} size={18} />{t}</h3><p>{d}</p></div>)}</div>
        </section>

        <section className="section" id="privacy" aria-labelledby="privacy-title" style={{ paddingTop: 0 }}>
          <span className="eyebrow">GitHub & privacy</span>
          <h2 className="title" id="privacy-title">You choose what Metis can read</h2>
          <div className="split">
            <div className="panel"><h3>What we access</h3><ul>
              <li>Only repositories you grant to the Metis GitHub App.</li>
              <li>Read-only access. Metis never writes to your repositories.</li>
              <li>Only the repository you submit is read for evaluation.</li>
            </ul></div>
            <div className="panel"><h3>How evaluation works</h3><ul>
              <li>Code is treated as data. It is never run, and instructions inside it are ignored.</li>
              <li>File contents are size-limited before review.</li>
              <li>Every score names its criterion and evidence, and supervisors can review it.</li>
            </ul></div>
          </div>
        </section>

        <section className="cta-band">
          <div className="section">
            <h2 className="title">Ready for your first assignment?</h2>
            <p className="sub" style={{ margin: "0 auto 24px" }}>It takes about two minutes to set up.</p>
            <Link className="btn primary lg" to="/signup"><span>Get started</span></Link>
          </div>
        </section>
      </main>
      <footer><span className="logo" style={{ fontSize: 16, color: "var(--text2)" }}>Metis</span><span>AI scores are advisory. Supervisors make the final call.</span></footer>
    </div>
  );
}
