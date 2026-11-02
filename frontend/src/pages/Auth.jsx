// ANCHOR: Auth.jsx - Login / Register
// * Heading "Nirvana" (logo font) with "Welcome back" beneath. Enter submits (real <form>). Feedback via toasts.
import { useState } from "react";
import { api, token } from "../api.js";
import { useUI } from "../components/ui.jsx";

export default function Auth({ onLogin }) {
  const { toast } = useUI();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ role: "student" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const reg = mode === "register";

  async function go(e) {
    e.preventDefault(); // ? Enter key triggers this because the fields live in a <form>
    if (busy) return;
    if (!f.email || !f.password) return toast.error("Enter your email and password.");
    setBusy(true);
    try {
      if (reg) {
        if (!f.name) throw new Error("Enter your name.");
        if (f.password !== f.confirm) throw new Error("Passwords do not match.");
        await api("/auth/register", { method: "POST", body: f });
        toast.success("Account created. Signing you in.");
      }
      let t;
      try { t = await api("/auth/login", { method: "POST", body: { username: f.email.trim().toLowerCase(), password: f.password } }); }
      catch { throw new Error("Incorrect email or password. Check your details and try again."); } // ! deliberately vague
      token.set(t.access);
      onLogin(await api("/me"));
    } catch (err) { toast.error(err.message); }
    setBusy(false);
  }

  return (
    <div className="center"><form className="panel card" onSubmit={go} noValidate>
      <h1 className="logo" style={{ fontSize: 36 }}>Nirvana</h1>
      <div className="grey">{reg ? "Create your account" : "Welcome back"}</div>
      {reg && <>
        <label htmlFor="name">Name</label><input id="name" autoComplete="name" onChange={set("name")} />
        <label>I am a</label>
        <div className="seg">{["student", "supervisor"].map((r) => <button type="button" key={r} className={f.role === r ? "on" : ""} onClick={() => setF({ ...f, role: r })}>{r === "student" ? "Student" : "Supervisor"}</button>)}</div>
      </>}
      <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" onChange={set("email")} />
      <label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete={reg ? "new-password" : "current-password"} onChange={set("password")} />
      {reg && <>
        <label htmlFor="pw2">Confirm password</label><input id="pw2" type="password" autoComplete="new-password" onChange={set("confirm")} />
        {f.role === "student" && <><label htmlFor="m">Matric number</label><input id="m" onChange={set("matric")} /></>}
        <label htmlFor="d">Department</label><input id="d" onChange={set("department")} />
      </>}
      <button className="btn primary" style={{ width: "100%", marginTop: 20 }} disabled={busy}>{busy ? "One moment..." : reg ? "Create account" : "Log in"}</button>
      <p className="grey" style={{ marginBottom: 0 }}><a href="#" onClick={(e) => { e.preventDefault(); setMode(reg ? "login" : "register"); }}>{reg ? "I already have an account" : "Create an account"}</a></p>
    </form></div>
  );
}
