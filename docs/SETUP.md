# AI Brain — Setup Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase account (free tier works)
- OpenAI API key (and optionally Groq)

## 1. Clone & Install

```bash
cd hack
pnpm install
```

## 2. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run migrations in order:
   - `supabase/migrations/20260101000000_initial_schema.sql`
   - `supabase/migrations/20260101000001_rls_policies.sql`
   - `supabase/migrations/20260101000002_seed_data.sql`
3. Enable **pgvector** extension in Database → Extensions (if not auto-enabled)
4. Configure Auth providers (Email, Google, GitHub) in Authentication → Providers
5. Copy your project URL and keys from Settings → API

## 3. Environment Variables

```bash
cp .env.example .env
```

Fill in:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:3001

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
AI_PROVIDER=openai

SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=AI Brain <your@gmail.com>

WORKER_SECRET=random-secret
CRON_SECRET=random-secret
```

## 4. Build Packages

```bash
pnpm build
```

## 5. Run Development

Terminal 1 — API:
```bash
pnpm --filter @ai-brain/api dev
```

Terminal 2 — Worker:
```bash
pnpm --filter @ai-brain/worker dev
```

Terminal 3 — Frontend:
```bash
pnpm --filter @ai-brain/web dev
```

Open http://localhost:5173

## 6. Deploy

### Frontend (Vercel)
```bash
cd apps/web
vercel
```
Set env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

### API (Vercel)
```bash
cd apps/api
vercel
```
Set all server env vars from `.env.example`

### Worker (Vercel)
```bash
cd apps/worker
vercel
```
Set env vars + `CRON_SECRET`. Cron jobs run automatically via `vercel.json`.

## Testing

```bash
pnpm test:unit
```

## Architecture

See [docs/ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.
