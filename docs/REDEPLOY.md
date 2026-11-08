# Bringing the live demo back

## Why the link broke

The backend ran on Render's free tier with a **free Render Postgres** database
(`infrastructure/render.tf`). Free Render Postgres databases expire 30 days after
creation and are deleted 14 days after that. The database was created in March 2026,
so by late April it was gone. The API's start command runs `alembic upgrade head`
first, which can't connect, so the web service never comes up and every API call fails.

Two smaller things make it worse for a CV link:

- Free Render web services sleep after 15 minutes idle; the first request takes ~1 minute.
- The frontend required a Clerk sign-in before showing anything.

## What changed in the frontend

- **`/demo`** opens a fictional sample NDA with pre-computed clauses, risks and answers.
  It never calls the backend, so the CV link always shows a working product.
- If `VITE_CLERK_PUBLISHABLE_KEY` is missing, the app runs in demo-only mode instead of crashing.
- The dashboard explains the cold start and offers a retry instead of a bare error.

## Restoring the full app (about 20 minutes)

1. **Database: move to Neon** (free tier doesn't expire). Create a project at neon.tech
   and copy the connection string. Change the scheme and SSL parameter for asyncpg:

   ```
   postgresql+asyncpg://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?ssl=require
   ```

   (asyncpg uses `ssl=require`, not `sslmode=require`; `app/database.py` converts it for the sync engine.)

2. **Render:** in the `contract-intelligence-platform` web service, set `DATABASE_URL` to the
   string above and remove the expired Render database. Redeploy; migrations run on start.

3. **Check the other keys are still valid** in the Render environment:
   `OPENAI_API_KEY` (billing active), `PINECONE_API_KEY` (index still exists),
   `R2_*` (bucket and CORS still allow the Vercel origin), `CLERK_SECRET_KEY`.

4. **Vercel:** confirm `VITE_API_URL` points at the Render URL and
   `VITE_CLERK_PUBLISHABLE_KEY` is set, then redeploy the `redesign` branch (or merge it).

5. **Optional, avoid the cold start:** add a free uptime monitor (e.g. UptimeRobot) pinging
   `/api/v1/health` every 10 minutes. Note this uses Render's 750 free hours per month,
   enough for one service running continuously.

6. **Terraform users:** replace `render_postgres.db` in `infrastructure/render.tf` with a
   `database_url` variable so it isn't recreated on the next apply.
