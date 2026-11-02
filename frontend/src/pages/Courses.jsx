// ANCHOR: Courses.jsx - teachers create courses; students join with a code (layout fixed: stacked, wraps on mobile).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useUI } from "../components/ui.jsx";
import { SkeletonTable } from "../components/Skeleton.jsx";

export default function Courses({ user }) {
  const sup = user.role === "supervisor";
  const [list, setList] = useState(null);
  const [code, setCode] = useState("");
  const [f, setF] = useState({ code: "", title: "" });
  const { toast } = useUI();
  const load = useCallback(() => api("/courses").then(setList), []);
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]);

  async function submit(e) {
    e.preventDefault(); // * Enter works in both forms
    try {
      if (sup) { await api("/courses", { method: "POST", body: f }); setF({ code: "", title: "" }); toast.success("Course created."); }
      else { await api("/courses/join", { method: "POST", body: { code } }); setCode(""); toast.success("You joined the course."); }
      load();
    } catch (err) { toast.error(err.message); }
  }
  return (<div className="narrow">
    <h1>{sup ? "Courses" : "My courses"}</h1><div className="grey">{sup ? "Create a course, then share its join code." : "Join a course with the code from your supervisor."}</div>
    <form className="panel" style={{ marginTop: 24 }} onSubmit={submit}>
      {sup ? <div className="grid2">
        <div><label style={{ marginTop: 0 }}>Course code</label><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CSC 399" /></div>
        <div><label style={{ marginTop: 0 }}>Title</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Software Engineering" /></div></div>
        : <><label style={{ marginTop: 0 }}>Join code</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="For example 7XK2PA" autoCapitalize="characters" /></>}
      <button className="btn primary" style={{ marginTop: 16 }}><span>{sup ? "Create course" : "Join course"}</span></button>
    </form>
    <h2>{sup ? "Your courses" : "Joined courses"}</h2>
    {!list ? <div role="status" aria-label="Loading courses"><span className="sr-only">Loading courses...</span><SkeletonTable rows={4} columns={sup ? 3 : 2} /></div> : list.length === 0 ? <div className="empty">{sup ? "No courses yet." : "You have not joined a course yet."}</div> :
    <table><thead><tr><th>Course</th><th>{sup ? "Students" : "Supervisor"}</th>{sup && <th>Join code</th>}</tr></thead><tbody>
      {list.map((c) => <tr key={c.id}><td>{sup ? <Link to={`/courses/${c.id}`}>{c.code} {c.title}</Link> : `${c.code} ${c.title}`}<div className="help" style={{ margin: 0 }}>{c.session}</div></td>
        <td>{sup ? c.students : c.supervisor}</td>{sup && <td className="mono">{c.join_code}</td>}</tr>)}</tbody></table>}
  </div>);
}
