# E-Football Group Cup

Live React tournament manager with randomized groups, live standings, a six-team qualification championship, a gated final and protected admin controls.

## Tournament flow

1. Admin adds any number of teams with a team name and logo URL.
2. The app creates securely randomized, balanced groups of up to four teams. Groups can be regenerated while every score field is empty.
3. Group scores and rankings keep using the existing 3/1/0 points and tie-break rules.
4. When the completed draw is exactly Group A and Group B with at least three teams each, the top three from each group qualify automatically.
5. The six qualifiers play one round robin: every pair meets once, for 15 matches and five matches per team. These standings use only those 15 results and allow draws.
6. The top four continue through Semifinal 1 (#1 vs #2), the Spot Semifinal (#3 vs #4), Semifinal 2, and the Grand Final. Drawn playoff matches require a penalty winner.
7. The champion is archived automatically after the verified Grand Final. Existing legacy brackets and tournament data remain supported.

## Routes

- `/` Home
- `/rankings` Live ranking
- `/teams` Registered teams
- `/groups` Group stage
- `/roadmap` Animated live tournament roadmap
- `/matches` Group fixtures and results
- `/knockout` Knockout stage and final
- `/history` Champion history
- `/admin` Protected tournament control room

## Supabase

The existing Supabase database, realtime, authentication, RLS and team-image storage backend are retained. Run `supabase/schema.sql`, create an Auth user, and register that user in `tournament_admins`. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

```bash
npm install
npm run dev
npm test
npm run build
```
