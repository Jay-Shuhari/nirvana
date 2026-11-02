// ANCHOR: Tasks.jsx - Tasks inbox. Students: what to do. Teachers: every task + create.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Icon, useUI } from "../components/ui.jsx";
import PageSkeleton from "../components/Skeleton.jsx";
import TaskForm from "../components/TaskForm.jsx";

export default function Tasks({ user }) {
  const sup = user.role === "supervisor";
  const [tasks, setTasks] = useState(null);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const { toast, confirm } = useUI();
  const load = useCallback(() => Promise.all([api("/tasks"), sup ? api("/courses") : []]).then(([t, c]) => { setTasks(t); setCourses(c); }), [sup]);
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]);
  if (!tasks) return <PageSkeleton variant="table" />;

  async function remove(t) {
    if (!(await confirm({ title: `Delete "${t.title}"?`, body: "Students keep their projects and evaluations, but the requirements check stops applying.", confirm: "Delete task", danger: true }))) return;
    try { await api(`/tasks/${t.id}`, { method: "DELETE" }); toast.success("Task deleted."); load(); } catch (e) { toast.error(e.message); }
  }
  return (<>
    <div className="row between wrap"><div><h1>Tasks</h1><div className="grey">{sup ? "Assignments across your courses." : "What your supervisors have set."}</div></div>
      {sup && <button className="btn primary" onClick={() => setShowForm(!showForm)} disabled={courses.length === 0}><Icon name="plus" /><span>{showForm ? "Close" : "Create task"}</span></button>}</div>
    {sup && courses.length === 0 && <p className="help">Create a course first, then add tasks to it.</p>}
    {sup && showForm && <div style={{ margin: "24px 0" }}><TaskForm courses={courses} onCreated={() => { setShowForm(false); load(); }} /></div>}
    <h2>{sup ? "All tasks" : "Your tasks"}</h2>
    {tasks.length === 0 ? <div className="empty">{sup ? "No tasks yet." : "Nothing assigned yet. Join a course to see its tasks."}</div> :
    <table><thead><tr><th>Task</th><th>Course</th><th>Due</th>{sup ? <><th className="num">Projects</th><th className="num">Evaluated</th><th /></> : <><th>Status</th><th /></>}</tr></thead><tbody>
      {tasks.map((t) => <tr key={t.id}><td><b>{t.title}</b><div className="help" style={{ margin: 0 }}>{t.requirements.length} requirements</div></td><td>{t.course.code}</td><td className="grey">{t.due || "-"}</td>
        {sup ? <><td className="num">{t.projects}</td><td className="num">{t.submitted}</td><td className="num"><button className="btn icon sm" onClick={() => remove(t)} aria-label={`Delete ${t.title}`}><Icon name="trash" /></button></td></> :
          <><td>{t.project ? <span className="badge">{t.project.score != null ? `Score ${t.project.score}` : "Registered"}</span> : <span className="badge">Not started</span>}</td>
            <td className="num">{t.project ? <Link className="btn sm" to={`/projects/${t.project.id}`}><span>Open</span></Link> : <Link className="btn primary sm" to={`/projects/new?task=${t.id}`}><span>Start</span></Link>}</td></>}</tr>)}</tbody></table>}
  </>);
}
