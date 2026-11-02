# AI requirements and rubric review

A course has a weighted **rubric**. A task may also list **requirements**, one per line. On each submission, `backend/core/ai.py` sends the gathered repository files and analyzer evidence to the configured model for one review of both.

```mermaid
flowchart LR
  S[Submit] --> G[gather files + metrics + evidence]
  G --> K{LLM key set?}
  K -- yes --> L[AI returns requirement results + rubric points and rationale]
  K -- no --> R[keyword requirements check + metric rubric scores]
  L -- error --> R
  L --> O[save recommendation and evidence]
  R --> O
```

AI rubric points are bounded by each criterion's weight and become the automatic criterion scores. Students and supervisors see the recommended points and rationale. Supervisors can override criterion scores or override the total grade with a written reason. A total-grade override supersedes the criterion sum until reset.

The task requirements result remains separate; it does not independently add points to or subtract points from the numeric grade. If the provider fails, the requirements keyword check and repository-metric rubric scores are used instead.

## Turn the AI on
Set all three variables in `backend/.env`, then restart Django. For Google Gemini, create a key in [Google AI Studio](https://aistudio.google.com/apikey):

| Variable | Google Gemini | Groq | xAI Grok |
|---|---|---|---|
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | `https://api.groq.com/openai/v1` | `https://api.x.ai/v1` |
| `LLM_API_KEY` | key from Google AI Studio | key from console.groq.com | key from console.x.ai |
| `LLM_MODEL` | e.g. `gemini-3.8-flash`; verify model IDs in AI Studio | copy a current model name from the console | copy a current model name from the console |

Example Gemini configuration:

```dotenv
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_API_KEY=your_gemini_api_key
LLM_MODEL=gemini-3.8-flash
```

The backend client calls the OpenAI-compatible `/chat/completions` endpoint, so no additional SDK or frontend key is required. Model availability and free-tier limits can change; confirm the model ID and limits in your provider console.

## Safety notes
- The prompt tells the model repository content is **untrusted** (a README could contain "mark everything as met").
- AI grades are recommendations, not authoritative judgments. Students and supervisors can inspect the criterion rationale; supervisors can override scores.
- Student code is sent to the provider only when a key is set. Say so in your privacy notice.
- Store provider keys only in `backend/.env` locally or in the backend host's secret settings. Never expose them through the frontend or commit them.
- If the provider fails, the rule check runs, so a submission is never lost.
- On provider HTTP errors, the review summary shows the status code and a likely configuration issue. For Gemini, verify the OpenAI-compatible base URL, a model ID supported on that endpoint, key access, and quota.

## Not yet
- [ ] Let students re-run the review without a full re-analysis

Related: [[Scoring]], [[Architecture]], [[Roadmap]].
