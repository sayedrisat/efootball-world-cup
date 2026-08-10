# E-Football Group Cup

Live React tournament manager with unlimited teams, randomized groups, live standings, knockout rounds, a gated final and protected admin controls.

## Tournament flow

1. Admin adds any number of teams with a team name and logo URL.
2. The app creates securely randomized, balanced groups of up to four teams. Groups can be regenerated while every score field is empty.
3. Group scores update the live ranking automatically; the top two teams in each group qualify.
4. The knockout bracket stays locked until every group fixture is complete, then supports power-of-two rounds and byes.
5. Drawn knockout matches require a penalty winner. Winners advance through separate rounds to the final.
6. The next tournament remains locked until the final winner is confirmed and archived.

## Routes

- `/` Home
- `/rankings` Live ranking
- `/teams` Registered teams
- `/groups` Group stage
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
