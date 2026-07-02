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
    const { text, workspaceId } = req.body as { text?: string; workspaceId?: string };
    if (!text?.trim()) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const memory = await container.memory.capture({
      text: text.trim(),
      userId: req.userId!,
      workspaceId,
      visibility: workspaceId ? 'shared' : 'private',
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

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`[api] AI Brain API running on http://localhost:${port}`);
  });
}

export default app;

// Vercel serverless export
export { app };
