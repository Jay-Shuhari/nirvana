// ANCHOR: Onboarding.jsx - progressive setup: profile (matric) -> strengths -> GitHub link + Metis App.
// * Progress is saved on the server after each step, so people can leave and resume.
// ! The server enforces the gate (join course / start task); this page explains it and collects the data.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import PageSkeleton from "../components/Skeleton.jsx";
import StrengthsForm, { checkStrengths } from "../components/StrengthsForm.jsx";
import { Icon, useUI } from "../components/ui.jsx";
import { describeAuthError, firebaseConfigured, linkProvider } from "../lib/firebase.js";

const STEP_COPY = {
  profile: ["Your profile", "Name and matric number"],
  strengths: ["Your strengths", "What you like to build"],
  github: ["Connect GitHub", "So your repos show up"],
};
export const GITHUB_RETURN = {
  connected: ["success", "GitHub App connected. Your repositories are ready."],
  mismatch: ["error", "That installation belongs to a different GitHub account than the one you linked. Install the App on your own account."],
  taken: ["error", "That GitHub App installation is already connected to another Metis account."],
};

export default function Onboarding({ user, onDone, onSignOut }) {
  const { toast } = useUI();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [s, setS] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(null);
  const [profile, setProfile] = useState({ name: "", matric: "", department: "" });
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState(""); // * screen-reader announcement for async results

  const apply = useCallback((data, move = true) => {
    setS(data);
    setProfile({ name: data.profile.name || user.name || "", matric: data.profile.matric || "", department: data.profile.department || "" });
    setAnswers(data.strengths.answers || {});
    if (move) setStep(data.current === "done" ? data.steps[data.steps.length - 1].id : data.current);
  }, [user.name]);
  const load = useCallback((move = true) => api("/onboarding").then((d) => apply(d, move)), [apply]);

  useEffect(() => {
    load().catch((e) => setLoadError(e.message));
    const gh = params.get("github");
    if (GITHUB_RETURN[gh]) { const [kind, msg] = GITHUB_RETURN[gh]; toast[kind](msg); setParams({}, { replace: true }); }
  }, []);

  if (loadError) return <div className="center"><div className="panel card"><h3>We could not load your setup</h3><p className="grey">{loadError}</p>
    <button className="btn primary" onClick={() => { setLoadError(""); load().catch((e) => setLoadError(e.message)); }}>Try again</button></div></div>;
  if (!s || !step) return <div className="center"><div className="card"><PageSkeleton variant="auth" /></div></div>;

  const index = s.steps.findIndex((x) => x.id === step);
  const doneCount = s.steps.filter((x) => x.done).length;
  const student = s.role === "student";
  const go = (id) => { setErrors({}); setStep(id); window.scrollTo(0, 0); };
  const next = () => index < s.steps.length - 1 && go(s.steps[index + 1].id);

  async function save(body) {
    setBusy("save"); setErrors({});
    try { apply(await api("/onboarding", { method: "PATCH", body }), false); setStatus("Saved."); return true; }
    catch (e) { setErrors(e.fields || {}); toast.error(e.message); return false; }
    finally { setBusy(""); }
  }
  async function saveProfile(e) {
    e.preventDefault();
    const errs = {};
    if (!profile.name.trim()) errs.name = "Enter your full name.";
    if (student && !profile.matric.trim()) errs.matric = "Enter your matriculation number.";
    if (Object.keys(errs).length) return setErrors(errs);
    if (await save({ step: "profile", ...profile })) next();
  }
  async function saveStrengths(e) {
    e.preventDefault();
    const errs = checkStrengths(s.questions.items, answers);
    if (Object.keys(errs).length) { setErrors(errs); return toast.error("Answer the required questions."); }
    if (await save({ step: "strengths", answers })) next();
  }
  async function linkGitHub() {
    setBusy("link");
    try { await linkProvider("github"); await load(false); toast.success("GitHub account linked."); setStatus("GitHub account linked."); }
    catch (e) { toast.error(e.status ? e.message : describeAuthError(e, "github")); }
    setBusy("");
  }
  async function installApp() {
    setBusy("install");
    try { const { url } = await api("/github/install", { method: "POST", body: { return_to: "/onboarding" } }); window.location.assign(url); }
    catch (e) { toast.error(e.message); setBusy(""); }
  }
  async function finish(skip = false) {
    setBusy("finish");
    try {
      const done = await api("/onboarding/complete", { method: "POST", body: skip ? { skip_github: true } : {} });
      if (done.complete) { toast.success("You're all set."); await onDone(); nav("/", { replace: true }); }
    } catch (e) { setErrors(e.fields || {}); toast.error(e.message); }
    setBusy("");
  }

  const gh = s.github;
  const linked = !!gh.identity, installed = gh.installations.length > 0;
  const allDone = s.current === "done";

  return (
    <div className="onboard">
      <aside>
        <span className="logo">Metis</span>
        <div>
          <div className="row between" style={{ fontSize: 12, marginBottom: 8 }}><span className="grey">Setup progress</span><span>{doneCount} of {s.steps.length}</span></div>
          <div className="progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={s.steps.length} aria-valuenow={doneCount}>
            <i style={{ width: `${(doneCount / s.steps.length) * 100}%` }} /></div>
        </div>
        <ol className="stepper">
          {s.steps.map((x, i) => <li key={x.id} className={x.done ? "done" : ""} aria-current={x.id === step ? "step" : undefined}>
            <span className="n">{x.done ? <Icon name="check" size={14} /> : i + 1}</span>
            <button type="button" className="linkish" style={{ textDecoration: "none", textAlign: "left" }} onClick={() => go(x.id)}
              disabled={!x.done && i > s.steps.findIndex((y) => !y.done)}>
              {STEP_COPY[x.id][0]}<small>{STEP_COPY[x.id][1]}{x.done ? " · done" : ""}</small></button>
          </li>)}
        </ol>
        <div style={{ marginTop: "auto" }} className="help">Progress is saved after each step. Signed in as {user.email || user.name}.
          <br /><button type="button" className="linkish" onClick={onSignOut}>Sign out</button></div>
      </aside>

      <main aria-labelledby="ob-title">
        <span className="sr-only" role="status" aria-live="polite">{status}</span>
        <span className="eyebrow">Step {index + 1} of {s.steps.length}</span>

        {step === "profile" && <form onSubmit={saveProfile} noValidate>
          <h1 id="ob-title">Tell us who you are</h1>
          <div className="grey">{student ? "Your supervisor uses your matric number to match your work to the class list." : "This is how students and colleagues will see you."}</div>
          <label htmlFor="ob-name">Full name</label>
          <input id="ob-name" autoComplete="name" value={profile.name} aria-invalid={!!errors.name} aria-describedby={errors.name ? "ob-name-e" : undefined}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          {errors.name && <div className="field-error" id="ob-name-e">{errors.name}</div>}
          {student && <>
            <label htmlFor="ob-matric">Matriculation number</label>
            <input id="ob-matric" className="mono" value={profile.matric} placeholder="CSC/2021/045" autoCapitalize="characters"
              aria-invalid={!!errors.matric} aria-describedby="ob-matric-h" onChange={(e) => setProfile({ ...profile, matric: e.target.value })} />
            <div className="help" id="ob-matric-h">Required. 3–30 letters, numbers, / . _ or -. It must be unique in your academy.</div>
            {errors.matric && <div className="field-error">{errors.matric}</div>}
          </>}
          <label htmlFor="ob-dept">Department <span className="grey">(optional)</span></label>
          <input id="ob-dept" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} placeholder="Computer Science" />
          <div className="actions"><span />
            <button className="btn primary" disabled={!!busy}><span>{busy === "save" ? "Saving..." : "Save and continue"}</span><Icon name="arrow" /></button></div>
        </form>}

        {step === "strengths" && <form onSubmit={saveStrengths} noValidate>
          <h1 id="ob-title">What are you good at?</h1>
          <div className="grey">There are no wrong answers. Supervisors use this to build balanced groups, and you can change it later in Settings.</div>
          <StrengthsForm questions={s.questions.items} answers={answers} onChange={setAnswers} errors={errors} />
          <div className="actions">
            <button type="button" className="btn" onClick={() => go("profile")}><Icon name="back" /><span>Back</span></button>
            <button className="btn primary" disabled={!!busy}><span>{busy === "save" ? "Saving..." : "Save and continue"}</span><Icon name="arrow" /></button></div>
        </form>}

        {step === "github" && <section>
          <h1 id="ob-title">Connect GitHub</h1>
          <div className="grey">{student
            ? "Required for students. When you start an assignment you choose a repository from this list. Metis cannot use public links or repositories you have not granted."
            : "Optional for now. Connect GitHub to attach a reference repository to your assignments."}</div>
          <div className="panel" style={{ marginTop: 24, padding: "4px 20px" }}>
            <div className={`check-row ${linked ? "ok" : ""}`}>
              <span className="state">{linked ? <Icon name="check" size={14} /> : "1"}</span>
              <div className="grow"><b>Link your GitHub account</b>
                <div className="grey">{linked ? `Linked${gh.identity.login ? ` as @${gh.identity.login}` : ""}.` : "Sign in to GitHub to prove the account is yours."}</div>
                {!firebaseConfigured && !linked && <div className="help">GitHub sign-in is not configured on this deployment yet.</div>}</div>
              {!linked && <button className="btn primary" onClick={linkGitHub} disabled={!!busy || !firebaseConfigured}><Icon name="github" /><span>{busy === "link" ? "Waiting for GitHub..." : "Link GitHub"}</span></button>}
            </div>
            <div className={`check-row ${installed ? "ok" : ""}`}>
              <span className="state">{installed ? <Icon name="check" size={14} /> : "2"}</span>
              <div className="grow"><b>Install the Metis GitHub App</b>
                <div className="grey">{installed ? `Installed on ${gh.installations.map((i) => i.account || `installation ${i.id}`).join(", ")}.`
                  : "Choose the repositories Metis may read. You can change this on GitHub at any time."}</div>
                {!gh.app_configured && <div className="help">The Metis GitHub App is not configured on this server yet.</div>}</div>
              {!installed && <button className="btn primary" onClick={installApp} disabled={!linked || !!busy || !gh.app_configured}>
                <span>{busy === "install" ? "Opening GitHub..." : "Install App"}</span></button>}
              {installed && <button className="btn sm" onClick={installApp} disabled={!!busy}><span>Add another</span></button>}
            </div>
          </div>
          {errors.github && <div className="field-error" role="alert">{errors.github}</div>}
          <p className="help">Metis gets read-only access and never writes to your repositories.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => go(s.steps[Math.max(0, index - 1)].id)}><Icon name="back" /><span>Back</span></button>
            <div className="row wrap">
              {!student && !(linked && installed) && <button className="btn" onClick={() => finish(true)} disabled={!!busy}>Skip for now</button>}
              <button className="btn primary" onClick={() => finish(false)} disabled={!!busy || !allDone}>
                <span>{busy === "finish" ? "Finishing..." : "Finish setup"}</span><Icon name="arrow" /></button>
            </div>
          </div>
          {!allDone && <p className="help" style={{ textAlign: "right" }}>
            Still to do: {s.steps.filter((x) => !x.done).map((x) => STEP_COPY[x.id][0]).join(", ")}.</p>}
        </section>}
      </main>
    </div>
  );
}
