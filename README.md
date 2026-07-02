# AI Brain

Enterprise-grade AI-powered knowledge platform. Type naturally — AI handles organization, reminders, search, and more.

## Quick Start

See [docs/SETUP.md](docs/SETUP.md) for full setup instructions.

```bash
pnpm install
cp .env.example .env   # Add your Supabase + OpenAI keys
pnpm build
pnpm dev
```

## Stack

- **Frontend**: React, Vite, Tailwind, shadcn/ui → Vercel
- **Backend**: Supabase (PostgreSQL, Auth, RLS, pgvector, Realtime)
- **AI**: OpenAI / Groq (pluggable provider abstraction)
- **Jobs**: Background worker → Vercel cron

## Architecture

Event-driven modular monorepo. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
