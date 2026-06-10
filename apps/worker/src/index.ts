import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { handleAnalyze } from './routes/analyze';
import { handleStructure } from './routes/structure';
import { handleFlow } from './routes/flow';
import { handleReport } from './routes/report';
import { initCacheTable } from './db/cache';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*' }));

app.get('/api/health', (c) => c.json({ status: 'ok', ts: Date.now() }));
app.get('/api/analyze', handleAnalyze);
app.post('/api/analyze', handleAnalyze);
app.get('/api/structure', handleStructure);
app.get('/api/flow', handleFlow);
app.get('/api/report', handleReport);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize DB on first request
    try { await initCacheTable(env.DB); } catch {}
    return app.fetch(request, env, ctx);
  },
};
