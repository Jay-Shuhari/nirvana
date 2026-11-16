// ANCHOR: Dashboard.jsx - widget home for students and supervisors. Data: /dashboard, /overview, /notifications.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, dot } from "../api.js";
import PageSkeleton from "../components/Skeleton.jsx";
import { Avatar, Icon, useUI } from "../components/ui.jsx";
import { dueInfo } from "./Inbox.jsx";

const label = (s) => (s >= 75 ? "Good" : s >= 55 ? "Needs work" : "Critical");

// ANCHOR: Widget pieces (monochrome; numbers always shown as text beside the graphic)
function Widget({ title, icon, to, linkText = "View all", w = "", children, labelledBy }) {
  return <section className={`widget ${w}`} aria-labelledby={labelledBy}>
    <header><h3 id={labelledBy}>{icon && <Icon name={icon} />}{title}</h3>{to && <Link to={to}>{linkText}</Link>}</header>
    {children}
  </section>;
}
function Ring({ value, max, size = 88, label: aria }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, pct = max ? Math.min(1, value / max) : 0;
  return <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={aria}>
    <circle className="track" cx={size / 2} cy={size / 2} r={r} />
    <circle className="val" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{Math.round(pct * 100)}%</text>
  </svg>;
}
function Spark({ values, label: aria }) {
  if (values.length < 2) return null;
  const W = 240, H = 64, lo = Math.min(...values, 0), hi = Math.max(...values, 100);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={aria}>
    <path className="area" d={`${line} L${W},${H} L0,${H} Z`} /><path className="line" d={line} /></svg>;
}
function Bars({ days, label: aria }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return <div className="bars14" role="img" aria-label={aria}>
    {days.map((d) => <span key={d.date} className={d.count ? "" : "zero"} style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
      title={`${new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}: ${d.count}`} />)}
  </div>;
}
function Countdown({ due }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const end = new Date(due + "T23:59:59").getTime(); // * due dates are inclusive: open until the end of that day
  const ms = Math.max(0, end - now), d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return <div className="countdown" aria-label={`${d} days and ${h} hours left`}><b>{d}</b><span className="grey">d</span><b>{h}</b><span className="grey">h left</span></div>;
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
function useLoad(fn) {
  const { toast } = useUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => fn().then((d) => { setData(d); setError(""); }).catch((e) => { setError(e.message); toast.error(e.message); }), []);
  useEffect(() => { load(); }, [load]);
  return [data, error, load];
}
const Failed = ({ error, retry }) => <div className="empty" role="alert" style={{ marginTop: 24 }}><b>Could not load your dashboard.</b><br />{error}<br /><br />
  <button className="btn" onClick={retry}><Icon name="refresh" /><span>Try again</span></button></div>;

export default function Dashboard({ user }) {
  return user.role === "supervisor" ? <Teacher user={user} /> : <Student user={user} />;
}

