/**
 * Cliente minimo de la API de Apify.
 * Arranca apify/instagram-scraper, espera el run y baja el dataset.
 * El token no sale del servidor.
 */
import { env } from '../../config/env';
import { AppError } from '../../shared/errors';

const API = 'https://api.apify.com/v2';
const ACTOR = 'apify~instagram-scraper';
/** Techo por clic, para no comerse el credito gratis. */
export const MAX_CHARGE_USD = 0.05;
const POLL_MS = 3000;
const DEADLINE_MS = 180_000;

interface ApifyRun {
  id: string;
  status: string;
  statusMessage?: string;
  defaultDatasetId?: string;
}

function token(): string {
  const value = env.APIFY_TOKEN?.trim();
  if (!value) {
    throw new AppError(
      503,
      'Falta APIFY_TOKEN en el servidor',
      'APIFY_NOT_CONFIGURED',
    );
  }
  return value;
}

export function apifyConfigured(): boolean {
  return Boolean(env.APIFY_TOKEN?.trim());
}

async function apify<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    data?: T;
  };
  if (!res.ok) {
    throw new AppError(
      502,
      body.error?.message ?? `Apify respondió ${res.status}`,
      'APIFY_ERROR',
    );
  }
  return (body.data ?? body) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Corre el scraper de posts y devuelve el array crudo del dataset. */
export async function scrapeInstagramPosts(
  urls: string[],
  resultsLimit: number,
): Promise<{ runId: string; items: unknown[] }> {
  const params = new URLSearchParams({
    maxTotalChargeUsd: String(MAX_CHARGE_USD),
  });
  let run = await apify<ApifyRun>(`/acts/${ACTOR}/runs?${params}`, {
    method: 'POST',
    body: JSON.stringify({
      directUrls: urls,
      resultsType: 'posts',
      resultsLimit,
    }),
  });

  const deadline = Date.now() + DEADLINE_MS;
  const done = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);
  while (!done.has(run.status) && Date.now() < deadline) {
    await sleep(POLL_MS);
    run = await apify<ApifyRun>(`/actor-runs/${run.id}`);
  }

  if (run.status !== 'SUCCEEDED') {
    throw new AppError(
      502,
      run.statusMessage || `La búsqueda terminó en ${run.status}`,
      'APIFY_RUN_FAILED',
    );
  }
  if (!run.defaultDatasetId) {
    return { runId: run.id, items: [] };
  }

  const items = await apify<unknown[]>(
    `/datasets/${run.defaultDatasetId}/items?clean=true`,
  );
  return { runId: run.id, items: Array.isArray(items) ? items : [] };
}
