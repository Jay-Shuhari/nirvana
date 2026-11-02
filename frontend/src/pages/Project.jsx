// ======================================================================
// ANCHOR: Project.jsx
// FILE: frontend/src/pages/Project.jsx
// ROLE: Project detail: score, timeline, requirements check, evidence, history. Students edit/delete; supervisors override.
// SEE:  .tours/03-override-and-cohort.tour
// ======================================================================
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, dot } from "../api.js";
import { Icon, useUI } from "../components/ui.jsx";
import PageSkeleton from "../components/Skeleton.jsx";
import ScoreBar from "../components/ScoreBar.jsx";
import Timeline from "../components/Timeline.jsx";

function AIReviewLoader() {
  return (
    <div className="ai-review-loader panel" role="status" aria-live="polite">
      <span className="sr-only">AI review in progress.</span>
      <span className="loader" aria-hidden="true" />
      <b className="ai-thinking-title" aria-hidden="true">AI is thinking</b>
      <ul className="ai-thinking-steps" aria-hidden="true">
        <li>Reading files</li>
        <li>Checking criteria</li>
        <li>Reviewing evidence</li>
        <li>Preparing feedback</li>
      </ul>
    </div>
  );
}

export default function Project({ user }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUI();
  const [p, setP] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [overallDraft, setOverallDraft] = useState({ score: "", reason: "" });
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api(`/projects/${id}`).then(setP).catch((e) => { toast.error(e.message); nav("/"); }), [id]);
  useEffect(() => { load(); }, [load]);
  if (!p) return <PageSkeleton variant="project" />;

  const sup = user.role === "supervisor"; // * supervisors get override columns, students get edit/delete/submit
  const done = p.submissions.filter((x) => x.status === "done");
  const s = done[0], prev = done[1];
  const hasReq = p.task?.requirements?.length > 0;
  const tabs = ["Overview", "Timeline", ...(hasReq ? ["Requirements"] : []), "Evidence", "History"];

  async function submit() { // ANCHOR: Submit for evaluation. ! waits for GitHub, so the button shows "Analyzing..."
    setBusy(true);
    try { await api(`/projects/${id}/submit`, { method: "POST", body: {} }); toast.success("Evaluation complete."); } catch (e) { toast.error(e.message); }
    await load(); setBusy(false);
  }
  async function saveEdit(e) {
    e.preventDefault();
    try { await api(`/projects/${id}`, { method: "PATCH", body: edit }); toast.success("Project updated."); setEdit(null); load(); } catch (err) { toast.error(err.message); }
  }
  async function remove() {
    if (!(await confirm({ title: `Delete "${p.name}"?`, body: "This removes the project and all its evaluations. This cannot be undone.", confirm: "Delete project", danger: true }))) return;
    try { await api(`/projects/${id}`, { method: "DELETE" }); toast.success("Project deleted."); nav("/"); } catch (e) { toast.error(e.message); }
  }
  async function save(c) { // ANCHOR: Save override. ! the server rejects an override without a reason
    try { await api(`/criteria/${c.id}/override`, { method: "POST", body: drafts[c.id] }); toast.success("Override saved."); setDrafts({ ...drafts, [c.id]: undefined }); load(); } catch (e) { toast.error(e.message); }
  }
  async function saveOverall(e) {
    e.preventDefault();
    try {
      await api(`/submissions/${s.id}/override`, { method: "POST", body: overallDraft });
      toast.success("Overall grade updated.");
      setOverallDraft({ score: "", reason: "" });
      load();
    } catch (e) { toast.error(e.message); }
  }
  async function resetOverall() {
    try {
      await api(`/submissions/${s.id}/override`, { method: "POST", body: { score: null } });
      toast.success("Overall grade reset to the criterion total.");
      setOverallDraft({ score: "", reason: "" });
      load();
    } catch (e) { toast.error(e.message); }
  }
  const noEval = busy ? <AIReviewLoader /> : <div className="empty"><b>No evaluation yet.</b><br />{sup ? "The student has not submitted this project." : "Click Submit for evaluation to analyse your repository. Your score, timeline and evidence will appear here."}</div>;

  return (<>
    <div className="row between wrap"><div><h1>{p.name}</h1>{p.task && <div className="grey">Task: {p.task.title}</div>}</div>
      {p.can_edit && <div className="row wrap">
        <button className="btn" onClick={() => setEdit({ name: p.name, repo: p.repo })}><Icon name="edit" /><span>Edit</span></button>
        <button className="btn danger icon" onClick={remove} aria-label="Delete project"><Icon name="trash" /></button>
        <button className="btn primary" onClick={submit} disabled={busy}><span>{busy ? "Analyzing..." : "Submit for evaluation"}</span></button></div>}</div>

    {edit && <form className="panel" style={{ marginTop: 16 }} onSubmit={saveEdit}>
      <label style={{ marginTop: 0 }}>Project name</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
      <label>Repository</label><input value={edit.repo} disabled={p.submissions.length > 0} onChange={(e) => setEdit({ ...edit, repo: e.target.value })} />
      {p.submissions.length > 0 && <div className="help">The repository is locked after the first submission.</div>}
      <div className="row" style={{ marginTop: 16 }}><button type="button" className="btn" onClick={() => setEdit(null)}><span>Cancel</span></button><button className="btn primary"><span>Save changes</span></button></div></form>}

    <dl className="props"><dt>Repository</dt><dd className="mono">github.com/{p.repo}</dd><dt>Course</dt><dd>{p.course.code} {p.course.title}</dd><dt>Supervisor</dt><dd>{p.course.supervisor}</dd>
      {sup && <><dt>Student</dt><dd>{p.student.name} {p.student.matric && <span className="grey">({p.student.matric})</span>}</dd></>}
      {s && <><dt>Commit</dt><dd className="mono">{s.sha}</dd></>}</dl>
    {p.submissions[0]?.status === "failed" && <div className="panel" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>Last analysis failed: {p.submissions[0].error}. Nothing was lost. Try again.</div>}
    {busy && s && <AIReviewLoader />}

    <div className="tabs">{tabs.map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>

    {tab === "Overview" && (!s ? noEval : <div className="panel">
      <div className="big">{s.final_score}<span className="grey" style={{ fontSize: 20, fontWeight: 400 }}> / 100</span>
        {s.final_score !== s.auto_score && <span className="badge" style={{ marginLeft: 16, verticalAlign: "middle" }}>Adjusted by supervisor</span>}
        {prev && <div className="grey" style={{ fontSize: 14, fontWeight: 400 }}>{s.final_score - prev.final_score >= 0 ? "+" : ""}{s.final_score - prev.final_score} from previous submission</div>}</div>
      {s.overall_override !== null && <p className="help">Overall grade overridden by supervisor: {s.overall_reason}</p>}
      {s.ai?.rubric?.mode === "ai" && <p className="help">Gemini's rubric recommendation: {s.auto_score}/100</p>}
      {sup && <form className="overall-override" onSubmit={saveOverall}>
        <b>Overall grade override</b>
        <div className="row wrap">
          <input aria-label="Overall grade out of 100" type="number" min="0" max="100" step="0.1" placeholder={String(s.final_score)}
            value={overallDraft.score} onChange={(e) => setOverallDraft({ ...overallDraft, score: e.target.value })} />
          <input aria-label="Reason for overall grade override" placeholder="Reason (required)" value={overallDraft.reason}
            onChange={(e) => setOverallDraft({ ...overallDraft, reason: e.target.value })} />
          <button className="btn primary" disabled={!overallDraft.score || !overallDraft.reason.trim()}>Save overall grade</button>
          {s.overall_override !== null && <button type="button" className="btn" onClick={resetOverall}>Reset</button>}
        </div>
      </form>}
      <p className="help">{s.ai?.rubric?.mode === "ai"
        ? "Gemini recommended each rubric score using repository evidence. The supervisor may override criterion scores or the overall grade."
        : "Rubric scores use repository metrics because an AI rubric review was unavailable."}</p>
      {s.ai?.mode !== "ai" && <p className="help">{s.ai?.summary}</p>}
      <table style={{ marginTop: 20 }}><thead><tr><th>Criterion</th><th style={{ width: 240 }}>Final score</th><th>AI recommendation and rationale</th>{sup && <><th>Your score</th><th>Reason</th><th /></>}</tr></thead><tbody>
        {s.criteria.map((c) => { const d = drafts[c.id]; return (
          <tr key={c.id}><td>{c.name}{c.override !== null && <div className="help" style={{ margin: 0 }}>Override: {c.reason}</div>}</td>
            <td><ScoreBar value={c.override ?? c.auto} max={c.weight} /></td>
            <td>{c.recommendation ? <><b>{c.recommendation.score}/{c.recommendation.weight}</b><div className="help">{c.recommendation.note}</div></> : <span className="grey">No AI recommendation</span>}</td>
            {sup && <><td style={{ width: 90 }}><input type="number" placeholder={String(c.auto)} value={d?.score ?? ""} onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...d, score: e.target.value } })} /></td>
              <td style={{ minWidth: 180 }}><input placeholder="Reason (required)" value={d?.reason ?? ""} onChange={(e) => setDrafts({ ...drafts, [c.id]: { ...d, reason: e.target.value } })} /></td>
              <td><button className="btn sm" disabled={!d?.score || !d?.reason} onClick={() => save(c)}><span>Save override</span></button></td></>}</tr>); })}</tbody></table></div>)}

    {tab === "Timeline" && (!s ? noEval : <>
      <div className="stats"><div><b>{s.stats.commits}</b><span>Total commits</span></div><div><b>{s.stats.longest_gap} days</b><span>Longest gap</span></div><div><b>{Math.round(s.stats.final_week_share * 100)}%</b><span>Final week activity</span></div></div>
      <div className="panel"><Timeline weekly={s.stats.weekly} longestGap={s.stats.longest_gap} /></div>
      <h2>Commit log</h2><table><thead><tr><th>Message</th><th>SHA</th><th>Date</th><th>Flag</th></tr></thead><tbody>
        {s.stats.log.map((c) => <tr key={c.sha}><td>{c.message}</td><td className="mono">{c.sha}</td><td className="grey">{c.date}</td><td>{c.generic && <span className="badge">Generic message</span>}</td></tr>)}</tbody></table></>)}

    {tab === "Requirements" && (!s ? noEval : !s.ai ? <div className="empty">This submission was not checked against the task requirements.</div> : <>
      <div className="row between wrap"><div><b>{s.ai.met} of {s.ai.total} requirements met</b><div className="grey">{s.ai.summary}</div></div>
        <span className="badge">{s.ai.mode === "ai" ? "AI review" : "Rule-based check"}</span></div>
      <table style={{ marginTop: 16 }}><thead><tr><th>Requirement</th><th>Result</th><th>Note</th></tr></thead><tbody>
        {s.ai.items.map((i, k) => <tr key={k}><td>{i.requirement}</td><td><span className="badge"><i className="dot" style={{ background: i.met ? "var(--good)" : "var(--bad)" }} />{i.met ? "Met" : "Not met"}</span></td><td className="grey">{i.note}</td></tr>)}</tbody></table>
      {s.ai.mode === "rules" && <p className="help">The rule-based check matches keywords only. A supervisor should confirm it. Add an AI key in the backend settings for a deeper review.</p>}</>)}

    {tab === "Evidence" && (!s ? noEval : Object.entries(s.evidence).map(([k, items]) => <div key={k}><h2>{s.criteria.find((c) => c.metric === k)?.name || k}</h2>
      <table><tbody>{items.map((e, i) => <tr key={i}><td className="mono" style={{ width: 280 }}>{e.path || e.sha || "-"}</td><td className="grey">{e.note}</td></tr>)}{items.length === 0 && <tr><td className="grey">Nothing flagged</td></tr>}</tbody></table></div>))}

    {tab === "History" && (p.submissions.length === 0 ? noEval : <table><thead><tr><th>Submitted</th><th>Commit</th><th>Result</th><th className="num">Score</th></tr></thead><tbody>
      {p.submissions.map((x) => <tr key={x.id}><td>{new Date(x.created).toLocaleString()}</td><td className="mono">{x.sha || "-"}</td>
        <td>{x.status === "done" ? <span className="badge"><i className="dot" style={{ background: dot(x.final_score) }} />Evaluated</span> : <span className="badge"><i className="dot" style={{ background: "var(--bad)" }} />Failed</span>}</td>
        <td className="num">{x.status === "done" ? x.final_score : "-"}</td></tr>)}</tbody></table>)}
  </>);
}
