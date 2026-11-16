// ANCHOR: Groups.jsx - course Groups tab. Supervisors: policy, auto-build from strengths, assign. Students: view / self-select.
// SEE: docs/Teaming.md
import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { SkeletonTable } from "./Skeleton.jsx";
import { Avatar, Icon, useUI } from "./ui.jsx";

export default function Groups({ courseId }) {
  const { toast, confirm } = useUI();
  const [g, setG] = useState(null);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => api(`/courses/${courseId}/groups`).then((d) => { setG(d); setPolicy({ mode: d.mode, size: d.size }); setError(""); })
    .catch((e) => setError(e.message)), [courseId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="empty" role="alert"><b>Could not load groups.</b><br />{error}<br /><br /><button className="btn" onClick={load}><Icon name="refresh" /><span>Try again</span></button></div>;
  if (!g) return <div role="status"><span className="sr-only">Loading groups...</span><SkeletonTable rows={3} columns={3} /></div>;

  async function run(key, path, opts, done) {
    setBusy(key);
    try { const d = await api(path, opts); setG(d); setPolicy({ mode: d.mode, size: d.size }); if (done) toast.success(done); }
    catch (e) { toast.error(e.message); }
    setBusy("");
  }
  async function autoBuild() {
    if (g.groups.length && !(await confirm({ title: "Rebuild all groups?", body: "Every current group and membership in this course is replaced. Students are notified of their new group.", confirm: "Rebuild groups", danger: true }))) return;
    run("auto", `/courses/${courseId}/groups/auto`, { method: "POST", body: { replace: g.groups.length > 0 } }, "Groups built from student strengths.");
  }
  const savePolicy = (e) => { e.preventDefault(); run("policy", `/courses/${courseId}/groups/settings`, { method: "PUT", body: { mode: policy.mode, size: Number(policy.size) } }, "Group settings saved."); };
  const move = (gid, user, role) => run(`m${user}`, `/groups/${gid}/members`, { method: "POST", body: { user, ...(role && { role }) } });
  const removeMember = (gid, uid) => run(`r${uid}`, `/groups/${gid}/members/${uid}`, { method: "DELETE" });
  async function removeGroup(grp) {
    if (!(await confirm({ title: `Delete ${grp.name}?`, body: `Its ${grp.members.length} member${grp.members.length === 1 ? "" : "s"} become unassigned.`, confirm: "Delete group", danger: true }))) return;
    run(`d${grp.id}`, `/groups/${grp.id}`, { method: "DELETE" }, "Group deleted.");
  }

  const mine = g.groups.find((x) => x.id === g.my_group);
  const tags = (p) => p.strengths && [...(p.strengths.areas || []).slice(0, 2), p.strengths.experience && { new: "<1 yr", some: "1–2 yrs", confident: "2+ yrs" }[p.strengths.experience]].filter(Boolean).join(" · ");

  return (<>
    {g.can_manage ? <form className="panel row wrap between" style={{ marginBottom: 20, gap: 16 }} onSubmit={savePolicy}>
      <div className="row wrap" style={{ gap: 16 }}>
        <div><div className="help" style={{ marginTop: 0, marginBottom: 6 }} id="mode-l">Who forms groups</div>
          <div className="seg" role="radiogroup" aria-labelledby="mode-l" style={{ width: 300 }}>
            {[["supervisor", "I assign"], ["self", "Students choose"]].map(([v, l]) => <button type="button" role="radio" aria-checked={policy.mode === v} key={v}
              className={policy.mode === v ? "on" : ""} onClick={() => setPolicy({ ...policy, mode: v })}>{l}</button>)}</div></div>
        <div><label htmlFor="g-size" className="help" style={{ margin: "0 0 6px", fontWeight: 400 }}>Group size</label>
          <input id="g-size" type="number" min="2" max="12" style={{ width: 90 }} value={policy.size} onChange={(e) => setPolicy({ ...policy, size: e.target.value })} /></div>
        <button className="btn" style={{ alignSelf: "flex-end" }} disabled={busy === "policy" || (policy.mode === g.mode && Number(policy.size) === g.size)}>{busy === "policy" ? "Saving..." : "Save"}</button>
      </div>
      <div className="row wrap" style={{ alignSelf: "flex-end" }}>
        <button type="button" className="btn" onClick={() => run("add", `/courses/${courseId}/groups`, { method: "POST", body: {} }, "Group added.")} disabled={!!busy}><Icon name="plus" /><span>Add group</span></button>
        <button type="button" className="btn primary" onClick={autoBuild} disabled={!!busy || g.unassigned.length + g.groups.reduce((a, x) => a + x.members.length, 0) < 2}>
          <Icon name="spark" /><span>{busy === "auto" ? "Building..." : g.groups.length ? "Rebuild from strengths" : "Auto-build from strengths"}</span></button>
      </div>
      <p className="help" style={{ width: "100%", margin: 0 }}>Auto-build mixes students' main areas and experience so each group gets a spread of skills. The most experienced member is suggested as lead.</p>
    </form> : <div className="banner">
      <span>{mine ? <>You're in <b>{mine.name}</b>.</> : "You're not in a group yet."} {g.mode === "self" ? "You can choose your group below." : "Your supervisor assigns groups for this course."}</span>
      <span className="grey">Groups of up to {g.size}</span></div>}

    {g.groups.length === 0 ? <div className="empty">{g.can_manage ? "No groups yet. Auto-build them from student strengths, or add groups and assign people yourself." : "Your supervisor hasn't created groups yet."}</div> :
      <div className="groups">{g.groups.map((grp) => {
        const full = grp.members.length >= g.size;
        return <section key={grp.id} className={`group-card ${grp.id === g.my_group ? "mine" : ""}`} aria-label={grp.name}>
          <header><b>{grp.name}</b><span className="row" style={{ gap: 6 }}><span className="badge">{grp.members.length}/{g.size}</span>
            {g.can_manage && <button className="btn icon sm" onClick={() => removeGroup(grp)} aria-label={`Delete ${grp.name}`}><Icon name="trash" /></button>}</span></header>
          {grp.members.length === 0 ? <span className="grey">No members yet.</span> :
            <ul>{grp.members.map((p) => <li key={p.id}><Avatar name={p.name} size={26} />
              <span className="grow">{p.name}{p.me && " (you)"}{p.strengths && <div className="member-tags">{tags(p)}</div>}</span>
              {p.role === "lead" && <span className="badge">Lead</span>}
              {g.can_manage && p.role !== "lead" && <button className="btn icon sm" onClick={() => move(grp.id, p.id, "lead")} disabled={!!busy} aria-label={`Make ${p.name} group lead`} title="Make lead"><Icon name="spark" /></button>}
              {(g.can_manage || (p.me && g.can_choose)) && <button className="btn icon sm" onClick={() => removeMember(grp.id, p.id)} disabled={!!busy}
                aria-label={p.me ? `Leave ${grp.name}` : `Remove ${p.name} from ${grp.name}`}><Icon name="logout" /></button>}</li>)}</ul>}
          {g.can_manage && g.unassigned.length > 0 && <select aria-label={`Add a student to ${grp.name}`} value="" onChange={(e) => e.target.value && move(grp.id, Number(e.target.value))} disabled={!!busy}>
            <option value="">Add a student…</option>{g.unassigned.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          {g.can_choose && grp.id !== g.my_group && <button className="btn sm" disabled={full || !!busy} onClick={() => run("join", `/groups/${grp.id}/members`, { method: "POST", body: {} }, `You joined ${grp.name}.`)}>
            {full ? "Full" : mine ? `Switch to ${grp.name}` : `Join ${grp.name}`}</button>}
        </section>;
      })}</div>}

    {g.unassigned.length > 0 && <><h2>Not in a group ({g.unassigned.length})</h2>
      <div className="people">{g.unassigned.map((p) => <div className="person" key={p.id}><Avatar name={p.name} size={28} />
        <div><b>{p.name}{p.me && " (you)"}</b>{p.strengths && <span>{tags(p) || "No strengths yet"}</span>}</div></div>)}</div></>}
  </>);
}
