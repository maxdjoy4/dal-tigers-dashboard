# Dal Tigers Hockey Analytics Dashboard

A polished hockey analytics dashboard built with Next.js, TypeScript, Tailwind CSS, Recharts, SheetJS, and Supabase.

## What this app does

- Shows a premium black/gold/white public dashboard for Dalhousie Tigers women's hockey staff
- Calculates a live Team Performance Score out of 100 using weighted KPI logic
- Stores uploaded games permanently in Supabase so the dashboard updates automatically
- Lets admins preview, validate, and save CSV or Excel game files
- Lets admins edit KPI weights, categories, and scoring direction
- Supports filters for season, last 5 games, opponent, home/away, and win/loss

## Pages included

- `/` Dashboard
- `/game-analyzer`
- `/kpi-scores`
- `/trends-history`
- `/team-comparison`
- `/reports`
- `/admin/upload`
- `/admin/kpi-weights`
- `/login`

## Local sample data

Two bundled sample files are included so the UI works immediately in demo mode:

- [sample-games.csv](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/src/data/sample-games.csv)
- [metrics-config.csv](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/src/data/metrics-config.csv)

If Supabase is not configured yet, the public pages render from those files and the admin pages stay available for previewing the workflow.

## Supabase setup

1. Create a new Supabase project.
2. In the SQL editor, run [0001_initial.sql](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/supabase/migrations/0001_initial.sql).
3. Create at least one admin user in Supabase Auth.
4. Insert a row into `public.profiles` for that user with `is_admin = true`.
5. Seed the `kpi_weights` table.

The easiest seed path is:

1. Open the `metrics-config.csv` file.
2. Import it into `public.kpi_weights`.
3. Map columns as follows:
   - `metric_id` -> `kpi_key`
   - `metric_name` -> `name`
   - Convert category values to `offense`, `defense`, or `special_teams`
   - `weight_pct` -> `weight`
   - `r_win` -> `r_value`
   - `higher_is_better` -> `direction`
   - `dal_dashboard_notes` -> `notes`
4. Set `include_in_score = true` and fill `display_order`.

You can also use the sample upload file to bulk-load historical games once through the Admin Upload page.

## Environment variables

Copy [.env.example](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/.env.example) to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notes:

- `NEXT_PUBLIC_*` values are used by the browser login flow.
- `SUPABASE_SERVICE_ROLE_KEY` is only used server-side for uploads and weight updates.
- Never expose the service role key in client code.

## Install and run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Upload workflow

1. Admin signs in at `/login`.
2. Admin opens `/admin/upload`.
3. Admin uploads one game file.
4. The app previews rows and validates required columns.
5. Admin clicks Save Game.
6. The file metadata, games, and game stats are written to Supabase.
7. The public dashboard updates from the stored database rows.

## Vercel deployment

1. Push the project to GitHub.
2. Import the repo into Vercel.
3. Add the same environment variables from `.env.local`.
4. Deploy.
5. Set `NEXT_PUBLIC_SITE_URL` to your production URL.

Because the app uses Next.js server routes and Supabase, Vercel works well out of the box.

## Tech choices

- Next.js App Router for the site and server routes
- TypeScript for typed scoring, upload parsing, and Supabase operations
- Tailwind CSS for the premium dashboard styling
- Recharts for interactive line and bar charts
- SheetJS/xlsx for Excel upload parsing
- Supabase Auth, Postgres, and Storage for persistence

## Project structure

- [src/app](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/src/app)
- [src/components](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/src/components)
- [src/lib](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/src/lib)
- [src/data](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/src/data)
- [supabase/migrations](/C:/Users/maxdj/Documents/Codex/2026-04-25/build-a-polished-web-based-hockey/supabase/migrations)
