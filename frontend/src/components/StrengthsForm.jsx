// ANCHOR: StrengthsForm.jsx - renders the server's versioned developer-strength questions (onboarding + Settings).
// * Questions come from GET /api/onboarding so the UI and the server validate the same contract.
export default function StrengthsForm({ questions, answers, onChange, errors = {} }) {
  const set = (id, v) => onChange({ ...answers, [id]: v });
  return questions.map((q) => {
    const err = errors[q.id];
    const errId = `${q.id}-error`;
    if (q.type === "text") return (
      <div className="q" key={q.id}>
        <label htmlFor={`q-${q.id}`} style={{ marginTop: 0 }}>{q.label}</label>
        {q.help && <div className="help" style={{ marginTop: 0, marginBottom: 6 }}>{q.help}</div>}
        <textarea id={`q-${q.id}`} maxLength={q.max_length} value={answers[q.id] || ""} aria-invalid={!!err} aria-describedby={err ? errId : undefined}
          onChange={(e) => set(q.id, e.target.value)} />
        <div className="help">{(answers[q.id] || "").length}/{q.max_length}</div>
        {err && <div className="field-error" id={errId}>{err}</div>}
      </div>);
    const multi = q.type === "multi";
    const value = multi ? (answers[q.id] || []) : answers[q.id];
    const toggle = (id) => {
      if (!multi) return set(q.id, id);
      set(q.id, value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    };
    return (
      <fieldset className="q" key={q.id} aria-describedby={err ? errId : undefined}>
        <legend>{q.label}{q.required && <span className="sr-only"> (required)</span>}</legend>
        {(q.help || multi) && <div className="help" style={{ marginTop: 0, marginBottom: 10 }}>{q.help}{multi && ` ${value.length}/${q.max} selected.`}</div>}
        <div className="chips" role={multi ? "group" : "radiogroup"} aria-label={q.label}>
          {q.options.map((o) => {
            const on = multi ? value.includes(o.id) : value === o.id;
            const full = multi && !on && value.length >= q.max;
            return <button type="button" key={o.id} className="chip" disabled={full}
              {...(multi ? { "aria-pressed": on } : { role: "radio", "aria-checked": on })}
              onClick={() => toggle(o.id)}>{on && multi && value.length > 1 && <b>{value.indexOf(o.id) + 1}</b>}{o.label}</button>;
          })}
        </div>
        {err && <div className="field-error" id={errId}>{err}</div>}
      </fieldset>);
  });
}

// * Client mirror of the server rules, for instant feedback. The server remains authoritative.
export function checkStrengths(questions, answers) {
  const errors = {};
  for (const q of questions) {
    const v = answers[q.id];
    if (q.type === "multi" && q.required && !(v || []).length) errors[q.id] = "Pick at least one.";
    if (q.type === "single" && q.required && !v) errors[q.id] = "Choose one option.";
  }
  return errors;
}
