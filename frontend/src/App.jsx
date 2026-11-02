// ======================================================================
// ANCHOR: App.jsx
// FILE: frontend/src/App.jsx
// ROLE: App shell: fixed side nav (icons, bottom section), mobile drawer, routes, current user.
// SEE:  .tours/02-request-from-click-to-database.tour
// ======================================================================
import { useCallback, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, token } from "./api.js";
import { Avatar, Icon } from "./components/ui.jsx";
import PageSkeleton from "./components/Skeleton.jsx";
import Auth from "./pages/Auth.jsx";
import Cohort from "./pages/Cohort.jsx";
import CourseDetail from "./pages/CourseDetail.jsx";
import Courses from "./pages/Courses.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Help from "./pages/Help.jsx";
import NewProject from "./pages/NewProject.jsx";
import Notifications from "./pages/Notifications.jsx";
import Project from "./pages/Project.jsx";
import Settings from "./pages/Settings.jsx";
import Tasks from "./pages/Tasks.jsx";

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
  const nav = useNavigate();
  const loc = useLocation();
  const refresh = useCallback(() => api("/me").then(setUser), []);

  // STEP 1: on first load, if a token exists, ask the server who we are.
  useEffect(() => { if (token.get()) refresh().catch(() => token.clear()).finally(() => setReady(true)); }, [refresh]);
  useEffect(() => setOpen(false), [loc.pathname]); // close the drawer after navigating

  if (!ready) return <AppSkeleton />; // ? keeps the app shell visible while the saved session is checked
  if (!user) return <Auth onLogin={setUser} />; // STEP 2: not logged in -> login/register card
  const sup = user.role === "supervisor";
  const out = () => { token.clear(); setUser(null); nav("/"); }; // * logout = forget the token
  const link = (to, icon, label, end) => <NavLink to={to} end={end} className={({ isActive }) => (isActive ? "on" : "")}><Icon name={icon} />{label}
    {to === "/notifications" && user.unread > 0 && <span className="count">{user.unread}</span>}</NavLink>;

  return (<>
    <header className="topbar"><button className="btn icon" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button><span className="logo">Nirvana</span></header>
    {open && <div className="scrim" onClick={() => setOpen(false)} />}
    <aside className={`side ${open ? "open" : ""}`}>
      <div className="brand logo">Nirvana</div>
      <nav>
        {link("/", "dashboard", "Dashboard", true)}
        {link("/courses", "book", sup ? "Courses" : "My courses")}
        {link("/tasks", "tasks", "Tasks")}
        {link("/notifications", "bell", "Notifications")}
      </nav>
      <div className="bottom">
        {link("/settings", "settings", "Settings")}
        {link("/help", "help", "Help")}
        <div className="me"><Avatar name={user.name} /><div><b>{user.name}</b><span>{sup ? "Supervisor" : "Student"}</span></div>
          <button className="btn icon" onClick={out} aria-label="Log out" title="Log out"><Icon name="logout" /></button></div>
      </div>
    </aside>
    <main className="main">
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/courses" element={<Courses user={user} />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/courses/:id/cohort" element={<Cohort />} />
        <Route path="/tasks" element={<Tasks user={user} />} />
        <Route path="/projects/new" element={<NewProject />} />
        <Route path="/projects/:id" element={<Project user={user} />} />
        <Route path="/notifications" element={<Notifications refresh={refresh} />} />
        <Route path="/settings" element={<Settings user={user} refresh={refresh} />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </main>
  </>);
}
