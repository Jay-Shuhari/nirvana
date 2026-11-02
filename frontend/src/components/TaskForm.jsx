// ANCHOR: TaskForm - create a task (assignment) with requirements the AI will check.
import { useState } from "react";
import { api } from "../api.js";
import { useUI } from "./ui.jsx";

export default function TaskForm({ courses, courseId, onCreated }) {
  const { toast } = useUI();
  const [f, setF] = useState({ course: courseId || courses?.[0]?.id || "", title: "", description: "", requirements: "", due: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    if (!f.course) return toast.error("Create a course first.");
    if (!f.title.trim()) return toast.error("Give the task a title.");
    setBusy(true);
    try {
      await api("/tasks", { method: "POST", body: { ...f, course: courseId || f.course } });
      toast.success("Task created. Enrolled students were notified.");
      setF({ ...f, title: "", description: "", requirements: "", due: "" });
      onCreated?.();
    } catch (err) { toast.error(err.message); }
    setBusy(false);
  }
  return (
    <form className="panel" onSubmit={save}>
      <h3>Create task</h3>
      {!courseId && <><label>Course</label><select value={f.course} onChange={set("course")}>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} {c.title}</option>)}</select></>}
      <label>Title</label><input value={f.title} onChange={set("title")} placeholder="Build the login system" />
      <label>Description</label><textarea value={f.description} onChange={set("description")} placeholder="What students should build and hand in." />
      <label>Requirements</label>
      <textarea value={f.requirements} onChange={set("requirements")} placeholder={"Users can log in with email and password\nPasswords are hashed\nREADME explains how to run the project"} />
      <div className="help">One requirement per line, up to 20. The AI checks every submitted repository against these.</div>
      <label>Due date</label><input type="date" value={f.due} onChange={set("due")} />
      <button className="btn primary" style={{ marginTop: 20 }} disabled={busy}><span>{busy ? "Creating..." : "Create task"}</span></button>
    </form>
  );
}
