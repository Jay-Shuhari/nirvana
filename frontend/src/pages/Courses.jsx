// ANCHOR: Courses.jsx - the list of courses is the page; creating/joining is a header CTA that opens an inline form.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { SkeletonTable } from "../components/Skeleton.jsx";
import { Icon, useUI } from "../components/ui.jsx";

export default function Courses({ user }) {
  const sup = user.role === "supervisor";
  const [sp, setSp] = useSearchParams();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(sp.get("new") === "1");
  const [code, setCode] = useState("");
  const [f, setF] = useState({ code: "", title: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const first = useRef(null);
  const { toast } = useUI();
  const load = useCallback(() => api("/courses").then((d) => { setList(d); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open) first.current?.focus(); }, [open]);
  const toggle = () => { setOpen(!open); setErrors({}); if (sp.get("new")) setSp({}, { replace: true }); };

  async function submit(e) {
    e.preventDefault(); // * Enter works in both forms
    const errs = sup ? { ...(!f.code.trim() && { code: "Enter a course code." }), ...(!f.title.trim() && { title: "Enter a course title." }) }
      : (!code.trim() ? { code: "Enter the join code from your supervisor." } : {});
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (sup) { await api("/courses", { method: "POST", body: f }); setF({ code: "", title: "" }); toast.success("Course created. Share its join code with students."); }
      else { await api("/courses/join", { method: "POST", body: { code } }); setCode(""); toast.success("You joined the course."); }
      setOpen(false); load();
    } catch (err) { setErrors(err.fields || {}); toast.error(err.message); }
    setBusy(false);
  }
  const shown = (list || []).filter((c) => `${c.code} ${c.title} ${c.supervisor}`.toLowerCase().includes(q.toLowerCase()));
  const copy = (c) => navigator.clipboard?.writeText(c.join_code).then(() => toast.success(`Join code for ${c.code} copied.`), () => toast.error("Could not copy."));

  return (<>
    <div className="row between wrap"><div><h1>{sup ? "Courses" : "My courses"}</h1>
      <div className="grey">{sup ? "Your courses, their students and tasks." : "Courses you're enrolled in. Open one to see its tasks, classmates and groups."}</div></div>
      <button className="btn primary" onClick={toggle} aria-expanded={open} aria-controls="course-form">
        <Icon name={open ? "back" : "plus"} /><span>{open ? "Close" : sup ? "New course" : "Join a course"}</span></button></div>

    {open && <form id="course-form" className="panel" style={{ marginTop: 24, maxWidth: 720 }} onSubmit={submit} noValidate>
      <h3>{sup ? "Create a course" : "Join a course"}</h3>
      <div className="grey">{sup ? "Students join with the code Metis generates." : "Ask your supervisor for the six-character join code."}</div>
      {sup ? <div className="grid2">
        <div><label htmlFor="c-code">Course code</label><input id="c-code" ref={first} value={f.code} aria-invalid={!!errors.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CSC 399" />
          {errors.code && <div className="field-error">{errors.code}</div>}</div>
        <div><label htmlFor="c-title">Title</label><input id="c-title" value={f.title} aria-invalid={!!errors.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Software Engineering" />
          {errors.title && <div className="field-error">{errors.title}</div>}</div></div>
        : <><label htmlFor="c-join">Join code</label><input id="c-join" ref={first} className="mono" value={code} aria-invalid={!!errors.code} onChange={(e) => setCode(e.target.value)} placeholder="7XK2PA" autoCapitalize="characters" />
          {errors.code && <div className="field-error">{errors.code}</div>}</>}
      <div className="row" style={{ marginTop: 16 }}><button type="button" className="btn" onClick={toggle}>Cancel</button>
        <button className="btn primary" disabled={busy}><span>{busy ? (sup ? "Creating..." : "Joining...") : sup ? "Create course" : "Join course"}</span></button></div>
    </form>}

    {error ? <div className="empty" role="alert" style={{ marginTop: 24 }}><b>Could not load courses.</b><br />{error}<br /><br /><button className="btn" onClick={load}><Icon name="refresh" /><span>Try again</span></button></div>
      : !list ? <div role="status" style={{ marginTop: 24 }}><span className="sr-only">Loading courses...</span><SkeletonTable rows={3} columns={3} /></div>
      : list.length === 0 ? <div className="empty" style={{ marginTop: 24 }}><b>{sup ? "No courses yet." : "You haven't joined a course yet."}</b><br />
        {sup ? "Create your first course, then share its join code with students." : "Use the join code from your supervisor to get started."}<br /><br />
        {!open && <button className="btn primary" onClick={toggle}><Icon name="plus" /><span>{sup ? "New course" : "Join a course"}</span></button>}</div>
      : <>
        {list.length > 6 && <input type="search" style={{ marginTop: 24, maxWidth: 360 }} placeholder="Search courses" aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />}
        <div className="cards">
          {shown.map((c) => <div key={c.id} className="course-card" style={{ position: "relative" }}>
            <span className="code">{c.code} · {c.session}</span>
            <Link to={`/courses/${c.id}`} style={{ textDecoration: "none" }}><b>{c.title}</b><span className="sr-only">, open course</span></Link>
            <span className="grey" style={{ fontSize: 13 }}>{sup ? `${c.students} student${c.students === 1 ? "" : "s"}` : `Supervisor: ${c.supervisor}`}</span>
            <div className="meta">
              {sup ? <button className="btn sm" onClick={() => copy(c)} aria-label={`Copy join code ${c.join_code} for ${c.code}`}><Icon name="copy" /><span className="mono">{c.join_code}</span></button> : <span />}
              <Link className="btn sm" to={`/courses/${c.id}`}><span>Open</span><Icon name="arrow" /></Link>
            </div>
          </div>)}
        </div>
        {shown.length === 0 && <div className="empty" style={{ marginTop: 16 }}>No courses match “{q}”.</div>}
      </>}
  </>);
}
