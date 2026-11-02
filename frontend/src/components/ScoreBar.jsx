// ======================================================================
// ANCHOR: ScoreBar.jsx
// FILE: ScoreBar.jsx
// ROLE: 6px black score bar with the number on the right.
// SEE:  docs/Architecture.md
// ======================================================================
// * value out of max, drawn as a bar.
export default function ScoreBar({ value, max = 100 }) {
  return <div className="row" style={{ gap: 12 }}><div className="bar"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div><span style={{ minWidth: 52, textAlign: "right" }}>{value}/{max}</span></div>;
}
