import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type Express } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import cors from 'cors';
import { createContainer } from '@ai-brain/core';
import { authMiddleware, type AuthenticatedRequest } from './middleware/auth.js';

const app: Express = express();
const port = process.env.PORT ?? 3001;

app.use(cors({ origin: true }));
app.use(express.json());

const container = createContainer();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-brain-api' });
});

app.post('/capture-memory', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, workspaceId, escalationId } = req.body as {
      text?: string;
      workspaceId?: string;
      escalationId?: string;
    };
    if (!text?.trim()) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const memory = await container.memory.capture({
      text: text.trim(),
      userId: req.userId!,
      workspaceId,
      visibility: workspaceId || escalationId ? 'shared' : 'private',
      escalationId,
    });

    res.json({ memory });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.post('/search', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { query, workspaceId, limit, offset } = req.body as {
      query?: string;
      workspaceId?: string;
      limit?: number;
      offset?: number;
    };
    if (!query?.trim()) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const results = await container.search.search(req.userId!, query.trim(), {
      workspaceId,
      limit,
      offset,
    });
    res.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.post('/ask', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { query, workspaceId, limit, minCombinedScore } = req.body as {
      query?: string;
      workspaceId?: string;
      limit?: number;
      minCombinedScore?: number;
    };
    if (!query?.trim()) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const result = await container.search.ask(req.userId!, query.trim(), {
      workspaceId,
      limit,
      minCombinedScore,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.get('/memories', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const memories = await container.memory.listByUser(req.userId!, limit, offset);
    res.json({ memories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.get('/tasks', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (workspaceId) {
      await container.sharedMemory.assertMember(workspaceId, req.userId!);
    }
    const tasks = await container.tasks.listForUser(req.userId!, {
      workspaceId: workspaceId ?? undefined,
    });
    res.json({ tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(err instanceof Error && message.includes('Not a member') ? 403 : 500).json({
      error: message,
    });
  }
});

app.patch('/tasks/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!taskId) {
      res.status(400).json({ error: 'Task ID is required' });
      return;
    }

    const { status } = req.body as { status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' };
    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    const task = await container.tasks.updateStatus(taskId, req.userId!, status);
    res.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(err instanceof Error && message.includes('Not authorized') ? 403 : 500).json({
      error: message,
    });
  }
});

app.get('/reminders', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as 'scheduled' | 'sent' | 'cancelled' | 'failed' | undefined;
    const reminders = await container.reminders.listForUser(req.userId!, { status });
    res.json({ reminders });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.patch('/reminders/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const reminderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!reminderId) {
      res.status(400).json({ error: 'Reminder ID is required' });
      return;
    }

    const { status, scheduledAt } = req.body as {
      status?: 'cancelled';
      scheduledAt?: string;
    };

    let reminder;
    if (status === 'cancelled') {
      reminder = await container.reminders.cancel(reminderId, req.userId!);
    } else if (scheduledAt) {
      reminder = await container.reminders.snooze(reminderId, req.userId!, scheduledAt);
    } else {
      res.status(400).json({ error: 'status or scheduledAt is required' });
      return;
    }

    res.json({ reminder });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(err instanceof Error && message.includes('Not authorized') ? 403 : 500).json({
      error: message,
    });
  }
});

app.get('/escalations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const escalations = await container.escalations.listOpenForTarget(req.userId!);
    res.json({ escalations });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.post('/escalations/:id/regenerate-draft', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const escalationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!escalationId) {
      res.status(400).json({ error: 'Escalation ID is required' });
      return;
    }

    const escalation = await container.escalations.regenerateDraft(escalationId, req.userId!);
    res.json({ escalation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const status = message.includes('not found') ? 404 : message.includes('Only the assigned') ? 403 : 500;
    res.status(status).json({ error: message });
  }
});

app.get('/escalations/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const escalationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!escalationId) {
      res.status(400).json({ error: 'Escalation ID is required' });
      return;
    }

    const escalation = await container.escalations.getById(escalationId, req.userId!);
    res.json({ escalation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(404).json({ error: message });
  }
});

app.get('/workspaces', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const memberships = await container.sharedMemory.listWorkspaces(req.userId!);
    const workspaces = memberships
      .map((m) => {
        const ws = m.shared_workspaces;
        const workspace = Array.isArray(ws) ? ws[0] : ws;
        if (!workspace) return null;
        return { ...workspace, role: m.role };
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
    res.json({ workspaces });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.post('/workspaces', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const workspace = await container.sharedMemory.createWorkspace(
      name.trim(),
      req.userId!,
      description,
    );
    res.json({ workspace });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.post('/workspaces/accept', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token?.trim()) {
      res.status(400).json({ error: 'Invitation token is required' });
      return;
    }

    const workspace = await container.sharedMemory.acceptInvitation(token.trim(), req.userId!);
    res.json({ workspace });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(400).json({ error: message });
  }
});

app.get('/workspaces/:id/memories', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const memories = await container.sharedMemory.listWorkspaceMemories(
      workspaceId,
      req.userId!,
      limit,
      offset,
    );
    res.json({ memories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(err instanceof Error && message.includes('Not a member') ? 403 : 500).json({
      error: message,
    });
  }
});

app.get('/workspaces/:id/tasks', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required' });
      return;
    }

    await container.sharedMemory.assertMember(workspaceId, req.userId!);
    const tasks = await container.tasks.listForUser(req.userId!, { workspaceId });
    res.json({ tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(err instanceof Error && message.includes('Not a member') ? 403 : 500).json({
      error: message,
    });
  }
});

app.get('/workspaces/:id/activity', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 30;
    const activity = await container.activity.listWorkspaceActivity(
      workspaceId,
      req.userId!,
      limit,
    );
    res.json({ activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(err instanceof Error && message.includes('Not a member') ? 403 : 500).json({
      error: message,
    });
  }
});

app.post('/workspaces/:id/ask', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required' });
      return;
    }

    const { query } = req.body as { query?: string };
    if (!query?.trim()) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const result = await container.workspaceAsk.ask(workspaceId, req.userId!, query.trim());
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(err instanceof Error && message.includes('Not a member') ? 403 : 500).json({
      error: message,
    });
  }
});

