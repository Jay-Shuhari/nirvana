// ANCHOR: TaskDetail.jsx - assignment page. Students start here: pick a repo from the Metis GitHub App, then submit
// on the project page. Supervisors see the roster with each student's project.
// ! Only repositories returned for the student's App installation are offered; there is no manual URL field.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import PageSkeleton from "../components/Skeleton.jsx";
import { Icon, useUI } from "../components/ui.jsx";
import { dueInfo } from "./Inbox.jsx";

function RepoPicker({ task, user }) {
  const nav = useNavigate();
  const { toast } = useUI();
  const [repos, setRepos] = useState(null);
  const [state, setState] = useState({ kind: "loading" });
  const [pick, setPick] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => {
    setState({ kind: "loading" });
    api("/github/repositories").then((r) => { setRepos(r); setState({ kind: "ok" }); })
      .catch((e) => setState({ kind: e.code === "github_unconfigured" ? "unconfigured" : "error", message: e.message }));
  };
  useEffect(load, []);
  const due = dueInfo(task.due);
  const closed = due.bucket === "overdue";

  async function start() {
    const repo = repos.find((r) => `${r.installation_id}:${r.full_name}` === pick);
    if (!repo) return toast.error("Choose a repository first.");
    setBusy(true);
    try {
      const p = await api("/projects", { method: "POST", body: { task: task.id, repo: repo.full_name, installation_id: repo.installation_id } });
      toast.success("Task started. Submit when your work is ready.");
      nav(`/projects/${p.id}`);
    } catch (e) { toast.error(e.message); setBusy(false); }
  }
  async function reconnect() {
    try { const { url } = await api("/github/install", { method: "POST", body: { return_to: "/settings" } }); window.location.assign(url); }
    catch (e) { toast.error(e.message); }
  }

  if (closed) return <div className="banner bad"><span>The deadline has passed. New work can't be started for this task.</span></div>;
  return (<section className="panel" aria-labelledby="pick-title" style={{ marginTop: 24 }}>
    <h2 id="pick-title" style={{ margin: "0 0 4px" }}>Start this task</h2>
    <div className="grey">Choose the repository you'll submit. Only repositories you granted to the Metis GitHub App are listed.</div>
    <div role="status" aria-live="polite">
      {state.kind === "loading" && <div style={{ marginTop: 12 }}><span className="sr-only">Loading your repositories...</span><div className="skeleton-shape" style={{ height: 44, marginBottom: 8 }} /><div className="skeleton-shape" style={{ height: 44 }} /></div>}
      {state.kind === "unconfigured" && <div className="banner warn" style={{ marginTop: 12 }}><span>The Metis GitHub App isn't configured on this server, so repositories can't be listed. Tell your supervisor.</span></div>}
      {state.kind === "error" && <div className="banner bad" style={{ marginTop: 12 }}><span>GitHub didn't respond: {state.message}</span><button className="btn sm" onClick={load}><Icon name="refresh" /><span>Retry</span></button></div>}
    </div>
    {state.kind === "ok" && (repos.length === 0 ? <div className="empty" style={{ marginTop: 12 }}>
      {user.github?.installations ? <><b>The Metis App can't see any repositories yet.</b><br />Grant it access to the repository for this task on GitHub, then come back.</>
        : <><b>GitHub isn't connected.</b><br />Install the Metis GitHub App to choose a repository.</>}
      <br /><br /><button className="btn primary" onClick={reconnect}><Icon name="github" /><span>{user.github?.installations ? "Choose repositories on GitHub" : "Install the Metis App"}</span></button>
      <button className="btn" style={{ marginLeft: 8 }} onClick={load}><Icon name="refresh" /><span>Refresh</span></button></div> : <>
      {repos.length > 6 && <input type="search" style={{ marginTop: 12 }} placeholder="Filter repositories" aria-label="Filter repositories" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="repo-list" role="radiogroup" aria-labelledby="pick-title">
        {repos.filter((r) => r.full_name.toLowerCase().includes(q.toLowerCase())).map((r) => { const v = `${r.installation_id}:${r.full_name}`; return (
          <label key={v} className={`repo-option ${pick === v ? "on" : ""}`}>
            <input type="radio" name="repo" value={v} checked={pick === v} onChange={() => setPick(v)} />
            <Icon name={r.private ? "lock" : "github"} /><span className="grow mono">{r.full_name}</span>
            <span className="badge">{r.private ? "Private" : "Public"}</span></label>); })}
      </div>
      <div className="row between wrap" style={{ marginTop: 16 }}>
        <span className="help" style={{ margin: 0 }}>Choosing a repository doesn't submit anything. You submit from the next page.</span>
        <div className="row"><button className="btn" onClick={load} aria-label="Refresh repositories"><Icon name="refresh" /></button>
          <button className="btn primary" onClick={start} disabled={!pick || busy}><span>{busy ? "Checking GitHub..." : "Start task"}</span><Icon name="arrow" /></button></div>
      </div></>)}
  </section>);
}

export default function TaskDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useUI();
  const [task, setTask] = useState(null);
  useEffect(() => {
    api(`/tasks/${id}`).then(setTask).catch((error) => { toast.error(error.message); navigate("/inbox"); });
  }, [id]);
  if (!task) return <PageSkeleton variant="course" />;

  const supervisor = user.role === "supervisor";
  const due = dueInfo(task.due);
  return (<div style={{ maxWidth: 860 }}>
    <div className="grey" style={{ marginBottom: 8 }}><Link to="/inbox">Inbox</Link> / <Link to={`/courses/${task.course.id}`}>{task.course.code}</Link> / {task.title}</div>
    <h1>{task.title}</h1>
    <div className="row wrap" style={{ gap: 8 }}><span className="badge">{task.course.code}</span>
      <span className={`badge pill-due ${due.tone}`}><Icon name="clock" />{task.due ? `${due.label}${due.bucket === "later" ? "" : ` · ${new Date(task.due + "T00:00:00").toLocaleDateString(undefined, { dateStyle: "medium" })}`} · open until midnight` : "No deadline"}</span></div>
    {task.description && <p style={{ whiteSpace: "pre-wrap" }}>{task.description}</p>}
    {task.requirements.length > 0 && <section className="panel" style={{ marginTop: 20 }} aria-labelledby="req-title">
      <h2 id="req-title" style={{ margin: "0 0 8px" }}>Requirements</h2>
      <div className="help" style={{ marginTop: 0 }}>Ttonpa checks your repository against each of these. Your supervisor reviews the result.</div>
      <ol style={{ paddingLeft: 20, marginBottom: 0 }}>{task.requirements.map((requirement, index) => <li key={index} style={{ margin: "4px 0" }}>{requirement}</li>)}</ol>
    </section>}

    {!supervisor && task.project && <section className="panel row between wrap" style={{ marginTop: 24 }}>
      <div><b>{task.project.submitted ? "Submitted" : "In progress"}</b><div className="grey mono">{task.project.repo}</div></div>
      <Link className="btn primary" to={`/projects/${task.project.id}`}><span>{task.project.submitted ? "View result" : "Open and submit"}</span><Icon name="arrow" /></Link></section>}
    {!supervisor && !task.project && <RepoPicker task={task} user={user} />}

    {supervisor && <><h2>Students ({task.students.length})</h2>
      {task.students.length === 0 ? <div className="empty">No students are enrolled in this course yet.</div> :
        <div className="panel list">
          {task.students.map((student) => <div key={student.id} className="row between wrap">
            <div><b>{student.name}</b>{student.matric && <span className="grey"> · {student.matric}</span>}</div>
            {student.project
              ? <Link className="btn sm" to={`/projects/${student.project.id}`}><span>{student.project.latest ? `Score ${student.project.latest.final_score}` : student.project.submission_locked ? "Submitted" : "Started"} · Open</span></Link>
              : <span className="grey">Not started</span>}
          </div>)}
        </div>}</>}
  </div>);
}
