// ANCHOR: Help.jsx - short FAQ. Answers the questions we actually hit while building.
const FAQ = [
  ["How is my score calculated?", "Each criterion in your course rubric is measured from your repository (commit history, README, tests, structure) and multiplied by its weight. Your supervisor can adjust any criterion, and must give a reason."],
  ["Why did it say the repository was not found?", "Check the spelling as owner/name. The repository must be public. Private repositories return 'not found' to Nirvana."],
  ["What does the AI review do?", "When configured, Gemini checks task requirements and recommends points with an evidence-based rationale for each course rubric criterion. Without an AI key, requirements use a keyword check and rubric scores use repository metrics. Supervisors can override criterion scores or the overall grade."],
  ["Is my code sent anywhere?", "When an AI provider is configured on the backend, selected repository files are sent to that provider during each project evaluation for rubric recommendations (and task requirement checks when present). Otherwise repository contents are not sent to an AI provider."],
  ["Why can't I register the same repository twice?", "Each repository can be registered once per course, and you can have one project per task. Delete the old project if you need to start again."],
  ["Why is my timeline empty?", "It appears after your first successful evaluation. Open the project and click Submit for evaluation."],
  ["How often can I submit?", "Up to 5 submissions per project per day."],
];
export default function Help() {
  return (<div className="narrow"><h1>Help</h1><div className="grey">Quick answers. Still stuck? Ask your supervisor.</div>
    <div style={{ marginTop: 24 }}>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div>);
}
