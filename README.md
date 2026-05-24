# AI Resource Project

AI Resource Project is a lightweight AI news aggregation and scheduled email delivery app.

The MVP focuses on stable collection and delivery, not AI summarization. It is intended to collect user-configured AI-related sources, deduplicate new items, show them in a simple web dashboard, and send scheduled email digests.

## MVP Scope

- Manage AI-related information sources.
- Fetch RSS/API-based sources on a schedule.
- Store fetched articles in Supabase Postgres.
- Deduplicate articles by URL/hash.
- View collected articles in a web dashboard.
- Send scheduled email digests.
- Track crawl and delivery logs for troubleshooting.

## Out of Scope for MVP

- AI summarization or classification.
- Vector search.
- Personalized recommendation ranking.
- Complex anti-bot web scraping.
- Multi-channel delivery beyond email.

## Planned Stack

- **App framework:** Next.js with TypeScript
- **UI:** Tailwind CSS and shadcn/ui
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth
- **Deployment:** Vercel
- **Scheduling:** Vercel Cron Jobs
- **Email delivery:** to be selected, likely Resend/Postmark/SendGrid
- **Source ingestion:** RSS first, public APIs where useful

## Core Data Model

- `sources`: configured information sources
- `articles`: fetched article records
- `crawl_runs`: scheduled/manual crawl execution logs
- `push_channels`: email delivery configuration
- `push_rules`: scheduled digest rules
- `push_logs`: delivery attempts and results

## MVP Workflow

```text
Vercel Cron
  -> Next.js cron route
  -> Fetch enabled sources
  -> Deduplicate articles
  -> Store results in Supabase

Vercel Cron
  -> Next.js email digest route
  -> Query undelivered articles
  -> Send email digest
  -> Record delivery log
```

## Environment

Secrets should never be committed to Git.

Use local `.env.local` for development and Vercel Environment Variables for production.

Copy `.env.example` to `.env.local` during local development and fill values locally only.

Never commit real API keys, database passwords, service role keys, tokens, webhook URLs, or provider secrets.

## Initial Product Decisions

- First delivery channel: email.
- First source type: RSS.
- First deployment target: Vercel.
- First database target: a dedicated Supabase project.

## CI/CD

- GitHub Actions runs lint and production build on pushes and pull requests targeting `main`.
- Vercel is connected to the GitHub repository and deploys the `main` branch automatically.
- The project uses `pnpm` and Node.js `22.x` for local, CI, and Vercel builds.