app.post('/workspaces/:id/invite', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, role } = req.body as { email?: string; role?: 'admin' | 'member' | 'viewer' };
    if (!email?.trim()) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const workspaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required' });
      return;
    }

    const invitation = await container.sharedMemory.inviteByEmail(
      workspaceId,
      email.trim(),
      req.userId!,
      role ?? 'member',
    );
    res.json({ invitation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.get('/graph', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { data: memories, error: memError } = await container.ctx.supabase
      .from('memories')
      .select('id, original_text, summary, intent_slug, created_at, user_id')
      .eq('user_id', req.userId!)
      .is('workspace_id', null)
      .eq('is_active', true);

    if (memError) throw memError;

    const memoryIds = (memories ?? []).map((m) => m.id);

    let relationships: any[] = [];
    if (memoryIds.length > 0) {
      const { data: rels, error: relError } = await container.ctx.supabase
        .from('memory_relationships')
        .select('source_memory_id, target_memory_id, relationship_type, confidence')
        .in('source_memory_id', memoryIds)
        .in('target_memory_id', memoryIds);

      if (relError) throw relError;
      relationships = rels ?? [];
    }

    let entities: any[] = [];
    if (memoryIds.length > 0) {
      const { data: ents, error: entError } = await container.ctx.supabase
        .from('memory_entities')
        .select('memory_id, entity_type, entity_value, normalized_value')
        .in('memory_id', memoryIds);

      if (entError) throw entError;
      entities = ents ?? [];
    }

    res.json({ memories: memories ?? [], relationships, entities });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

app.get('/workspaces/:id/graph', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const workspaceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required' });
      return;
    }

    await container.sharedMemory.assertMember(workspaceId, req.userId!);

    const { data: memories, error: memError } = await container.ctx.supabase
      .from('memories')
      .select('id, original_text, summary, intent_slug, created_at, user_id')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    if (memError) throw memError;

    const memoryIds = (memories ?? []).map((m) => m.id);

    let relationships: any[] = [];
    if (memoryIds.length > 0) {
      const { data: rels, error: relError } = await container.ctx.supabase
        .from('memory_relationships')
        .select('source_memory_id, target_memory_id, relationship_type, confidence')
        .in('source_memory_id', memoryIds)
        .in('target_memory_id', memoryIds);

      if (relError) throw relError;
      relationships = rels ?? [];
    }

    let entities: any[] = [];
    if (memoryIds.length > 0) {
      const { data: ents, error: entError } = await container.ctx.supabase
        .from('memory_entities')
        .select('memory_id, entity_type, entity_value, normalized_value')
        .in('memory_id', memoryIds);

      if (entError) throw entError;
      entities = ents ?? [];
    }

    res.json({ memories: memories ?? [], relationships, entities });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`[api] AI Brain API running on http://localhost:${port}`);
  });
}

export default app;

// Vercel serverless export
export { app };
