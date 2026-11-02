// ANCHOR: CourseDetail.jsx - the per-course teacher view: stats, tasks (+create), students, rubric.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { Icon, useUI } from "../components/ui.jsx";
import Rubric from "../components/Rubric.jsx";
import PageSkeleton from "../components/Skeleton.jsx";
import TaskForm from "../components/TaskForm.jsx";

export default function CourseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUI();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("Tasks");
  const load = useCallback(() => api(`/courses/${id}`).then(setD).catch((e) => { toast.error(e.message); nav("/courses"); }), [id]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <PageSkeleton variant="course" />;
  const { course: c, stats: s } = d;

  async function removeCourse() {
    if (!(await confirm({ title: `Delete ${c.code}?`, body: `This permanently removes the course, its ${s.tasks} tasks and every student project and evaluation in it.`, confirm: "Delete course", danger: true }))) return;
    try { await api(`/courses/${id}`, { method: "DELETE" }); toast.success("Course deleted."); nav("/courses"); } catch (e) { toast.error(e.message); }
  }
  async function removeTask(t) {
    if (!(await confirm({ title: `Delete "${t.title}"?`, body: "Students keep their projects and evaluations.", confirm: "Delete task", danger: true }))) return;
    try { await api(`/tasks/${t.id}`, { method: "DELETE" }); toast.success("Task deleted."); load(); } catch (e) { toast.error(e.message); }
  }
  const copy = () => navigator.clipboard?.writeText(c.join_code).then(() => toast.success("Join code copied."), () => toast.error("Could not copy."));

  return (<>
    <div className="grey" style={{ marginBottom: 8 }}><Link to="/courses">Courses</Link> / {c.code}</div>
    <div className="row between wrap"><div><h1>{c.title}</h1><div className="grey">{c.code} · {c.session}</div></div>
      <div className="row wrap"><button className="btn" onClick={copy} title="Copy join code"><Icon name="copy" /><span className="mono">{c.join_code}</span></button>
        <Link className="btn" to={`/courses/${c.id}/cohort`}><Icon name="users" /><span>Cohort</span></Link>
        <button className="btn danger icon" onClick={removeCourse} aria-label="Delete course"><Icon name="trash" /></button></div></div>
    <div className="stats"><div><b>{s.students}</b><span>Students</span></div><div><b>{s.tasks}</b><span>Tasks</span></div><div><b>{s.submitted}</b><span>Evaluated</span></div><div><b>{s.average ?? "-"}</b><span>Average</span></div><div><b>{s.needs_attention}</b><span>Needs attention</span></div></div>
    <div className="tabs">{["Tasks", "Students", "Rubric"].map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>

    {tab === "Tasks" && <div className="grid2" style={{ alignItems: "start" }}>
      <div>{d.tasks.length === 0 ? <div className="empty">No tasks yet. Create the first one.</div> :
        <table><thead><tr><th>Task</th><th>Due</th><th className="num">Evaluated</th><th /></tr></thead><tbody>
          {d.tasks.map((t) => <tr key={t.id}><td><b>{t.title}</b><div className="help" style={{ margin: 0 }}>{t.requirements.length} requirements</div></td><td className="grey">{t.due || "-"}</td><td className="num">{t.submitted}/{t.projects}</td>
            <td className="num"><button className="btn icon sm" onClick={() => removeTask(t)} aria-label={`Delete ${t.title}`}><Icon name="trash" /></button></td></tr>)}</tbody></table>}</div>
      <TaskForm courseId={c.id} onCreated={load} /></div>}

    {tab === "Students" && (d.students.length === 0 ? <div className="empty">No students yet. Share the join code <span className="mono">{c.join_code}</span>.</div> :
      <table><thead><tr><th>Name</th><th>Matric</th><th>Email</th><th className="num">Projects</th></tr></thead><tbody>
        {d.students.map((s2) => <tr key={s2.id}><td>{s2.name}</td><td className="grey">{s2.matric || "-"}</td><td className="grey">{s2.email}</td><td className="num">{s2.projects}</td></tr>)}</tbody></table>)}

    {tab === "Rubric" && <div className="narrow"><Rubric course={c} onSaved={() => { toast.success("Rubric saved."); load(); }} /></div>}
  </>);
}
