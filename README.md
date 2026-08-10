# E-Football Group Cup

Live React tournament manager with unlimited teams, a randomized group draw, live group standings, knockout rounds, admin controls and screenshot/print-ready outputs.

## Tournament flow

1. Admin adds any number of teams with an image URL or upload.
2. Admin selects the preferred group size and creates a random balanced draw.
3. Group scores update the live ranking automatically; the top two teams in each group qualify.
4. The app creates a power-of-two knockout bracket and automatically supports byes when needed.
5. Drawn knockout matches use penalties. Winners advance through separate rounds to the final.
6. The Output route provides a clean share board that can be screenshotted, printed or saved as PDF.

## Routes

- `#/` Home
- `#/teams` Teams and draw
- `#/groups` Group stage
- `#/knockout` Knockout stage
- `#/ranking` Live ranking
- `#/output` Share/print output
- `#/admin` Protected tournament control room

## Supabase

The existing Supabase database, realtime, authentication, RLS and team-image storage backend are retained. Run `supabase/schema.sql`, create an Auth user, and register that user in `tournament_admins`. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

```bash
npm install
npm run dev
npm run build
```
