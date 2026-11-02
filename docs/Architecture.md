# Architecture

```mermaid
flowchart TB
  U[Browser] -->|one URL :8000| D[Django]
  D -->|/ and assets| R[React build - frontend/dist]
  D -->|/api/*| V[DRF views]
  V --> A[analyzer.py]
  A -->|REST| G[GitHub API]
  V -->|SQL via pooler| S[(Supabase Postgres)]
  D -->|/admin/| ADM[Django admin]
```

## Request: student submits a repo
```mermaid
sequenceDiagram
  participant B as Browser
  participant API as Django /api
  participant GH as GitHub
  participant DB as Supabase
  B->>API: POST /projects/5/submit (JWT)
  API->>GH: commits + file tree
  GH-->>API: JSON
  API->>API: compute metrics, evidence, stats
  opt AI provider configured
    API->>API: request requirements review + rubric point recommendations
  end
  API->>DB: Submission + CriterionScore rows
  API-->>B: evaluation JSON
```

## Folders
| Path | What |
|---|---|
| `backend/core/models.py` | tables - see [[Data-Model]] |
| `backend/core/analyzer.py` | GitHub -> metrics - see [[Scoring]] |
| `backend/core/views.py` | every endpoint |
| `frontend/src/pages` | screens |
| `supabase/schema.sql` | security rules - see [[Supabase-Security]] |

Auth: JWT from `/api/auth/login`, stored in `localStorage`, sent as `Authorization: Bearer`.
