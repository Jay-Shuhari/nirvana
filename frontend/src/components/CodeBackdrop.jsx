// ANCHOR: CodeBackdrop.jsx - decorative grid + drifting code tokens (landing and sign-in). Hidden from assistive tech.
const TOKENS = [
  "git commit -m \"feat: auth\"", "def evaluate(repo):", "assert score <= weight", "npm test", "const rubric = []",
  "pytest -q", "SELECT * FROM tasks", "return Response(data)", "<Route path=\"/\" />", "if (deadline > now)",
  "README.md", "git push origin main", "class Submission:", "useEffect(() => {})", "tests/ ✓ 24 passed",
];

// * zone="right" keeps tokens away from text on the left (landing hero).
export default function CodeBackdrop({ count = 14, zone = "all" }) {
  return (
    <div className={`code-backdrop zone-${zone}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="float" style={{
          left: zone === "right" ? `${56 + ((i * 37) % 38)}%` : `${(i * 37) % 92}%`, top: `${12 + ((i * 53) % 80)}%`,
          animationDelay: `${-(i * 1.7) % 18}s`, animationDuration: `${16 + (i % 5) * 2}s`,
        }}>{TOKENS[i % TOKENS.length]}</span>
      ))}
    </div>
  );
}

// * A static "editor" showing what Metis does. Lines are [kind, text] pairs.
export function CodeWindow({ title = "evaluation.metis", lines, cursor = true }) {
  return (
    <div className="code-window" aria-hidden="true">
      <div className="bar-top"><i /><i /><i /><span style={{ marginLeft: 8 }}>{title}</span></div>
      <pre>{lines.map((parts, n) => <div key={n}><span className="ln">{n + 1}</span>{parts.map(([k, t], j) => <span key={j} className={k}>{t}</span>)}
        {cursor && n === lines.length - 1 && <span className="cursor" />}</div>)}</pre>
    </div>
  );
}

export const EVALUATION_LINES = [
  [["com", "# Ttonpa reviews the repo you picked from GitHub"]],
  [["kw", "assignment"], ["", " = "], ["str", "\"Build the login system\""]],
  [["kw", "repo"], ["", " = github."], ["kw", "installation"], ["", "("], ["str", "\"you/login-app\""], ["", ")"]],
  [["", ""]],
  [["kw", "for"], ["", " criterion "], ["kw", "in"], ["", " rubric:  "], ["com", "# weights total 100"]],
  [["", "    evidence = read(repo, tests="], ["kw", "True"], ["", ")"]],
  [["", "    score(criterion, evidence)"]],
  [["", ""]],
  [["com", "# Testing        13/15  tests/test_auth.py:12"]],
  [["com", "# Documentation   9/10  README.md"]],
  [["com", "# Architecture   12/15  src/, tests/ separated"]],
  [["kw", "result"], ["", " = "], ["str", "86"], ["", " / 100  "], ["com", "# advisory, supervisor reviews"]],
];
