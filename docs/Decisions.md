# Decisions

## Django owns auth, Supabase is the database
Simpler than rewriting login. Moving to Supabase Auth later means replacing the user model and writing RLS policies per table.

## One URL
Django serves the built React app (WhiteNoise + a catch-all route). No CORS, no second server, nothing stale on another port. Cost: run `npm run build` after UI changes. {#one-url}

## Overrides keep the automatic score
Both numbers are stored; the reason is mandatory. Trust comes from the audit trail.

## Black and white UI
Colour only as 8px status dots. Radii: 4px chips, 6px controls, 8px panels. Depth from 1px borders.

## Synchronous analysis
Fine for a first version; see [[Roadmap]] for the background-job upgrade.

Back to [[index]].
