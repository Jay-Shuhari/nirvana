// ANCHOR: NewProject.jsx - register a repository against a task (or a course, if there is no task).
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useUI } from "../components/ui.jsx";
import PageSkeleton from "../components/Skeleton.jsx";

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export default function NewProject() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { toast } = useUI();
  const [tasks, setTasks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [pick, setPick] = useState("");
  const [f, setF] = useState({ name: "", repo: "" });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([
      api("/tasks"),
      api("/courses"),
      api("/github/repositories").catch((error) => { toast.error(error.message); return []; }),
    ]).then(([t, c, r]) => {
      const open = t.filter((x) => !x.project); // * one project per task: hide tasks already started
      setTasks(open); setCourses(c); setRepositories(r);
      setPick(sp.get("task") ? `t:${sp.get("task")}` : open[0] ? `t:${open[0].id}` : c[0] ? `c:${c[0].id}` : "");
    }).catch((e) => toast.error(e.message)).finally(() => setReady(true));
  }, []);
  const task = tasks.find((t) => `t:${t.id}` === pick);

  async function go(e) {
    e.preventDefault();
    const repo = f.repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (!pick) return toast.error("Join a course first.");
    if (!f.name.trim()) return toast.error("Give the project a name.");
    if (!REPO_RE.test(repo)) return toast.error("Enter the repository as owner/name, for example jane-doe/my-app.");
    setBusy(true);
    try {
      const body = {
        name: f.name,
        repo,
        ...(selectedRepository ? { installation_id: selectedRepository.installation_id } : {}),
        ...(pick.startsWith("t:") ? { task: pick.slice(2) } : { course: pick.slice(2) }),
      };
      const p = await api("/projects", { method: "POST", body });
      toast.success("Project registered. Submit it for evaluation when you are ready.");
      nav(`/projects/${p.id}`);
    } catch (err) { toast.error(err.message); }
    setBusy(false);
  }
  if (!ready) return <PageSkeleton variant="form" />;

  return (<form className="narrow" onSubmit={go}>
    <h1>Register project</h1><div className="grey">Public repositories or repositories authorized via your GitHub App. We check that it exists before saving.</div>
    <label>Task</label>
    <select value={pick} onChange={(e) => setPick(e.target.value)}>
      {tasks.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.course.code} · {t.title}</option>)}
      {courses.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.code} · General project (no task)</option>)}
    </select>
    {courses.length === 0 && <div className="help">Join a course first from My courses.</div>}
    {task && task.requirements.length > 0 && <div className="panel" style={{ marginTop: 12 }}><b>This task checks:</b><ol className="grey" style={{ margin: "8px 0 0", paddingLeft: 20 }}>{task.requirements.map((r, i) => <li key={i}>{r}</li>)}</ol></div>}
    <label>Project name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
    <label>Repository</label><input value={f.repo} onChange={(e) => { setSelectedRepository(null); setF({ ...f, repo: e.target.value }); }} placeholder="jane-doe/my-app" />
    {repositories.length > 0 && <>
      <label htmlFor="github-repository">Or choose a repository from your GitHub App</label>
      <select id="github-repository" value={selectedRepository ? `${selectedRepository.installation_id}:${selectedRepository.full_name}` : ""}
        onChange={(e) => {
          const repository = repositories.find((item) => `${item.installation_id}:${item.full_name}` === e.target.value) || null;
          setSelectedRepository(repository);
          if (repository) setF({ ...f, repo: repository.full_name });
        }}>
        <option value="">Enter a public repository manually</option>
        {repositories.map((repository) => <option key={`${repository.installation_id}:${repository.full_name}`}
          value={`${repository.installation_id}:${repository.full_name}`}>
          {repository.full_name}{repository.private ? " (private)" : ""}
        </option>)}
      </select>
    </>}
    <div className="row wrap" style={{ marginTop: 24 }}><button type="button" className="btn" onClick={() => nav(-1)}><span>Back</span></button><button className="btn primary" disabled={busy}><span>{busy ? "Checking GitHub..." : "Register project"}</span></button></div>
  </form>);
}
