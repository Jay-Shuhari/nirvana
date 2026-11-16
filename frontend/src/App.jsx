// ======================================================================
// ANCHOR: App.jsx
// FILE: frontend/src/App.jsx
// ROLE: App shell: fixed side nav (icons, bottom section), mobile drawer, routes, current user.
// SEE:  .tours/02-request-from-click-to-database.tour
// ======================================================================
import { useCallback, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, token } from "./api.js";
import { Avatar, Icon } from "./components/ui.jsx";
import PageSkeleton from "./components/Skeleton.jsx";
import Auth from "./pages/Auth.jsx";
import Cohort from "./pages/Cohort.jsx";
import CourseDetail from "./pages/CourseDetail.jsx";
import Courses from "./pages/Courses.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Help from "./pages/Help.jsx";
import Inbox from "./pages/Inbox.jsx";
import Landing from "./pages/Landing.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Project from "./pages/Project.jsx";
import Settings from "./pages/Settings.jsx";
import TaskDetail from "./pages/TaskDetail.jsx";
import { signOutProvider } from "./lib/firebase.js";

// * Old links (emails, bookmarks) pointed at /projects/new?task=ID. Starting a task now happens on the task page.
function LegacyNewProject() {
  const [sp] = useSearchParams();
  return <Navigate to={sp.get("task") ? `/tasks/${sp.get("task")}` : "/tasks"} replace />;
}

function AppSkeleton() {
  return (<>
    <header className="topbar app-skeleton-topbar" aria-hidden="true">
      <span className="skeleton-shape" style={{ width: 36, height: 36 }} />
      <span className="skeleton-shape" style={{ width: 112, height: 20 }} />
    </header>
    <aside className="side app-skeleton-side" aria-hidden="true">
      <span className="skeleton-shape app-skeleton-brand" />
      <nav>{Array.from({ length: 4 }, (_, i) => <div className="app-skeleton-link" key={i}>
        <span className="skeleton-shape" />
        <span className="skeleton-shape" />
      </div>)}</nav>
      <div className="bottom">
        {Array.from({ length: 2 }, (_, i) => <div className="app-skeleton-link" key={i}>
          <span className="skeleton-shape" />
          <span className="skeleton-shape" />
        </div>)}
        <div className="app-skeleton-profile">
          <span className="skeleton-shape" />
          <span className="skeleton-shape" />
        </div>
      </div>
    </aside>
    <main className="main"><PageSkeleton variant="dashboard" /></main>
  </>);
}

