// ANCHOR: Dashboard.jsx - student home and the teacher's general overview.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, dot } from "../api.js";
import { Icon, useUI } from "../components/ui.jsx";
import PageSkeleton from "../components/Skeleton.jsx";
import ScoreBar from "../components/ScoreBar.jsx";

const label = (s) => (s >= 75 ? "Good" : s >= 55 ? "Needs work" : "Critical");
const Status = ({ s }) => <span className="badge"><i className="dot" style={{ background: dot(s) }} />{label(s)}</span>;

export default function Dashboard({ user }) {
  return user.role === "supervisor" ? <Teacher /> : <Student user={user} />;
}

function Student({ user }) {
  const [rows, setRows] = useState(null);
  const [tasks, setTasks] = useState([]);
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  const load = useCallback(() => Promise.all([api("/projects"), api("/tasks")]).then(([p, t]) => { setRows(p); setTasks(t); }), []);
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]);
  if (!rows) return <PageSkeleton variant="dashboard" />;

  const scored = rows.filter((r) => r.latest);
  const open = tasks.filter((t) => !t.project);
  async function remove(p) { // ! confirmation first: deleting also removes every evaluation
    if (!(await confirm({ title: `Delete "${p.name}"?`, body: "This removes the project and all its evaluations. This cannot be undone.", confirm: "Delete project", danger: true }))) return;
    try { await api(`/projects/${p.id}`, { method: "DELETE" }); toast.success("Project deleted."); load(); } catch (e) { toast.error(e.message); }
  }
  return (<>
    <div className="row between wrap"><div><h1>Hi, {user.name.split(" ")[0]}</h1><div className="grey">Your projects and what needs attention.</div></div>
      <button className="btn primary" onClick={() => nav("/projects/new")}><Icon name="plus" /><span>Register project</span></button></div>
    <div className="stats"><div><b>{rows.length}</b><span>Projects</span></div><div><b>{scored[0]?.latest.final_score ?? "-"}</b><span>Latest score</span></div><div><b>{open.length}</b><span>Open tasks</span></div></div>

    <h2>Projects</h2>
    {rows.length === 0 ? <div className="empty">No projects yet. Open a task and register your repository.<br /><br /><Link className="btn" to="/tasks"><span>See tasks</span></Link></div> :
    <table><thead><tr><th>Project</th><th>Task</th><th style={{ width: 220 }}>Latest score</th><th>Status</th><th>Last submission</th><th /></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}><td><Link to={`/projects/${r.id}`}>{r.name}</Link><div className="help" style={{ margin: 0 }}>{r.course.code}</div></td>
        <td className="grey">{r.task?.title || "General project"}</td>
        <td>{r.latest ? <ScoreBar value={r.latest.final_score} /> : <span className="grey">Not submitted</span>}</td>
        <td>{r.latest && <Status s={r.latest.final_score} />}</td>
        <td className="grey">{r.latest ? new Date(r.latest.created).toLocaleDateString() : "-"}</td>
        <td className="num"><button className="btn icon sm" onClick={() => remove(r)} aria-label={`Delete ${r.name}`}><Icon name="trash" /></button></td></tr>)}
    </tbody></table>}

    {open.length > 0 && <><h2>Open tasks</h2><div className="panel list">
      {open.slice(0, 4).map((t) => <div key={t.id} className="row between wrap"><div><b>{t.title}</b><div className="grey">{t.course.code}{t.due ? ` · due ${t.due}` : ""}</div></div>
        <Link className="btn sm" to={`/projects/new?task=${t.id}`}><span>Start</span></Link></div>)}</div></>}
  </>);
}

function Teacher() {
  const [d, setD] = useState(null);
  const { toast } = useUI();
  useEffect(() => { api("/overview").then(setD).catch((e) => toast.error(e.message)); }, []);
  if (!d) return <PageSkeleton variant="dashboard" />;
  return (<>
    <h1>Overview</h1><div className="grey">Everything across your courses.</div>
    <div className="stats"><div><b>{d.totals.courses}</b><span>Courses</span></div><div><b>{d.totals.students}</b><span>Students</span></div><div><b>{d.totals.submissions}</b><span>Evaluated projects</span></div><div><b>{d.totals.average ?? "-"}</b><span>Average score</span></div></div>

    <h2>Courses</h2>
    {d.courses.length === 0 ? <div className="empty">No courses yet.<br /><br /><Link className="btn" to="/courses"><span>Create a course</span></Link></div> :
    <table><thead><tr><th>Course</th><th className="num">Students</th><th className="num">Tasks</th><th className="num">Submitted</th><th className="num">Average</th><th className="num">Needs attention</th></tr></thead><tbody>
      {d.courses.map((c) => <tr key={c.id}><td><Link to={`/courses/${c.id}`}>{c.code} {c.title}</Link></td><td className="num">{c.students}</td><td className="num">{c.tasks}</td><td className="num">{c.submitted}</td><td className="num">{c.average ?? "-"}</td><td className="num">{c.needs_attention}</td></tr>)}</tbody></table>}

    {d.attention.length > 0 && <><h2>Needs attention</h2><table><thead><tr><th>Student</th><th>Project</th><th className="num">Score</th><th>Why</th></tr></thead><tbody>
      {d.attention.map((r) => <tr key={r.project}><td>{r.student}</td><td><Link to={`/projects/${r.project}`}>{r.name}</Link> <span className="grey">{r.course}</span></td><td className="num">{r.score}</td>
        <td><span className="row wrap" style={{ gap: 6 }}>{r.flags.length ? r.flags.map((f) => <span key={f} className="badge">{f}</span>) : <span className="badge">Low score</span>}</span></td></tr>)}</tbody></table></>}

    {d.recent.length > 0 && <><h2>Recent submissions</h2><table><thead><tr><th>Student</th><th>Project</th><th className="num">Score</th><th>Submitted</th></tr></thead><tbody>
      {d.recent.map((r, i) => <tr key={i}><td>{r.student}</td><td><Link to={`/projects/${r.project}`}>{r.name}</Link> <span className="grey">{r.course}</span></td><td className="num">{r.score}</td><td className="grey">{new Date(r.created).toLocaleString()}</td></tr>)}</tbody></table></>}
  </>);
}
