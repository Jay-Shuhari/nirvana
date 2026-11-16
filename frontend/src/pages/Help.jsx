// ANCHOR: Help.jsx - short FAQ. Answers the questions we actually hit while building.
const FAQ = [
  ["How is my score calculated?", "Each criterion in your course rubric is measured from your repository (commit history, README, tests, structure) and multiplied by its weight. Your supervisor can adjust any criterion, and must give a reason."],
  ["Why can't I see my repository?", "Metis lists only repositories you granted to the Metis GitHub App. Open Settings > GitHub App > Manage on GitHub and give the App access to that repository. Public links can't be added by hand."],
  ["Why do I need GitHub if I signed up with Google?", "Your work lives on GitHub. Linking proves the account is yours, and the Metis App lets you pick a repository when you start a task."],
  ["What does the AI review do?", "When configured, Ttonpa checks task requirements and recommends points with an evidence-based rationale for each course rubric criterion. Without an AI key, requirements use a keyword check and rubric scores use repository metrics. Supervisors can override criterion scores or the overall grade."],
  ["Is my code sent anywhere?", "When an AI provider is configured on the backend, selected repository files are sent to that provider during each project evaluation for rubric recommendations (and task requirement checks when present). Otherwise repository contents are not sent to an AI provider."],
  ["How do I start a task?", "Open the task from your inbox or course page, choose a repository from your GitHub list and press Start task. Choosing a repository doesn't submit anything."],
  ["How are groups formed?", "Your supervisor either assigns groups (often auto-built from everyone's strengths so each group has a mix of skills) or lets you choose an open group on the course's Groups tab."],
  ["Can I use the same repository twice?", "Each repository can be used once per course, and you have one project per task."],
  ["Why is my timeline empty?", "It appears after your first successful evaluation. Open the project and click Submit for evaluation."],
  ["Is my matric number visible to classmates?", "No. Classmates see your name and group. Your supervisor sees your matric number, email and strengths."],
  ["How often can I submit?", "Each project permits only one evaluation attempt per task."],
];
export default function Help() {
  return (<div className="narrow"><h1>Help</h1><div className="grey">Quick answers. Still stuck? Ask your supervisor.</div>
    <div style={{ marginTop: 24 }}>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div>);
}
