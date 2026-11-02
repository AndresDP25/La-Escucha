import { randomUUID } from 'node:crypto';

export interface ScrapeStep {
  text: string;
}

export interface ScrapeRunResult {
  network: 'instagram' | 'twitter';
  accounts: string[];
  resultsPerAccount: number;
  posts: number;
  comments: number;
  duplicated: boolean;
}

interface ScrapeRun {
  id: string;
  tenantId: string;
  status: 'running' | 'done' | 'error';
  steps: ScrapeStep[];
  result?: ScrapeRunResult;
  error?: string;
  createdAt: number;
}

const runs = new Map<string, ScrapeRun>();
const MAX_AGE_MS = 30 * 60 * 1000;

function forgetOldRuns(): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [id, run] of runs) {
    if (run.createdAt < cutoff) runs.delete(id);
  }
}

export function createScrapeRun(tenantId: string): string {
  forgetOldRuns();
  const id = randomUUID();
  runs.set(id, {
    id,
    tenantId,
    status: 'running',
    steps: [],
    createdAt: Date.now(),
  });
  return id;
}

export function pushScrapeStep(id: string, text: string): void {
  const run = runs.get(id);
  if (!run || run.status !== 'running') return;
  run.steps.push({ text });
}

export function finishScrapeRun(id: string, result: ScrapeRunResult): void {
  const run = runs.get(id);
  if (!run) return;
  run.status = 'done';
  run.result = result;
}

export function failScrapeRun(id: string, error: string): void {
  const run = runs.get(id);
  if (!run) return;
  run.status = 'error';
  run.error = error;
}

export function readScrapeRun(id: string, tenantId: string): Omit<ScrapeRun, 'tenantId' | 'createdAt'> | null {
  const run = runs.get(id);
  if (!run || run.tenantId !== tenantId) return null;
  return {
    id: run.id,
    status: run.status,
    steps: run.steps.map((step) => ({ text: step.text })),
    result: run.result,
    error: run.error,
  };
}
