# AI Brain — Architecture

## Overview

AI Brain is an event-driven, modular SaaS platform. Every feature is an isolated module that communicates exclusively through the event bus.

## Monorepo Structure

```
ai-brain/
├── apps/
│   ├── web/          # React + Vite frontend (Vercel)
│   ├── api/          # Express API server (Vercel / local dev)
│   └── worker/       # Background job processor (Vercel cron + local)
├── packages/
│   ├── core/         # All business logic modules
│   └── database/     # Supabase client + generated types
└── supabase/
    ├── migrations/   # PostgreSQL schema + RLS
    └── functions/    # Edge functions (optional)
```

## Module Architecture

Each module in `packages/core/src/modules/` contains:

- `types.ts` — Domain types
- `repositories/` — Data access (Repository Pattern)
- `services/` — Business logic (Service Layer)
- `index.ts` — Public API

Modules never import business logic from other modules. They communicate via events.

## Event Flow

```
User types naturally
       ↓
MemoryService.capture()
       ↓
IntentClassifier (AI)
       ↓
Memory Created → Event Bus
       ↓
┌──────────────────────────────────────┐
│ Subscribers (via background jobs):     │
│  • EmbeddingService                  │
│  • MetadataService                   │
│  • DuplicateDetectionService         │
│  • RelationshipService               │
│  • ReminderService (if reminder)     │
│  • TaskService (if task)             │
│  • DecisionService (if decision)     │
│  • ApprovalService (if approval)     │
└──────────────────────────────────────┘
```

## AI Provider Abstraction

```typescript
interface AIProvider {
  chat(options): Promise<ChatCompletionResult>;
}

interface EmbeddingProvider {
  embed(options): Promise<EmbeddingResult>;
}
```

Supported: OpenAI, Groq. Future: Claude, Gemini, local models.

## Security

- Row Level Security on all tables
- Private memories isolated per user
- Shared workspace permissions enforced
- Service role key only on server/worker

## Deployment

| Component | Platform |
|-----------|----------|
| Frontend  | Vercel   |
| API       | Vercel   |
| Worker    | Vercel (cron) |
| Database  | Supabase |
| Auth      | Supabase |
| Storage   | Supabase |

## Adding a New Module

1. Create `packages/core/src/modules/your-module/`
2. Implement service with `ServiceContext` dependency injection
3. Subscribe to relevant events OR enqueue jobs from existing flows
4. Add database migration if needed
5. Add frontend module in `apps/web/src/modules/`
6. No changes to existing modules required
