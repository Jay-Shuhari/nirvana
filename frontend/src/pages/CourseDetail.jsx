// ANCHOR: CourseDetail.jsx - one course page for both roles.
// * Supervisors: stats, tasks (+create), people (roster + strengths), groups, rubric.
// * Students: course context, tasks with own status, classmates, groups.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import Groups from "../components/Groups.jsx";
import Rubric from "../components/Rubric.jsx";
import PageSkeleton from "../components/Skeleton.jsx";
import TaskForm from "../components/TaskForm.jsx";
import { Avatar, Icon, useUI } from "../components/ui.jsx";
import { dueInfo } from "./Inbox.jsx";

export default function CourseDetail({ user }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { toast, confirm } = useUI();
  const [d, setD] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const load = useCallback(() => api(`/courses/${id}`).then(setD).catch((e) => { toast.error(e.message); nav("/courses"); }), [id]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <PageSkeleton variant="course" />;
  const sup = d.role === "supervisor";
  const { course: c, stats: s } = d;
  const TABS = sup ? ["Tasks", "People", "Groups", "Rubric"] : ["Tasks", "People", "Groups"];
  const tab = TABS.find((t) => t.toLowerCase() === (sp.get("tab") || "tasks")) || "Tasks";
  const setTab = (t) => setSp(t === "Tasks" ? {} : { tab: t.toLowerCase() }, { replace: true });

  async function removeCourse() {
    if (!(await confirm({ title: `Delete ${c.code}?`, body: `This permanently removes the course, its ${s.tasks} tasks and every student project and evaluation in it.`, confirm: "Delete course", danger: true }))) return;
    try { await api(`/courses/${id}`, { method: "DELETE" }); toast.success("Course deleted."); nav("/courses"); } catch (e) { toast.error(e.message); }
  }
  async function removeTask(t) {
    setDeletingTask(t.id);
    try {
      await api(`/tasks/${t.id}`, { method: "DELETE" });
      await new Promise((resolve) => setTimeout(resolve, 240));
      setD((curr) => (curr ? { ...curr, tasks: curr.tasks.filter((item) => item.id !== t.id) } : curr));
      toast.success("Task deleted.");
    } catch (e) { toast.error(e.message); }
    finally { setDeletingTask(null); }
  }
  const copy = () => navigator.clipboard?.writeText(c.join_code).then(() => toast.success("Join code copied."), () => toast.error("Could not copy."));
  const people = sup ? d.students : d.classmates;

  return (<>
    <div className="grey" style={{ marginBottom: 8 }}><Link to="/courses">Courses</Link> / {c.code}</div>
    <div className="row between wrap"><div><h1>{c.title}</h1><div className="grey">{c.code} · {c.session}{!sup && ` · ${c.supervisor}`}</div></div>
      {sup && <div className="row wrap"><button className="btn" onClick={copy} title="Copy join code"><Icon name="copy" /><span className="mono">{c.join_code}</span></button>
        <Link className="btn" to={`/courses/${c.id}/cohort`}><Icon name="chart" /><span>Cohort</span></Link>
        <button className="btn danger icon" onClick={removeCourse} aria-label="Delete course"><Icon name="trash" /></button></div>}</div>

    {sup ? <div className="stats"><div><b>{s.students}</b><span>Students</span></div><div><b>{s.tasks}</b><span>Tasks</span></div><div><b>{s.submitted}</b><span>Evaluated</span></div><div><b>{s.average ?? "-"}</b><span>Average</span></div><div><b>{s.needs_attention}</b><span>Needs attention</span></div></div>
      : <div className="stats"><div><b>{s.tasks}</b><span>Tasks</span></div><div><b>{s.submitted}/{s.tasks}</b><span>You submitted</span></div><div><b>{s.students}</b><span>Classmates</span></div><div><b>{d.my_group?.name || "–"}</b><span>Your group</span></div></div>}

    <div className="tabs" role="tablist" aria-label="Course sections">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} aria-controls="course-panel" id={`ct-${t}`}
      className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}{t === "People" && <span className="tab-count">{people.length}</span>}</button>)}</div>

    <div role="tabpanel" id="course-panel" aria-labelledby={`ct-${tab}`}>
      {tab === "Tasks" && <>
        {sup && <div className="row between wrap" style={{ marginBottom: 16 }}><span className="grey">{d.tasks.length} task{d.tasks.length === 1 ? "" : "s"}</span>
          <button className="btn primary" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}><Icon name={showForm ? "back" : "plus"} /><span>{showForm ? "Close" : "Create task"}</span></button></div>}
        {sup && showForm && <div style={{ marginBottom: 24, maxWidth: 720 }}><TaskForm courseId={c.id} onCreated={() => { setShowForm(false); load(); }} /></div>}
        {d.tasks.length === 0 ? <div className="empty">{sup ? "No tasks yet. Create the first one; enrolled students are notified." : "No tasks in this course yet."}</div> :
          sup ? <table><thead><tr><th>Task</th><th>Due</th><th className="num">Evaluated</th><th /></tr></thead><tbody>
            {d.tasks.map((t) => <tr key={t.id} className={deletingTask === t.id ? "task-deleting" : ""}><td><Link to={`/tasks/${t.id}`}><b>{t.title}</b></Link><div className="help" style={{ margin: 0 }}>{t.requirements.length} requirements</div></td>
              <td className="grey">{t.due ? dueInfo(t.due).label : "-"}</td><td className="num">{t.submitted}/{t.projects}</td>
              <td className="num"><button className="btn icon sm" onClick={() => removeTask(t)} aria-label={`Delete ${t.title}`}><Icon name="trash" /></button></td></tr>)}</tbody></table>
          : <div className="inbox-list">{d.tasks.map((t) => { const i = dueInfo(t.due), done = t.project?.submitted; return (
            <div key={t.id} className="inbox-item" style={{ cursor: "default" }}>
              <span className="ic" aria-hidden="true"><Icon name={done ? "check" : "tasks"} /></span>
              <span className="body"><Link to={`/tasks/${t.id}`} style={{ textDecoration: "none" }}><b>{t.title}</b></Link>
                <span className={`pill-due ${done ? "" : i.tone}`}>{done ? (t.project.score != null ? `Submitted · score ${t.project.score}` : "Submitted") : t.project ? `Started · ${i.label}` : i.label}</span></span>
              <Link className={`btn sm ${!t.project ? "primary" : ""}`} to={t.project ? `/projects/${t.project.id}` : `/tasks/${t.id}`}><span>{done ? "View" : t.project ? "Continue" : "Start"}</span></Link>
            </div>); })}</div>}
      </>}

      {tab === "People" && (people.length === 0 ? <div className="empty">No students yet.{sup && <> Share the join code <span className="mono">{c.join_code}</span>.</>}</div> :
        sup ? <table><thead><tr><th>Name</th><th>Matric</th><th>Strengths</th><th>Group</th><th className="num">Projects</th></tr></thead><tbody>
          {people.map((p) => <tr key={p.id}><td><span className="row" style={{ gap: 10 }}><Avatar name={p.name} size={26} /><span>{p.name}<div className="help" style={{ margin: 0 }}>{p.email}</div></span></span></td>
            <td className="grey mono">{p.matric || "-"}</td>
            <td className="grey">{p.strengths?.areas?.length ? p.strengths.areas.join(", ") : "Not answered"}</td>
            <td>{p.group ? <span className="badge">{p.group}</span> : <span className="grey">None</span>}</td><td className="num">{p.projects}</td></tr>)}</tbody></table>
        : <><p className="grey" style={{ marginTop: 0 }}>Supervisor: <b>{c.supervisor}</b></p>
          <div className="people">{people.map((p) => <div key={p.id} className="person"><Avatar name={p.name} size={32} />
            <div><b>{p.name}{p.me && " (you)"}</b><span>{p.group || "No group yet"}</span></div></div>)}</div></>)}

      {tab === "Groups" && <Groups courseId={c.id} user={user} />}
      {tab === "Rubric" && sup && <div className="narrow"><Rubric course={c} onSaved={() => { toast.success("Rubric saved."); load(); }} /></div>}
    </div>
  </>);
}
