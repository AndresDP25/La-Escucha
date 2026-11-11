/**
 * Cliente minimo de la API de Apify.
 * Arranca apify/instagram-scraper, espera el run y baja el dataset.
 * El token no sale del servidor.
 */
import { AppError } from '../../shared/errors';

const API = 'https://api.apify.com/v2';
const INSTAGRAM_ACTOR = 'apify~instagram-scraper';
const TWITTER_ACTOR = 'apidojo~tweet-scraper';
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

function requireToken(value: string): string {
  const token = value.trim();
  if (!token) {
    throw new AppError(
      503,
      'Cargá tu clave de Apify en Ajustes → Perfil.',
      'APIFY_NOT_CONFIGURED',
    );
  }
  return token;
}

async function apify<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireToken(token)}`,
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

async function runActor(
  token: string,
  actor: string,
  input: unknown,
): Promise<{ runId: string; items: unknown[] }> {
  const params = new URLSearchParams({
    maxTotalChargeUsd: String(MAX_CHARGE_USD),
  });
  let run = await apify<ApifyRun>(token, `/acts/${actor}/runs?${params}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  const deadline = Date.now() + DEADLINE_MS;
  const done = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);
  while (!done.has(run.status) && Date.now() < deadline) {
    await sleep(POLL_MS);
    run = await apify<ApifyRun>(token, `/actor-runs/${run.id}`);
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
    token,
    `/datasets/${run.defaultDatasetId}/items?clean=true`,
  );
  return { runId: run.id, items: Array.isArray(items) ? items : [] };
}

/** Corre el scraper de posts y devuelve el array crudo del dataset. */
export async function scrapeInstagramPosts(
  token: string,
  urls: string[],
  resultsLimit: number,
): Promise<{ runId: string; items: unknown[] }> {
  return runActor(token, INSTAGRAM_ACTOR, {
    directUrls: urls,
    resultsType: 'posts',
    resultsLimit,
  });
}

/** Tuiteos propios y respuestas al usuario. El tope de gasto es el mismo que Instagram. */
export async function scrapeTweets(
  token: string,
  handle: string,
  resultsLimit: number,
): Promise<{ runId: string; items: unknown[] }> {
  return runActor(token, TWITTER_ACTOR, {
    searchTerms: [`from:${handle}`, `to:${handle}`],
    maxItems: resultsLimit * 2,
    sort: 'Latest',
  });
}
