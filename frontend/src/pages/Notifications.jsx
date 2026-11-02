// ANCHOR: Notifications.jsx - in-app inbox. Opening the page marks everything read and clears the sidebar badge.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useUI } from "../components/ui.jsx";
import PageSkeleton from "../components/Skeleton.jsx";

export default function Notifications({ refresh }) {
  const [list, setList] = useState(null);
  const { toast } = useUI();
  const nav = useNavigate();
  useEffect(() => {
    api("/notifications").then(setList).catch((e) => toast.error(e.message));
  }, []);
  async function markAll() { try { await api("/notifications/read", { method: "POST" }); setList(list.map((n) => ({ ...n, read: true }))); refresh(); } catch (e) { toast.error(e.message); } }
  if (!list) return <PageSkeleton variant="feed" />;
  return (<div className="narrow">
    <div className="row between wrap"><div><h1>Notifications</h1><div className="grey">Deadlines, feedback and submissions.</div></div>
      <button className="btn" onClick={markAll} disabled={!list.some((n) => !n.read)}><span>Mark all as read</span></button></div>
    {list.length === 0 ? <div className="empty" style={{ marginTop: 24 }}>No notifications yet. Deadlines and feedback will appear here.</div> :
    <div className="panel list" style={{ marginTop: 24 }}>{list.map((n) => <div key={n.id} className="row between wrap" style={{ cursor: n.link ? "pointer" : "default" }} onClick={() => n.link && nav(n.link)}>
      <span className={n.read ? "" : "unread"}>{n.text}</span><span className="grey">{new Date(n.created).toLocaleString()}</span></div>)}</div>}
  </div>);
}
