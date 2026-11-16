// ======================================================================
// ANCHOR: Inbox.jsx
// FILE: frontend/src/pages/Inbox.jsx
// ROLE: One inbox for tasks and notifications (replaces Tasks.jsx + Notifications.jsx).
// ? Pattern: Linear/GitHub-style inbox. "To do" groups work by urgency (overdue, today, this week, later);
//   "Activity" is the notification feed grouped by day; updates about a task also show on that task's row.
// ======================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import PageSkeleton from "../components/Skeleton.jsx";
import TaskForm from "../components/TaskForm.jsx";
import { Icon, useUI } from "../components/ui.jsx";

const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// * Task due dates are calendar dates (inclusive), compared against the viewer's local day.
export function dueInfo(due) {
  if (!due) return { bucket: "none", label: "No due date", tone: "" };
  const days = Math.round((startOfDay(due + "T00:00:00") - startOfDay(new Date())) / DAY);
  if (days < 0) return { bucket: "overdue", label: `${-days} day${days === -1 ? "" : "s"} overdue`, tone: "late", days };
  if (days === 0) return { bucket: "today", label: "Due today", tone: "soon", days };
  if (days === 1) return { bucket: "week", label: "Due tomorrow", tone: "soon", days };
  if (days <= 7) return { bucket: "week", label: `Due in ${days} days`, tone: days <= 3 ? "soon" : "", days };
  return { bucket: "later", label: `Due ${new Date(due + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}`, tone: "", days };
}
const BUCKETS = [["overdue", "Overdue"], ["today", "Due today"], ["week", "This week"], ["later", "Later"], ["none", "No due date"]];
const taskOf = (link) => (link || "").match(/^\/tasks\/(\d+)/)?.[1];
function when(d) {
  const t = startOfDay(new Date()), x = startOfDay(d);
  return x >= t ? "Today" : t - x < 7 * DAY ? "This week" : "Earlier";
}

