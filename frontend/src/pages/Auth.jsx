// ANCHOR: Auth.jsx - Sign in / Sign up with Google or GitHub (Firebase), plus legacy email sign-in.
// * Same page for both modes; /signup and /login only change the wording.
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, token } from "../api.js";
import CodeBackdrop, { CodeWindow } from "../components/CodeBackdrop.jsx";
import { Icon, useUI } from "../components/ui.jsx";
import { describeAuthError, firebaseConfigured, signIn } from "../lib/firebase.js";

const AUTH_LINES = [
  [["com", "// your work, straight from GitHub"]],
  [["kw", "const"], ["", " me = "], ["kw", "await"], ["", " metis.signIn("], ["str", "\"github\""], ["", ")"]],
  [["kw", "await"], ["", " me.onboard({ matric, strengths })"]],
  [["kw", "const"], ["", " repo = me.repos.pick()  "], ["com", "// App-authorized only"]],
  [["", ""]],
  [["kw", "await"], ["", " task.submit(repo)"]],
  [["com", "// ✓ submitted · feedback ready"]],
];

export default function Auth({ onLogin }) {
  const { toast } = useUI();
  const nav = useNavigate();
  const location = useLocation();
  const signup = location.pathname === "/signup";
  const [busy, setBusy] = useState(null); // "google" | "github" | "email"
  const [error, setError] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [f, setF] = useState({ email: "", password: "" });
  // * Deep links: anything other than /, /login and /signup is where the person was going.
  const dest = ["/", "/login", "/signup"].includes(location.pathname) ? (location.state?.from || "/") : `${location.pathname}${location.search}`;

  async function finish() {
    onLogin(await api("/me"));
    nav(dest, { replace: true });
  }
  async function withProvider(name) {
    if (busy) return;
    setBusy(name); setError("");
    try {
      const t = await signIn(name);
      if (t.created) toast.success("Account created. Let's set up your profile.");
      await finish();
    } catch (err) {
      setError(err.status ? err.message : describeAuthError(err, name));
    }
    setBusy(null);
  }
  async function withEmail(e) {
    e.preventDefault();
    if (busy) return;
    if (!f.email || !f.password) return setError("Enter your email and password.");
    setBusy("email"); setError("");
    try {
      let t;
      try { t = await api("/auth/login", { method: "POST", body: { username: f.email.trim().toLowerCase(), password: f.password } }); }
      catch { throw new Error("Incorrect email or password. Check your details and try again."); } // ! deliberately vague
      token.set(t.access, t.refresh);
      await finish();
    } catch (err) { setError(err.message); }
    setBusy(null);
  }

  return (
    <div className="auth">
      <main className="auth-form">
        <Link to="/" className="logo">Metis</Link>
        <h1>{signup ? "Create your account" : "Welcome back"}</h1>
        <div className="grey">{signup ? "Students and supervisors sign up with Google or GitHub." : "Sign in to continue to your courses."}</div>

        <div style={{ marginTop: 16 }}>
          <button type="button" className="provider dark" onClick={() => withProvider("github")} disabled={!!busy || !firebaseConfigured}>
            <Icon name="github" size={18} /><span>{busy === "github" ? "Waiting for GitHub..." : "Continue with GitHub"}</span>
          </button>
          <button type="button" className="provider" onClick={() => withProvider("google")} disabled={!!busy || !firebaseConfigured}>
            <Icon name="google" size={18} /><span>{busy === "google" ? "Waiting for Google..." : "Continue with Google"}</span>
          </button>
        </div>
        <div role="alert" aria-live="assertive">{error && <div className="banner bad" style={{ marginTop: 16, marginBottom: 0 }}><span>{error}</span></div>}</div>
        {!firebaseConfigured && <p className="help">Google and GitHub sign-in are not configured on this deployment yet. An administrator needs to follow docs/Firebase-GitHub-Setup.md.</p>}
        <p className="help" style={{ marginTop: 12 }}>{signup
          ? "Signed up with Google? You will link GitHub during setup so Metis can show your repositories."
          : "Use the same provider you signed up with."}</p>

        <div className="divider">or</div>
        {!legacy ? <button type="button" className="linkish grey" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => setLegacy(true)}>Sign in with email and password (older accounts)</button> :
          <form onSubmit={withEmail} noValidate>
            <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <button className="btn primary block" style={{ marginTop: 16 }} disabled={!!busy}>{busy === "email" ? "One moment..." : "Sign in"}</button>
            <p className="help">After signing in, link Google or GitHub in Settings.</p>
          </form>}

        <p className="grey" style={{ marginTop: 28, marginBottom: 0 }}>
          {signup ? <>Already have an account? <Link to="/login" state={location.state}>Sign in</Link></> : <>New to Metis? <Link to="/signup" state={location.state}>Create an account</Link></>}
        </p>
      </main>
      <aside className="auth-art" aria-hidden="true">
        <CodeBackdrop count={18} />
        <CodeWindow title="metis.ts" lines={AUTH_LINES} />
        <p className="quote">Your repositories stay yours. Metis reads only what you grant it, and only when you submit.</p>
      </aside>
    </div>
  );
}
