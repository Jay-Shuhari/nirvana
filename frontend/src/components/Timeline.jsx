// ======================================================================
// ANCHOR: Timeline.jsx
// FILE: Timeline.jsx
// ROLE: The signature chart: weekly commit bars, hatched inactivity gaps.
// SEE:  docs/Scoring.md
// ======================================================================
// Weekly commit chart. Empty weeks are hatched; the longest gap is labelled.
// ANCHOR: Timeline chart
// * Plain SVG - no chart library. Empty weeks use a diagonal hatch, not colour.
export default function Timeline({ weekly = [], longestGap = 0 }) {
  const W = 720, H = 200, pad = 28, max = Math.max(1, ...weekly);
  const bw = (W - pad * 2) / weekly.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" role="img" aria-label="Weekly commit activity">
      <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#bbb" strokeWidth="2" /></pattern></defs>
      {[0, .5, 1].map((t) => <line key={t} x1={pad} x2={W - pad} y1={H - t * (H - 20)} y2={H - t * (H - 20)} stroke="#eaeaea" />)}
      {weekly.map((n, i) => n === 0
        ? <rect key={i} x={pad + i * bw + 3} y={20} width={bw - 6} height={H - 20} fill="url(#hatch)" />
        : <rect key={i} x={pad + i * bw + 3} y={H - (n / max) * (H - 20)} width={bw - 6} height={(n / max) * (H - 20)} fill="currentColor" />)}
      {weekly.map((_, i) => <text key={i} x={pad + i * bw + bw / 2} y={H + 16} fontSize="11" textAnchor="middle" fill="#8f8f8f">W{i + 1}</text>)}
      {longestGap >= 7 && <text x={W - pad} y={12} fontSize="12" textAnchor="end" fill="#666">{longestGap} days without commits</text>}
    </svg>
  );
}