function Student({ user }) {
  const [d, error, retry] = useLoad(() => Promise.all([api("/dashboard"), api("/notifications")]).then(([dash, notes]) => ({ ...dash, notes })));
  if (error && !d) return <Failed error={error} retry={retry} />;
  if (!d) return <PageSkeleton variant="dashboard" />;
  const next = d.overdue[0] || d.upcoming[0] || d.no_due[0];
  const scores = d.results.map((r) => r.score);
  const latest = d.results[d.results.length - 1];
  const delta = d.results.length > 1 ? latest.score - d.results[d.results.length - 2].score : null;

  return (<>
    <div className="greet"><div><h1>{greeting()}, {user.name.split(" ")[0]}</h1>
      <div className="grey">{d.counts.overdue ? `${d.counts.overdue} task${d.counts.overdue > 1 ? "s are" : " is"} overdue.` : d.counts.open ? `${d.counts.open} open task${d.counts.open > 1 ? "s" : ""} across ${d.counts.courses} course${d.counts.courses === 1 ? "" : "s"}.` : d.counts.courses ? "You're all caught up." : "Join your first course to get started."}</div></div>
      {next ? <Link className="btn primary" to={`/tasks/${next.id}`}><span>{next.project ? "Continue" : "Start"}: {next.title}</span><Icon name="arrow" /></Link>
        : !d.counts.courses && <Link className="btn primary" to="/courses"><Icon name="plus" /><span>Join a course</span></Link>}</div>

    <div className="widgets">
      <Widget title="Next deadline" icon="clock" labelledBy="w-next">
        {next?.due ? <><Countdown due={next.due} /><div><Link to={`/tasks/${next.id}`}><b>{next.title}</b></Link><div className="grey">{next.course.code} · <span className={`pill-due ${dueInfo(next.due).tone}`}>{dueInfo(next.due).label}</span></div></div></>
          : <p className="grey" style={{ margin: 0 }}>{next ? `${next.title} has no due date.` : "No upcoming deadlines."}</p>}
      </Widget>
      <Widget title="Progress" icon="check" labelledBy="w-progress" to="/inbox?tab=done" linkText="Submitted">
        <div className="ring-wrap"><Ring value={d.counts.submitted} max={d.counts.tasks} label={`${d.counts.submitted} of ${d.counts.tasks} tasks submitted`} />
          <div><div className="metric">{d.counts.submitted}<small>of {d.counts.tasks}</small></div><div className="grey">tasks submitted</div></div></div>
      </Widget>
      <Widget title="Latest score" icon="chart" labelledBy="w-score" to={latest ? `/projects/${latest.project}` : undefined} linkText="Open">
        {latest ? <><div className="row between"><div className="metric">{latest.score}<small>/ 100</small></div>
          <span className="badge"><i className="dot" style={{ background: dot(latest.score) }} />{label(latest.score)}</span></div>
          <div className="grey" style={{ fontSize: 12 }}>{latest.task}{delta !== null && ` · ${delta >= 0 ? "+" : ""}${delta} from previous`}</div>
          <Spark values={scores} label={`Score trend over your last ${scores.length} results: ${scores.join(", ")}`} /></>
          : <p className="grey" style={{ margin: 0 }}>Submit a task to see your first score here.</p>}
      </Widget>

      <Widget title="Coming up" icon="tasks" labelledBy="w-up" to="/inbox" w="w8">
        {[...d.overdue, ...d.upcoming].length === 0 ? <p className="grey" style={{ margin: 0 }}>Nothing due. Check the inbox for tasks without a deadline.</p> :
          <div className="wlist">{[...d.overdue, ...d.upcoming].slice(0, 5).map((t) => { const i = dueInfo(t.due); return (
            <Link key={t.id} to={`/tasks/${t.id}`}><span className="t"><b style={{ fontWeight: 500 }}>{t.title}</b> <span className="grey">· {t.course.code}</span></span>
              <span className={`pill-due ${i.tone}`}>{i.label}</span></Link>); })}</div>}
      </Widget>
      <Widget title="My groups" icon="users" labelledBy="w-groups">
        {d.groups.length === 0 ? <p className="grey" style={{ margin: 0 }}>You're not in a group yet. Groups appear here when your supervisor creates them.</p> :
          <div className="wlist">{d.groups.map((g) => <Link key={g.course_id} to={`/courses/${g.course_id}?tab=groups`}>
            <span className="t"><b style={{ fontWeight: 500 }}>{g.name}</b> <span className="grey">· {g.course}{g.role === "lead" ? " · Lead" : ""}</span></span>
            <span className="avatars">{g.members.slice(0, 4).map((m) => <Avatar key={m} name={m} size={24} />)}</span></Link>)}</div>}
      </Widget>

      <Widget title="Recent activity" icon="bell" labelledBy="w-act" to="/inbox?tab=activity" w="w6">
        {d.notes.length === 0 ? <p className="grey" style={{ margin: 0 }}>No updates yet.</p> :
          <div className="wlist">{d.notes.slice(0, 5).map((n) => <Link key={n.id} to={n.link || "/inbox?tab=activity"}>
            <span className="t">{!n.read && <i className="dot" style={{ background: "var(--text)", marginRight: 8 }} aria-label="Unread" />}{n.text}</span>
            <span className="grey" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{new Date(n.created).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span></Link>)}</div>}
      </Widget>
      <Widget title="Your profile" icon="spark" labelledBy="w-me" to="/settings" linkText="Edit" w="w6">
        <div className="chips">{(user.strengths?.areas || []).map((a) => <span key={a} className="chip" style={{ cursor: "default" }}>{a}</span>)}
          {!(user.strengths?.areas || []).length && <span className="grey">No strengths saved yet.</span>}</div>
        <div className="row wrap" style={{ gap: 16 }}>
          <span className="row" style={{ gap: 6 }}><Icon name="github" />{user.identities?.find((i) => i.provider === "github")?.login ? `@${user.identities.find((i) => i.provider === "github").login}` : "GitHub linked"}</span>
          {user.matric && <span className="grey mono">{user.matric}</span>}
        </div>
        <Bars days={d.activity} label={`Your submissions over the last 14 days: ${d.activity.reduce((a, x) => a + x.count, 0)} in total`} />
        <div className="help" style={{ marginTop: -4 }}>Your submissions, last 14 days</div>
      </Widget>
    </div>
  </>);
}

function Teacher({ user }) {
  const [d, error, retry] = useLoad(() => Promise.all([api("/overview"), api("/dashboard")]).then(([o, dash]) => ({ ...o, ...dash })));
  if (error && !d) return <Failed error={error} retry={retry} />;
  if (!d) return <PageSkeleton variant="dashboard" />;
  const total14 = d.activity.reduce((a, x) => a + x.count, 0);

  return (<>
    <div className="greet"><div><h1>{greeting()}, {user.name.split(" ")[0]}</h1><div className="grey">Everything across your courses.</div></div>
      <div className="row wrap"><Link className="btn" to="/courses"><Icon name="book" /><span>Courses</span></Link><Link className="btn primary" to="/inbox"><Icon name="plus" /><span>Create task</span></Link></div></div>
    <div className="stats"><div><b>{d.totals.courses}</b><span>Courses</span></div><div><b>{d.totals.students}</b><span>Students</span></div><div><b>{d.totals.submissions}</b><span>Evaluated projects</span></div><div><b>{d.totals.average ?? "-"}</b><span>Average score</span></div></div>

    {d.courses.length === 0 ? <div className="empty"><b>No courses yet.</b><br />Create a course, share its join code, then add your first task.<br /><br /><Link className="btn primary" to="/courses?new=1"><Icon name="plus" /><span>Create a course</span></Link></div> :
    <div className="widgets" style={{ marginTop: 0 }}>
      <Widget title="Submissions, last 14 days" icon="chart" labelledBy="w-subs" w="w8">
        <div className="metric">{total14}<small>submission{total14 === 1 ? "" : "s"}</small></div>
        <Bars days={d.activity} label={`${total14} submissions in the last 14 days`} />
      </Widget>
      <Widget title="Average score" icon="spark" labelledBy="w-avg">
        <div className="ring-wrap"><Ring value={d.totals.average ?? 0} max={100} label={`Average score ${d.totals.average ?? "not available"}`} />
          <div><div className="metric">{d.totals.average ?? "–"}<small>/ 100</small></div><div className="grey">{d.totals.submissions} evaluated</div></div></div>
      </Widget>

      <Widget title="Upcoming deadlines" icon="clock" labelledBy="w-due" to="/inbox" w="w6">
        {d.upcoming.length === 0 ? <p className="grey" style={{ margin: 0 }}>No upcoming deadlines.</p> :
          <div className="wlist">{d.upcoming.map((t) => <Link key={t.id} to={`/tasks/${t.id}`}>
            <span className="t"><b style={{ fontWeight: 500 }}>{t.title}</b><br /><span className="grey" style={{ fontSize: 12 }}>{t.course.code} · {dueInfo(t.due).label}</span></span>
            <span style={{ width: 96 }}><span className="grey" style={{ fontSize: 12 }}>{t.submitted}/{t.enrolled} in</span>
              <span className="bar" style={{ display: "block", marginTop: 4 }}><i style={{ width: `${t.enrolled ? (t.submitted / t.enrolled) * 100 : 0}%` }} /></span></span></Link>)}</div>}
      </Widget>
      <Widget title="Needs attention" icon="alert" labelledBy="w-att" w="w6">
        {d.attention.length === 0 ? <p className="grey" style={{ margin: 0 }}>No one is flagged right now.</p> :
          <div className="wlist">{d.attention.slice(0, 5).map((r) => <Link key={r.project} to={`/projects/${r.project}`}>
            <span className="t"><b style={{ fontWeight: 500 }}>{r.student}</b> <span className="grey">· {r.course}</span><br /><span className="grey" style={{ fontSize: 12 }}>{r.flags.length ? r.flags.join(", ") : "Low score"}</span></span>
            <span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: dot(r.score) }} />{r.score}</span></Link>)}</div>}
      </Widget>

      <Widget title="Courses" icon="book" labelledBy="w-courses" to="/courses" w="w8">
        <div className="wlist">{d.courses.map((c) => <Link key={c.id} to={`/courses/${c.id}`}>
          <span className="t"><b style={{ fontWeight: 500 }}>{c.code}</b> <span className="grey">{c.title}</span></span>
          <span className="grey" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{c.students} students · {c.tasks} tasks · avg {c.average ?? "–"}</span></Link>)}</div>
      </Widget>
      <Widget title="Groups" icon="grid" labelledBy="w-grp">
        <div className="metric">{d.ungrouped}<small>without a group</small></div>
        <p className="grey" style={{ margin: 0 }}>{d.ungrouped ? "Open a course's Groups tab to auto-build balanced groups from student strengths." : "Every enrolled student is in a group."}</p>
      </Widget>

      {d.recent.length > 0 && <Widget title="Recent submissions" icon="inbox" labelledBy="w-recent" w="w12">
        <div className="wlist">{d.recent.map((r, i) => <Link key={i} to={`/projects/${r.project}`}>
          <span className="t"><b style={{ fontWeight: 500 }}>{r.student}</b> <span className="grey">· {r.name} · {r.course}</span></span>
          <span className="row" style={{ gap: 12 }}><span className="row" style={{ gap: 6 }}><i className="dot" style={{ background: dot(r.score) }} />{r.score}</span>
            <span className="grey" style={{ fontSize: 12 }}>{new Date(r.created).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span></span></Link>)}</div>
      </Widget>}
    </div>}
  </>);
}
