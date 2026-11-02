const TOKEN_KEY = 'sld_token';
const USER_KEY = 'sld_user';
const TENANT_KEY = 'sld_tenant_id';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string | null;
  tenantName?: string;
  tenantSlug?: string | null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getActiveTenantId(): string | null {
  return localStorage.getItem(TENANT_KEY);
}

export function setActiveTenantId(id: string | null): void {
  if (id) localStorage.setItem(TENANT_KEY, id);
  else localStorage.removeItem(TENANT_KEY);
}

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  instagramHandle?: string | null;
  twitterHandle?: string | null;
  isActive?: boolean;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const tenantId = getActiveTenantId();
  if (tenantId) headers.set('x-tenant-id', tenantId);

  const res = await fetch(`/api${path}`, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  return data;
}

export function fetchMe() {
  return request<{ user: SessionUser }>('/auth/me');
}

export function fetchTenants() {
  return request<TenantOption[]>('/tenants');
}

export function createTenant(
  name: string,
  slug: string,
  instagram: string,
  twitter?: string,
) {
  return request<TenantOption>('/tenants', {
    method: 'POST',
    body: JSON.stringify({ name, slug, instagram, twitter: twitter || undefined }),
  });
}

export function patchTenant(
  id: string,
  body: { isActive?: boolean; instagram?: string; twitter?: string | null },
) {
  return request<TenantOption>(`/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface SystemUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  tenantId: string | null;
  tenantName: string | null;
}

export function fetchUsers() {
  return request<SystemUser[]>('/users');
}

export function createUser(body: {
  fullName: string;
  email: string;
  password: string;
  role: string;
  tenantId?: string | null;
}) {
  return request<SystemUser>('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function patchUser(id: string, body: { isActive: boolean }) {
  return request<SystemUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function login(email: string, password: string) {
  return request<{ token: string; user: SessionUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export interface Summary {
  total: number;
  posts: number;
  byCategory: { category: string; count: number }[];
  bySentiment: { sentiment: string; count: number }[];
}

export function fetchSummary() {
  return request<Summary>('/analytics/summary');
}

export interface CompareAccount {
  id: string;
  name: string;
  instagramHandle: string | null;
  twitterHandle?: string | null;
}

export interface CompareRow {
  category: string;
  counts: Record<string, number>;
}

export interface CompareResult {
  accounts: CompareAccount[];
  categories: CompareRow[];
}

export function fetchCompare(ids: string[], network?: 'instagram' | 'twitter') {
  const query = new URLSearchParams({ ids: ids.join(',') });
  if (network) query.set('network', network);
  return request<CompareResult>(`/analytics/compare?${query.toString()}`);
}

export interface CompareComment {
  id: string;
  text: string;
  emojis: string[];
  sentiment: string;
  isAnonymized: boolean;
  publishedAt: string | null;
  post: {
    caption: string | null;
    url: string | null;
    ownerUsername: string | null;
  };
}

export function fetchCompareComments(
  tenantId: string,
  category: string,
  network?: 'instagram' | 'twitter',
) {
  const query = new URLSearchParams({ tenantId, category });
  if (network) query.set('network', network);
  return request<{
    account: CompareAccount;
    category: string;
    items: CompareComment[];
  }>(`/analytics/compare/comments?${query.toString()}`);
}

export interface CommentRow {
  id: string;
  cleanText: string;
  category: string;
  sentiment: string;
  isAnonymized: boolean;
  emojis: string[];
  likeCount: number | null;
  publishedAt: string | null;
  post: {
    caption: string | null;
    url: string | null;
    ownerUsername: string | null;
  };
}

export function fetchComments() {
  return request<{ page: number; pageSize: number; total: number; items: CommentRow[] }>(
    '/analytics/comments?pageSize=50',
  );
}

export interface PostComment {
  id: string;
  rawText?: string | null;
  cleanText: string;
  category: string;
  sentiment: string;
  isAnonymized: boolean;
  emojis: string[];
  likeCount: number | null;
  publishedAt: string | null;
}

export interface PostRow {
  id: string;
  network?: string;
  caption: string | null;
  url: string | null;
  ownerUsername: string | null;
  publishedAt: string | null;
  category?: string;
  sentiment?: string;
  comments: PostComment[];
}

export function fetchPosts() {
  return request<{ items: PostRow[] }>('/analytics/posts');
}

export interface WatchlistRow {
  id: string;
  username: string;
  network?: string;
  reason: string;
  status: string;
  lastSeenAt: string;
  commentCount: number;
  lastActiveAt: string;
}

export function fetchWatchlist() {
  return request<WatchlistRow[]>('/watchlist');
}

export function patchWatchlist(id: string, status: string) {
  return request<WatchlistRow>(`/watchlist/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export interface ScrapeTargets {
  accounts: string[];
  instagram: string | null;
  twitter: string | null;
  apifyConfigured: boolean;
}

export function fetchScrapeTargets() {
  return request<ScrapeTargets>('/scrape/targets');
}

export interface ScrapeRunResult {
  accounts: string[];
  resultsPerAccount: number;
  posts: number;
  comments: number;
  duplicated: boolean;
}

export interface ScrapeProgress {
  id: string;
  status: 'running' | 'done' | 'error';
  steps: { text: string }[];
  result?: ScrapeRunResult;
  error?: string;
}

export function startScrape(resultsPerAccount: number, network: 'instagram' | 'twitter') {
  return request<{ id: string }>('/scrape/run', {
    method: 'POST',
    body: JSON.stringify({ resultsPerAccount, network }),
  });
}

export function fetchScrapeRun(id: string) {
  return request<ScrapeProgress>(`/scrape/runs/${id}`);
}