export default function App() {
  // ANCHOR: App shell
  const [user, setUser] = useState(null); // * null until /api/me confirms the token
  const [ready, setReady] = useState(!token.get());
  const [open, setOpen] = useState(false); // * mobile drawer
  const [accountOpen, setAccountOpen] = useState(false);
  const [layout, setLayout] = useState(localStorage.getItem("dt_layout") || "sidebar");
  const nav = useNavigate();
  const loc = useLocation();
  const refresh = useCallback(() => api("/me").then(setUser), []);

  // STEP 1: on first load, if a token exists, ask the server who we are.
  useEffect(() => {
    if (token.get()) refresh().catch(() => token.clear()).finally(() => setReady(true));
  }, [refresh]);
  useEffect(() => setOpen(false), [loc.pathname]); // close the drawer after navigating
  useEffect(() => { document.documentElement.dataset.layout = layout; }, [layout]);

  useEffect(() => {
    const onExpired = () => setUser(null);
    const onLayout = (e) => setLayout(e.detail);
    window.addEventListener("dt_session_expired", onExpired);
    window.addEventListener("dt_layout_change", onLayout);
    return () => {
      window.removeEventListener("dt_session_expired", onExpired);
      window.removeEventListener("dt_layout_change", onLayout);
    };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setAccountOpen(false); };
    const onClickOutside = (e) => {
      if (!e.target.closest(".account-menu-wrap")) setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClickOutside);
    };
  }, [accountOpen]);

  if (!ready) return <AppSkeleton />; // ? keeps the app shell visible while the saved session is checked
  const out = () => { token.clear(); signOutProvider(); setUser(null); nav("/"); }; // * logout = forget the token
  // STEP 2: not logged in -> public landing page at "/", sign-in everywhere else (keeps deep links)
  if (!user) return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="*" element={<Auth onLogin={setUser} />} />
  </Routes>;
  // STEP 3: signed in but setup unfinished -> onboarding on every route (the server enforces the same gate)
  if (!user.onboarding?.complete) return <Onboarding user={user} onDone={refresh} onSignOut={out} />;
  const sup = user.role === "supervisor";
  const link = (to, icon, label, end) => <NavLink to={to} end={end} className={({ isActive }) => (isActive ? "on" : "")}><Icon name={icon} />{label}
    {to === "/inbox" && user.unread > 0 && <span className="count" aria-label={`${user.unread} unread`}>{user.unread}</span>}</NavLink>;

  return (<>
    <header className="topbar">
      <button className="btn icon mobile-layout-menu" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
      <span className="logo">Metis</span>
      <div className="account-actions">
        <NavLink className="btn icon" to="/inbox?tab=activity" aria-label={`Inbox${user.unread ? `, ${user.unread} unread` : ""}`}><Icon name="bell" /></NavLink>
        <div className="account-menu-wrap">
          <button className="btn icon account-trigger" onClick={() => setAccountOpen(!accountOpen)} aria-label="Account menu" aria-expanded={accountOpen}>
            <Avatar name={user.name} size={26} />
          </button>
          {accountOpen && <div className="account-menu">
            <div className="account-menu-name"><b>{user.name}</b><span>{user.email}</span></div>
            <NavLink to="/settings" onClick={() => setAccountOpen(false)}><Icon name="settings" />Settings</NavLink>
            <NavLink to="/help" onClick={() => setAccountOpen(false)}><Icon name="help" />Help</NavLink>
            <button onClick={out}><Icon name="logout" />Sign out</button>
          </div>}
        </div>
      </div>
    </header>
    {open && <div className="scrim" onClick={() => setOpen(false)} />}
    <aside className={`side ${open ? "open" : ""}`}>
      <div className="brand logo">Metis</div>
      <nav aria-label="Primary">
        {link("/", "dashboard", "Dashboard", true)}
        {link("/courses", "book", sup ? "Courses" : "My courses")}
        {link("/inbox", "inbox", "Inbox")}
      </nav>
      <div className="bottom">
        {link("/settings", "settings", "Settings")}
        {link("/help", "help", "Help")}
        <div className="me"><Avatar name={user.name} /><div><b>{user.name}</b><span>{sup ? "Supervisor" : "Student"}</span></div>
          <button className="btn icon" onClick={out} aria-label="Log out" title="Log out"><Icon name="logout" /></button></div>
      </div>
    </aside>
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {link("/", "dashboard", "Home", true)}
      {link("/courses", "book", "Courses")}
      {link("/inbox", "inbox", "Inbox")}
      {link("/settings", "settings", "Settings")}
    </nav>
    <main className="main">
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/courses" element={<Courses user={user} />} />
        <Route path="/courses/:id" element={<CourseDetail user={user} />} />
        <Route path="/courses/:id/cohort" element={<Cohort />} />
        <Route path="/inbox" element={<Inbox user={user} refresh={refresh} />} />
        <Route path="/tasks" element={<Navigate to="/inbox" replace />} />
        <Route path="/notifications" element={<Navigate to="/inbox?tab=activity" replace />} />
        <Route path="/tasks/:id" element={<TaskDetail user={user} />} />
        <Route path="/projects/new" element={<LegacyNewProject />} />
        <Route path="/projects/:id" element={<Project user={user} />} />
        <Route path="/settings" element={<Settings user={user} refresh={refresh} />} />
        <Route path="/help" element={<Help />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </main>
  </>);
}
