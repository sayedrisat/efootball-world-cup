# E-Football Tournament Hub

React tournament manager with a public live league, protected admin control panel, and the previous six-player E-Football World Cup.

## Features

- Unlimited league teams with team name and image input
- Automatic home-away fixture generation for every team pair
- Public live league at `#/` and admin controls at `#/admin`
- Supabase realtime database, authentication, RLS, and team image storage
- LocalStorage preview fallback when Supabase is not configured
- Live league table with P, H, A, W, D, L, GF, GA, +Goal and points
- Champion decided by the #1 league table rank after every match is complete
- Route-based pages for Live League, Rules, Admin, and the original 6 Player Cup
- Preserved six-player World Cup system with groups, knockouts, penalties, stars and output banners

## Supabase setup

1. Create a Supabase project and an admin user in Authentication > Users.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Run the final admin membership query from that file with the admin email.
4. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` for local development.
5. Add the same names as GitHub Actions repository secrets for GitHub Pages.

Never put a Supabase service-role key or an account password in frontend environment variables.

## Scripts

```bash
npm install
npm run dev
npm run build
```
