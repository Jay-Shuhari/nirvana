// ANCHOR: Settings.jsx - profile, password, appearance.
// TODO: photo upload (initials are shown for now).
import { useState } from "react";
import { api } from "../api.js";
import { Avatar, useUI } from "../components/ui.jsx";

export default function Settings({ user, refresh }) {
  const { toast } = useUI();
  const [p, setP] = useState({ name: user.name, department: user.department || "", matric: user.matric || "" });
  const [pw, setPw] = useState({ old: "", new: "", confirm: "" });
  const [theme, setTheme] = useState(localStorage.getItem("dt_theme") || "");
  async function saveProfile(e) { e.preventDefault(); try { await api("/me", { method: "PATCH", body: p }); await refresh(); toast.success("Profile saved."); } catch (err) { toast.error(err.message); } }
  async function savePw(e) {
    e.preventDefault();
    if (pw.new !== pw.confirm) return toast.error("New passwords do not match.");
    try { await api("/me/password", { method: "POST", body: { old: pw.old, new: pw.new } }); setPw({ old: "", new: "", confirm: "" }); toast.success("Password changed."); } catch (err) { toast.error(err.message); }
  }
  function pick(t) { setTheme(t); localStorage.setItem("dt_theme", t); document.documentElement.dataset.theme = t; }
  return (<div className="narrow">
    <h1>Settings</h1><div className="grey">Your profile and how Nirvana looks.</div>
    <h2>Profile</h2>
    <form className="panel" onSubmit={saveProfile}>
      <div className="row" style={{ marginBottom: 8 }}><Avatar name={p.name} size={48} /><div><b>{user.email}</b><div className="grey">{user.role === "supervisor" ? "Supervisor" : "Student"}</div></div></div>
      <label>Name</label><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      <label>Department</label><input value={p.department} onChange={(e) => setP({ ...p, department: e.target.value })} />
      {user.role === "student" && <><label>Matric number</label><input value={p.matric} onChange={(e) => setP({ ...p, matric: e.target.value })} /></>}
      <button className="btn primary" style={{ marginTop: 16 }}><span>Save profile</span></button></form>
    <h2>Password</h2>
    <form className="panel" onSubmit={savePw}>
      <label style={{ marginTop: 0 }}>Current password</label><input type="password" autoComplete="current-password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
      <label>New password</label><input type="password" autoComplete="new-password" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} />
      <label>Confirm new password</label><input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
      <button className="btn primary" style={{ marginTop: 16 }}><span>Change password</span></button></form>
    <h2>Appearance</h2>
    <div className="seg" style={{ maxWidth: 320 }}>{[["", "System"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => <button key={v} className={theme === v ? "on" : ""} onClick={() => pick(v)}>{l}</button>)}</div>
  </div>);
}
