// ANCHOR: Rubric.jsx - rubric builder: edit criteria and weights.
import { useState } from "react";
import { api } from "../api.js";
import { Icon, useUI } from "./ui.jsx";

export default function Rubric({ course, onSaved }) {
  const { toast } = useUI();
  const [rows, setRows] = useState(course.rubric);
  const total = rows.reduce((a, r) => a + (+r.weight || 0), 0); // ! Save stays disabled until this is exactly 100
  const edit = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  async function save() { try { await api(`/courses/${course.id}/rubric`, { method: "PUT", body: { rubric: rows } }); onSaved(); } catch (e) { toast.error(e.message); } }
  return (<><h2 style={{ marginTop: 0 }}>Rubric</h2><div className="grey">Weights must total 100%.</div>
    <div className="panel" style={{ marginTop: 12 }}>
      {rows.map((r, i) => <div key={i} className="row" style={{ marginBottom: 8 }}><input value={r.name} onChange={(e) => edit(i, "name", e.target.value)} aria-label="Criterion name" />
        <input style={{ width: 84 }} type="number" min="0" max="100" value={r.weight} onChange={(e) => edit(i, "weight", e.target.value)} aria-label="Weight" /><span className="grey">%</span>
        <button className="btn icon sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Delete criterion"><Icon name="trash" /></button></div>)}
      <div className="row between wrap" style={{ marginTop: 16 }}><span>{total === 100 ? "Total 100%" : `Total ${total}%. ${total < 100 ? `Add ${100 - total}%` : `Remove ${total - 100}%`} to save.`}</span>
        <button className="btn primary" disabled={total !== 100} onClick={save}><span>Save rubric</span></button></div>
    </div></>);
}
