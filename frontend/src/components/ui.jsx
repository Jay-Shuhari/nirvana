// ======================================================================
// ANCHOR: ui.jsx
// FILE: frontend/src/components/ui.jsx
// ROLE: Shared UI: icons, avatar (initials), toasts and the confirm dialog.
// SEE:  docs/Architecture.md
// ======================================================================
import { createContext, useCallback, useContext, useRef, useState } from "react";

// ANCHOR: Icons
// * Hand-drawn 24px line icons (lucide style). Usage: <Icon name="trash" />
const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  tasks: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  settings: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  github: <><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></>,
  google: <><path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.5z" /><path d="M12 22c2.7 0 5-.9 6.8-2.4l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.8v2.6A10 10 0 0 0 12 22z" /><path d="M6.2 13.7a6 6 0 0 1 0-3.8V7.3H2.8a10 10 0 0 0 0 9z" /><path d="M12 5.9c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.8 7.3l3.4 2.6C7 7.5 9.3 5.9 12 5.9z" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  arrow: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  back: <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  inbox: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
  chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  spark: <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />,
  grid: <><circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20v-1a5 5 0 0 1 10 0v1" /><path d="M14 20v-.5a4 4 0 0 1 7-2.6" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.49 15A9 9 0 1 1 18.4 5.6L23 10" /></>,
};
export const Icon = ({ name, size = 16 }) => <svg className="i" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>;

// ANCHOR: Avatar
// * Initials only for now (no photo upload). Colour is always black/white to match the site.
export function Avatar({ name = "?", size = 32 }) {
  const t = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{t}</span>;
}

// ANCHOR: Toasts and confirm
// * useUI() -> { toast.success/error/info(text), confirm({title, body, confirm, danger}) -> Promise<boolean> }
const Ctx = createContext(null);
export const useUI = () => useContext(Ctx);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dlg, setDlg] = useState(null);
  const id = useRef(0);
  const push = useCallback((kind, text) => {
    const n = ++id.current;
    setToasts((t) => [...t, { n, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.n !== n)), 4500);
  }, []);
  const toast = { success: (t) => push("success", t), error: (t) => push("error", t), info: (t) => push("info", t) };
  const confirm = useCallback((o) => new Promise((res) => setDlg({ ...o, res })), []);
  const close = (v) => { dlg.res(v); setDlg(null); };
  const color = { error: "var(--bad)", success: "var(--good)", info: "var(--text3)" };
  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.n} className="toast" role="status"><i className="dot" style={{ background: color[t.kind] }} /><span>{t.text}</span></div>)}</div>
      {dlg && <div className="overlay" onClick={() => close(false)} onKeyDown={(e) => e.key === "Escape" && close(false)}>
        <div className="panel dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <h3>{dlg.title}</h3><div className="grey">{dlg.body}</div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => close(false)}>Cancel</button>
            <button className={`btn ${dlg.danger ? "danger" : "primary"}`} onClick={() => close(true)} autoFocus>{dlg.confirm || "Confirm"}</button>
          </div></div></div>}
    </Ctx.Provider>
  );
}
