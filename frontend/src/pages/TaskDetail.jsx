import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useUI } from "../components/ui.jsx";
import PageSkeleton from "../components/Skeleton.jsx";

export default function TaskDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useUI();
  const [task, setTask] = useState(null);
  useEffect(() => {
    api(`/tasks/${id}`)
      .then(setTask)
      .catch((error) => { toast.error(error.message); navigate("/tasks"); });
  }, [id]);
  if (!task) return <PageSkeleton variant="course" />;

  const supervisor = user.role === "supervisor";
  return (<>
    <div className="grey" style={{ marginBottom: 8 }}><Link to="/tasks">Tasks</Link> / {task.title}</div>
    <h1>{task.title}</h1>
    <div className="grey">{task.course.code} · {task.due ? `Due ${task.due}` : "No deadline"}</div>
    {task.description && <p>{task.description}</p>}
    {task.requirements.length > 0 && <section className="panel" style={{ marginTop: 20 }}>
      <h2 style={{ margin: "0 0 8px" }}>Requirements</h2>
      <ul>{task.requirements.map((requirement, index) => <li key={index}>{requirement}</li>)}</ul>
    </section>}
    {!supervisor && task.project && <div className="row" style={{ marginTop: 16 }}>
      <Link className="btn primary" to={`/projects/${task.project.id}`}><span>Open your project</span></Link>
    </div>}
    {!supervisor && !task.project && <div className="row" style={{ marginTop: 16 }}>
      <Link className="btn primary" to={`/projects/new?task=${task.id}`}><span>Start this task</span></Link>
    </div>}
    <h2>{supervisor ? `Students (${task.students.length})` : "Your submission"}</h2>
    {task.students.length === 0 ? <div className="empty">No students are enrolled in this course yet.</div> :
      <div className="panel list">
        {task.students.map((student) => <div key={student.id} className="row between wrap">
          <div><b>{student.name}</b>{student.matric && <span className="grey"> · {student.matric}</span>}</div>
          {student.project
            ? <Link className="btn sm" to={`/projects/${student.project.id}`}><span>{student.project.name} · Open</span></Link>
            : <span className="grey">No project registered</span>}
        </div>)}
      </div>}
  </>);
}
