// ANCHOR: Settings.jsx - profile, strengths, sign-in methods (Google/GitHub), GitHub App, password, appearance.
// TODO: photo upload (initials are shown for now). Reminder preferences land with scheduled reminders (tasks.md).
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import StrengthsForm, { checkStrengths } from "../components/StrengthsForm.jsx";
import { Avatar, Icon, useUI } from "../components/ui.jsx";
import { describeAuthError, firebaseConfigured, linkProvider } from "../lib/firebase.js";
import { GITHUB_RETURN } from "./Onboarding.jsx";

const PROVIDERS = [["google", "Google"], ["github", "GitHub"]];

export default function Settings({ user, refresh }) {
  const { toast, confirm } = useUI();
  const [sp, setSp] = useSearchParams();
  const student = user.role === "student";
  const [p, setP] = useState({ name: user.name, department: user.department || "", matric: user.matric || "" });
  const [pErr, setPErr] = useState({});
  const [pw, setPw] = useState({ old: "", new: "", confirm: "" });
  const [theme, setTheme] = useState(localStorage.getItem("dt_theme") || "");
  const [layout, setLayout] = useState(localStorage.getItem("dt_layout") || "sidebar");
  const [github, setGithub] = useState({ kind: "loading" });
  const [ob, setOb] = useState(null);
  const [answers, setAnswers] = useState({});
  const [sErr, setSErr] = useState({});
  const [busy, setBusy] = useState("");

  const loadGitHub = () => {
    setGithub({ kind: "loading" });
    api("/github/repositories")
      .then((repos) => setGithub({ kind: "ok", repos }))
      .catch((e) => setGithub({ kind: e.code === "github_unconfigured" ? "unconfigured" : "error", message: e.message }));
  };
  useEffect(() => {
    loadGitHub();
    if (student) api("/onboarding").then((d) => { setOb(d); setAnswers(d.strengths.answers || {}); }).catch((e) => toast.error(e.message));
    const gh = sp.get("github");
    if (GITHUB_RETURN[gh]) { const [kind, msg] = GITHUB_RETURN[gh]; toast[kind](msg); setSp({}, { replace: true }); refresh(); }
  }, []);

  async function saveProfile(e) {
    e.preventDefault(); setPErr({});
    if (!p.name.trim()) return setPErr({ name: "Enter your name." });
    if (student && !p.matric.trim()) return setPErr({ matric: "Your matric number is required." });
    setBusy("profile");
    try { await api("/me", { method: "PATCH", body: p }); await refresh(); toast.success("Profile saved."); }
    catch (err) { setPErr(err.fields || {}); toast.error(err.message); }
    setBusy("");
  }
  async function saveStrengths(e) {
    e.preventDefault();
    const errs = checkStrengths(ob.questions.items, answers);
    setSErr(errs);
    if (Object.keys(errs).length) return;
    setBusy("strengths");
    try { await api("/onboarding", { method: "PATCH", body: { step: "strengths", answers } }); await refresh(); toast.success("Strengths saved."); }
    catch (err) { setSErr(err.fields || {}); toast.error(err.message); }
    setBusy("");
  }
  async function savePw(e) {
    e.preventDefault();
    if (pw.new !== pw.confirm) return toast.error("New passwords do not match.");
    try { await api("/me/password", { method: "POST", body: { old: pw.old, new: pw.new } }); setPw({ old: "", new: "", confirm: "" }); toast.success("Password changed."); } catch (err) { toast.error(err.message); }
  }
  async function link(name) {
    setBusy(name);
    try { await linkProvider(name); await refresh(); toast.success(`${name === "github" ? "GitHub" : "Google"} linked.`); }
    catch (err) { toast.error(err.status ? err.message : describeAuthError(err, name)); }
    setBusy("");
  }
  async function unlink(name, label) {
    if (!(await confirm({ title: `Unlink ${label}?`, body: `You won't be able to sign in with ${label} until you link it again.`, confirm: "Unlink", danger: true }))) return;
    try { await api("/auth/unlink", { method: "POST", body: { provider: name } }); await refresh(); toast.success(`${label} unlinked.`); }
    catch (err) { toast.error(err.message); }
  }
  async function connectGitHub() {
    try { const { url } = await api("/github/install", { method: "POST", body: { return_to: "/settings" } }); window.location.assign(url); }
    catch (err) { toast.error(err.message); }
  }
  function pick(t) { setTheme(t); localStorage.setItem("dt_theme", t); document.documentElement.dataset.theme = t; }
  function pickLayout(value) {
    setLayout(value);
    localStorage.setItem("dt_layout", value);
    document.documentElement.dataset.layout = value;
    window.dispatchEvent(new CustomEvent("dt_layout_change", { detail: value }));
  }
  const identity = (name) => user.identities?.find((i) => i.provider === name);
  const ghLinked = identity("github");
  const installs = user.github?.installations || 0;

  return (<div className="narrow">
    <h1>Settings</h1><div className="grey">Your profile, sign-in methods, GitHub access and how Metis looks.</div>

    <h2>Profile</h2>
    <form className="panel" onSubmit={saveProfile} noValidate>
      <div className="row" style={{ marginBottom: 8 }}><Avatar name={p.name} size={48} /><div><b>{user.email || "No email on file"}</b><div className="grey">{student ? "Student" : "Supervisor"}</div></div></div>
      <label htmlFor="s-name">Name</label><input id="s-name" value={p.name} aria-invalid={!!pErr.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      {pErr.name && <div className="field-error">{pErr.name}</div>}
      <label htmlFor="s-dept">Department</label><input id="s-dept" value={p.department} onChange={(e) => setP({ ...p, department: e.target.value })} />
      {student && <><label htmlFor="s-matric">Matric number</label><input id="s-matric" className="mono" value={p.matric} aria-invalid={!!pErr.matric} onChange={(e) => setP({ ...p, matric: e.target.value })} />
        {pErr.matric ? <div className="field-error">{pErr.matric}</div> : <div className="help">Required and unique in your academy.</div>}</>}
      <button className="btn primary" style={{ marginTop: 16 }} disabled={busy === "profile"}><span>{busy === "profile" ? "Saving..." : "Save profile"}</span></button></form>

    {student && <><h2>Developer strengths</h2>
      <form className="panel" onSubmit={saveStrengths} noValidate>
        {!ob ? <div className="skeleton-shape" style={{ height: 120 }} /> : <>
          <div className="grey">Used to build balanced groups. Your supervisor can see these answers.</div>
          <StrengthsForm questions={ob.questions.items} answers={answers} onChange={setAnswers} errors={sErr} />
          <button className="btn primary" style={{ marginTop: 20 }} disabled={busy === "strengths"}><span>{busy === "strengths" ? "Saving..." : "Save strengths"}</span></button></>}
      </form></>}

    <h2>Sign-in methods</h2>
    <div className="panel" style={{ padding: "4px 20px" }}>
      {PROVIDERS.map(([name, label]) => { const i = identity(name); return (
        <div key={name} className={`check-row ${i ? "ok" : ""}`}>
          <span className="state"><Icon name={name} size={14} /></span>
          <div className="grow"><b>{label}</b><div className="grey">{i ? `Linked${i.login ? ` as @${i.login}` : i.email ? ` · ${i.email}` : ""}` : "Not linked"}
            {name === "github" && student && " · required for students"}</div></div>
          {i ? (!(name === "github" && student) && <button className="btn sm" onClick={() => unlink(name, label)}>Unlink</button>)
            : <button className="btn sm primary" onClick={() => link(name)} disabled={!!busy || !firebaseConfigured}>{busy === name ? "Waiting..." : `Link ${label}`}</button>}
        </div>); })}
      {!firebaseConfigured && <p className="help">Google and GitHub sign-in are not configured on this deployment.</p>}
    </div>

    <h2>GitHub App</h2>
    <div className="panel" role="status" aria-live="polite">
      {github.kind === "loading" ? <div className="grey">Checking GitHub...</div>
        : github.kind === "unconfigured" ? <div><b>Not available</b><div className="grey">The Metis GitHub App isn't configured on this server.</div></div>
        : github.kind === "error" ? <div className="row between wrap"><div><b>GitHub didn't respond</b><div className="grey">{github.message}</div></div><button className="btn" onClick={loadGitHub}><Icon name="refresh" /><span>Retry</span></button></div>
        : <div className="row between wrap">
          <div><b>{!ghLinked ? "Link GitHub first" : !installs ? "App not installed" : github.repos.length ? "Connected" : "Connected, no repositories"}</b>
            <div className="grey">{!ghLinked ? "Link your GitHub account above, then install the App."
              : !installs ? "Install the Metis App so you can pick repositories for tasks."
              : github.repos.length ? `${github.repos.length} repositor${github.repos.length === 1 ? "y" : "ies"} available from ${installs} installation${installs === 1 ? "" : "s"}.`
              : "The App is installed but can't see any repositories. Grant access on GitHub."}</div></div>
          <button className="btn primary" onClick={connectGitHub} disabled={!ghLinked}><Icon name="github" /><span>{installs ? "Manage on GitHub" : "Install App"}</span></button>
        </div>}
    </div>

    {user.has_password && <><h2>Password</h2>
      <form className="panel" onSubmit={savePw}>
        <label style={{ marginTop: 0 }} htmlFor="pw-old">Current password</label><input id="pw-old" type="password" autoComplete="current-password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
        <label htmlFor="pw-new">New password</label><input id="pw-new" type="password" autoComplete="new-password" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} />
        <label htmlFor="pw-c">Confirm new password</label><input id="pw-c" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        <button className="btn primary" style={{ marginTop: 16 }}><span>Change password</span></button></form></>}

    <h2>Appearance</h2>
    <div className="seg" style={{ maxWidth: 320 }} role="radiogroup" aria-label="Theme">{[["", "System"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) =>
      <button key={v} role="radio" aria-checked={theme === v} className={theme === v ? "on" : ""} onClick={() => pick(v)}>{l}</button>)}</div>
    <h3 style={{ marginTop: 16 }}>App layout</h3>
    <div className="seg" style={{ maxWidth: 360 }} role="radiogroup" aria-label="App layout">
      {[["sidebar", "Sidebar"], ["mobile", "Mobile tabs"]].map(([value, label]) =>
        <button type="button" key={value} role="radio" aria-checked={layout === value} className={layout === value ? "on" : ""} onClick={() => pickLayout(value)}>{label}</button>)}
    </div>
  </div>);
}
