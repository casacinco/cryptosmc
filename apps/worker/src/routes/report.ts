import type { Context } from 'hono';
import type { Env } from '../types';
import { handleAnalyze } from './analyze';

export async function handleReport(c: Context<{ Bindings: Env }>) {
  return handleAnalyze(c);
}
