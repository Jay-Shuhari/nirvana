// ======================================================================
// ANCHOR: Cohort.jsx
// FILE: Cohort.jsx
// ROLE: Supervisor cohort dashboard: stats, distribution, filterable table, compare, CSV.
// SEE:  .tours/03-override-and-cohort.tour
// ======================================================================
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, dot, token } from "../api.js";
import { useUI } from "../components/ui.jsx";
import PageSkeleton from "../components/Skeleton.jsx";

// * Used only for the CSV download, which needs a raw fetch to get a file.
const BASE = import.meta.env.VITE_API_URL || "/api";
// * Score-range filter buckets.
const RANGES = { all: [0, 100], "80-100": [80, 100], "60-79": [60, 79], "40-59": [40, 59], "0-39": [0, 39] };
const PER = 10;

// ANCHOR: Cohort dashboard
export default function Cohort() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const { toast } = useUI();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("all");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState([]);
  const [compare, setCompare] = useState(false);
  useEffect(() => { api(`/courses/${id}/cohort`).then(setD).catch((e) => toast.error(e.message)); }, [id]);
  useEffect(() => setPage(0), [q, status, range]);

  // * Filtering happens in the browser: search + status + score range. Recomputed only when inputs change.
  const rows = useMemo(() => d ? d.rows.filter((r) =>
    (status === "all" || r.status === status) && r.score >= RANGES[range][0] && r.score <= RANGES[range][1] &&
    (`${r.student} ${r.matric} ${r.name}`).toLowerCase().includes(q.toLowerCase())) : [], [d, q, status, range]);
  if (!d) return <PageSkeleton variant="cohort" />;

  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const toggle = (p) => setSel(sel.includes(p) ? sel.filter((x) => x !== p) : [...sel, p]);
  const chosen = d.rows.filter((r) => sel.includes(r.project));
  const maxBin = Math.max(1, ...d.distribution);

  // TODO: export only the filtered rows instead of the whole cohort.
  async function exportCsv() {
    const res = await fetch(`${BASE}/courses/${id}/cohort.csv`, { headers: { Authorization: `Bearer ${token.get()}` } });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = `${d.course.code}-cohort.csv`; a.click();
  }

  return (<>
    <div className="grey" style={{ marginBottom: 8 }}><Link to="/courses">Courses</Link> / {d.course.code}</div>
    <div className="row between"><div><h1>{d.course.title}</h1><div className="grey">Cohort overview for {d.course.code}.</div></div>
      <div className="row"><button className="btn" onClick={exportCsv}>Export CSV</button><button className="btn" disabled={sel.length < 2} onClick={() => setCompare(true)}>Compare</button></div></div>

    <div className="row" style={{ alignItems: "stretch", gap: 16 }}>
      <div className="stats" style={{ flex: 1, margin: "24px 0" }}>
        <div><b>{d.submitted} of {d.enrolled}</b><span>Submitted</span></div><div><b>{d.pending}</b><span>Pending</span></div>
        <div><b>{d.average ?? "-"}</b><span>Average</span></div><div><b>{d.needs_attention}</b><span>Needs attention</span></div></div>
      <div className="panel" style={{ width: 260, margin: "24px 0", padding: 16 }}>
        <svg viewBox="0 0 220 90" width="100%" role="img" aria-label="Score distribution">
          {d.distribution.map((n, i) => <g key={i}><rect x={10 + i * 52} y={70 - (n / maxBin) * 60} width={40} height={(n / maxBin) * 60} fill="currentColor" rx="2" />
            <text x={30 + i * 52} y={86} fontSize="9" textAnchor="middle" fill="#8f8f8f">{["0-39", "40-59", "60-79", "80+"][i]}</text>
            <text x={30 + i * 52} y={66 - (n / maxBin) * 60} fontSize="10" textAnchor="middle">{n}</text></g>)}
        </svg></div></div>

    <div className="row" style={{ marginBottom: 12 }}>
      <input placeholder="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
      <select style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>{["all", "Excellent", "Good", "Needs work", "Critical"].map((s) => <option key={s} value={s}>{s === "all" ? "Status: all" : s}</option>)}</select>
      <select style={{ width: 160 }} value={range} onChange={(e) => setRange(e.target.value)}>{Object.keys(RANGES).map((r) => <option key={r} value={r}>{r === "all" ? "Score: all" : r}</option>)}</select></div>

    <table><thead><tr><th style={{ width: 40 }} /><th>Student</th><th>Project</th><th>Score</th><th>Status</th><th>Last commit</th><th>Flags</th></tr></thead><tbody>
      {rows.slice(page * PER, page * PER + PER).map((r) => (
        <tr key={r.project} style={sel.includes(r.project) ? { background: "var(--hover)" } : null}>
          <td><input type="checkbox" style={{ width: 16, height: 16 }} checked={sel.includes(r.project)} onChange={() => toggle(r.project)} aria-label={`Select ${r.student}`} /></td>
          <td>{r.student}<div className="help" style={{ margin: 0 }}>{r.matric}</div></td>
          <td><Link to={`/projects/${r.project}`}>{r.name}</Link></td>
          <td><span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: dot(r.score) }} />{r.score}</span></td>
          <td><span className="badge">{r.status}</span></td><td className="grey">{r.last_commit}</td>
          <td><span className="row" style={{ gap: 6 }}>{r.flags.map((f) => <span key={f} className="badge">{f}</span>)}</span></td></tr>))}
      {rows.length === 0 && <tr><td colSpan="7" className="grey">No students match. Students appear here after their first submission.</td></tr>}
    </tbody></table>
    <div className="row between" style={{ marginTop: 12 }}><span className="grey">{rows.length} students</span>
      <div className="row"><button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span className="grey">Page {page + 1} of {pages}</span><button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>

    {sel.length > 0 && <div className="panel row between" style={{ position: "sticky", bottom: 16, marginTop: 16, boxShadow: "0 4px 12px rgba(0,0,0,.08)", padding: "12px 20px" }}>
      <span>{sel.length} selected</span><div className="row"><button className="btn" onClick={() => setSel([])}>Clear</button><button className="btn primary" disabled={sel.length < 2} onClick={() => setCompare(true)}>Compare</button></div></div>}

    {compare && chosen.length > 1 && <><h2>Compare</h2>
      <table><thead><tr><th>Criterion</th>{chosen.map((r) => <th key={r.project} className="num">{r.student}</th>)}</tr></thead><tbody>
        {chosen[0].criteria.map((c, i) => <tr key={c.name}><td>{c.name}</td>{chosen.map((r) => <td key={r.project} className="num">{r.criteria[i]?.score}/{r.criteria[i]?.weight}</td>)}</tr>)}
        <tr><td><b>Total</b></td>{chosen.map((r) => <td key={r.project} className="num"><b>{r.score}</b></td>)}</tr></tbody></table></>}
  </>);
}
