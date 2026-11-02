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