export default function Inbox({ user, refresh }) {
  const sup = user.role === "supervisor";
  const { toast } = useUI();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "todo";
  const [tasks, setTasks] = useState(null);
  const [notes, setNotes] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState([]);

  const load = useCallback(() => Promise.all([api("/tasks"), api("/notifications"), sup ? api("/courses") : []])
    .then(([t, n, c]) => { setTasks(t); setNotes(n); setCourses(c); setError(""); })
    .catch((e) => setError(e.message)), [sup]);
  useEffect(() => { load(); }, [load]);

  const unreadByTask = useMemo(() => {
    const m = {};
    for (const n of notes || []) if (!n.read && taskOf(n.link)) m[taskOf(n.link)] = (m[taskOf(n.link)] || 0) + 1;
    return m;
  }, [notes]);

  if (error) return <div className="narrow"><h1>Inbox</h1><div className="empty" style={{ marginTop: 24 }} role="alert"><b>Could not load your inbox.</b><br />{error}<br /><br />
    <button className="btn" onClick={load}><Icon name="refresh" /><span>Try again</span></button></div></div>;
  if (!tasks || !notes) return <PageSkeleton variant="feed" />;

  const isDone = (t) => sup ? false : Boolean(t.project?.submitted);
  const todo = tasks.filter((t) => !isDone(t));
  const done = tasks.filter(isDone);
  const unread = notes.filter((n) => !n.read).length;
  const tabs = [["todo", sup ? "Assignments" : "To do", todo.length], ["activity", "Activity", unread], ...(sup ? [] : [["done", "Done", done.length]])];
  const setTab = (t) => setSp(t === "todo" ? {} : { tab: t }, { replace: true });

  async function open(n) {
    if (!n.read) {
      setNotes((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      api(`/notifications/${n.id}/read`, { method: "POST" }).then(refresh).catch(() => {});
    }
    if (n.link) nav(n.link);
  }
  async function markAll() {
    try { await api("/notifications/read", { method: "POST" }); setNotes(notes.map((n) => ({ ...n, read: true }))); refresh(); toast.success("All caught up."); }
    catch (e) { toast.error(e.message); }
  }
  async function remove(t) { // * no confirm: the row slides out and comes back if the server refuses
    setDeleting((c) => [...c, t.id]);
    try {
      await api(`/tasks/${t.id}`, { method: "DELETE" });
      await new Promise((r) => setTimeout(r, 240));
      setTasks((c) => c.filter((x) => x.id !== t.id));
      toast.success("Task deleted.");
    } catch (e) { toast.error(e.message); }
    finally { setDeleting((c) => c.filter((id) => id !== t.id)); }
  }

  const taskRow = (t) => {
    const d = dueInfo(t.due);
    const updates = unreadByTask[t.id];
    return (
      <div key={t.id} className={`inbox-item ${deleting.includes(t.id) ? "task-deleting" : ""}`} style={{ cursor: "default" }}>
        <span className="ic" aria-hidden="true"><Icon name={isDone(t) ? "check" : d.bucket === "overdue" ? "alert" : "tasks"} /></span>
        <div className="body">
          <Link to={`/tasks/${t.id}`} style={{ textDecoration: "none" }}><b>{t.title}</b></Link>
          <span>{t.course.code} · <span className={`pill-due ${isDone(t) ? "" : d.tone}`}>{isDone(t) ? "Submitted" : d.label}</span>
            {t.requirements.length > 0 && ` · ${t.requirements.length} requirements`}
            {updates > 0 && <> · <b style={{ display: "inline", color: "var(--text)" }}>{updates} new update{updates > 1 ? "s" : ""}</b></>}</span>
        </div>
        {sup ? <>
          <span className="badge" title="Evaluated submissions out of started projects">{t.submitted}/{t.projects} evaluated</span>
          <button className="btn icon sm" onClick={() => remove(t)} aria-label={`Delete ${t.title}`}><Icon name="trash" /></button>
        </> : isDone(t)
          ? <Link className="btn sm" to={`/projects/${t.project.id}`}><span>{t.project.score != null ? `Score ${t.project.score}` : "View result"}</span></Link>
          : t.project ? <Link className="btn sm" to={`/projects/${t.project.id}`}><span>Continue</span></Link>
            : <Link className="btn primary sm" to={`/tasks/${t.id}`}><span>Start</span></Link>}
      </div>);
  };
  const grouped = (list) => BUCKETS.map(([b, label]) => [label, list.filter((t) => dueInfo(t.due).bucket === b)]).filter(([, l]) => l.length);

  return (<div className="narrow" style={{ maxWidth: 860 }}>
    <div className="row between wrap"><div><h1>Inbox</h1><div className="grey">{sup ? "Your assignments and what happened in your courses." : "What to do next, and what changed."}</div></div>
      <div className="row wrap">
        {tab === "activity" && <button className="btn" onClick={markAll} disabled={!unread}><span>Mark all as read</span></button>}
        {sup && tab === "todo" && <button className="btn primary" onClick={() => setShowForm(!showForm)} disabled={courses.length === 0} aria-expanded={showForm}>
          <Icon name="plus" /><span>{showForm ? "Close" : "Create task"}</span></button>}
      </div></div>
    {sup && courses.length === 0 && <p className="help">Create a course first, then add tasks to it.</p>}

    <div className="tabs" role="tablist" aria-label="Inbox sections">
      {tabs.map(([id, label, n]) => <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
        {label}{n > 0 && <span className="tab-count">{n}</span>}</button>)}
    </div>

    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === "todo" && <>
        {sup && showForm && <div style={{ marginBottom: 24 }}><TaskForm courses={courses} onCreated={() => { setShowForm(false); load(); }} /></div>}
        {todo.length === 0
          ? <div className="empty">{sup ? "No assignments yet. Create one to notify your students." : tasks.length ? "Nothing to do. Every task is submitted." : "Nothing assigned yet. Join a course to see its tasks."}
            {!sup && !tasks.length && <><br /><br /><Link className="btn" to="/courses"><span>Go to courses</span></Link></>}</div>
          : grouped(todo).map(([label, list]) => <section className="inbox-group" key={label} aria-label={label}>
            <h2>{label} <span className="tab-count">{list.length}</span></h2>
            <div className="inbox-list">{list.map(taskRow)}</div></section>)}
      </>}

      {tab === "done" && (done.length === 0 ? <div className="empty">Nothing submitted yet. Your submitted tasks and scores appear here.</div>
        : <div className="inbox-list">{done.map(taskRow)}</div>)}

      {tab === "activity" && (notes.length === 0 ? <div className="empty">No updates yet. New tasks, submissions and feedback will appear here.</div>
        : ["Today", "This week", "Earlier"].map((g) => [g, notes.filter((n) => when(n.created) === g)]).filter(([, l]) => l.length).map(([g, list]) =>
          <section className="inbox-group" key={g} aria-label={g}><h2>{g}</h2>
            <div className="inbox-list">{list.map((n) =>
              <button type="button" key={n.id} className={`inbox-item ${n.read ? "" : "unread"}`} onClick={() => open(n)} disabled={!n.link && n.read}>
                <span className="ic" aria-hidden="true"><Icon name={taskOf(n.link) ? "tasks" : n.link?.startsWith("/projects") ? "chart" : n.link?.startsWith("/courses") ? "users" : "bell"} /></span>
                <span className="body"><b>{n.text}</b><span>{new Date(n.created).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{n.read ? "" : " · unread"}</span></span>
                {n.link && <Icon name="arrow" />}
              </button>)}</div></section>))}
    </div>
  </div>);
}
