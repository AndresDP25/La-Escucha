import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearSession,
  createTenant,
  createUser,
  fetchMe,
  fetchUsers,
  patchTenant,
  patchUser,
  fetchPosts,
  fetchSummary,
  fetchTenants,
  fetchScrapeTargets,
  fetchWatchlist,
  getActiveTenantId,
  getToken,
  getUser,
  login,
  fetchScrapeRun,
  startScrape,
  setActiveTenantId,
  setSession,
  type PostRow,
  type SessionUser,
  type SystemUser,
  type Summary,
  type TenantOption,
  type WatchlistRow,
} from './api';
import { CATEGORY_LABEL, ROLE_LABEL, SENTIMENT_LABEL } from './labels';
import { AccountLogo } from './logos';
import { ComparePage } from './Compare';
import { Reading } from './Reading';
import { SuggestionsPanel } from './Suggestions';
import {
  IconAccounts,
  IconAt,
  IconBack,
  IconCaret,
  IconChart,
  IconChevron,
  IconComment,
  IconFeed,
  IconGear,
  IconInstagram,
  IconTwitter,
  IconLogo,
  IconLogout,
  IconUser,
} from './icons';

type Tab = 'resumen' | 'publicaciones' | 'sugerencias' | 'referencias';
type Screen = 'home' | 'settings' | 'profile' | 'accounts' | 'users' | 'compare';

function slugFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function canManageWatchlist(role: string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function themeForSlug(slug: string | null | undefined): string {
  if (slug === 'agusciarletta') return 'agusciarletta';
  if (slug === 'pro-argentina' || slug === 'pro-ciudad') return 'pro';
  return 'san-fernando';
}

function captionPreview(caption: string | null | undefined): string {
  if (!caption) return 'Sin texto';
  const oneLine = caption.replace(/\s+/g, ' ').trim();
  return oneLine.length > 140 ? `${oneLine.slice(0, 140)}…` : oneLine;
}

function profileUrl(network: string | undefined, username: string): string {
  const handle = username.replace(/^@/, '');
  return network === 'twitter'
    ? `https://x.com/${handle}`
    : `https://www.instagram.com/${handle}/`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function commentCopy(text: string, emojis: string[]): { body: string; emojiOnly: boolean } {
  const clean = text.replace(/\s+/g, ' ').trim();
  const faces = emojis.filter(Boolean).join(' ');
  if (clean && faces) return { body: `${clean} ${faces}`, emojiOnly: false };
  if (clean) return { body: clean, emojiOnly: false };
  if (faces) return { body: faces, emojiOnly: true };
  return { body: '', emojiOnly: false };
}

function sentimentPill(sentiment: string): string {
  if (sentiment === 'POSITIVE') return 'pill pos';
  if (sentiment === 'NEGATIVE') return 'pill neg';
  return 'pill neu';
}

export function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getUser());

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void fetchMe()
      .then((res) => {
        setSession(token, res.user);
        setUser(res.user);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      });
  }, []);

  if (!user) {
    return (
      <Login
        onOk={(u) => {
          setUser(u);
        }}
      />
    );
  }
  return (
    <Dashboard
      user={user}
      onLogout={() => {
        clearSession();
        setUser(null);
      }}
    />
  );
}

function Login({ onOk }: { onOk: (user: SessionUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await login(email, password);
      setSession(res.token, res.user);
      onOk(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login" data-theme="san-fernando">
      <form onSubmit={(e) => void onSubmit(e)}>
        <div className="brand">
          <IconLogo size={40} />
        </div>
        <h1>La Escucha</h1>
        <p className="hint">Monitoreo de publicaciones y comentarios.</p>
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error ? <p className="error">{error}</p> : null}
        <p>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </p>
      </form>
    </div>
  );
}

function emptyFeed(feed: 'instagram' | 'twitter'): string {
  if (feed === 'twitter') {
    return 'Esta cuenta todavía no tiene tweets. Cargá el usuario en Cuentas y apretá Buscar.';
  }
  return 'No hay publicaciones de Instagram en esta cuenta.';
}

function isTwitterUrl(url: string): boolean {
  return /(?:^|\/\/)(?:www\.)?(?:twitter|x)\.com\//i.test(url);
}

function postLinkLabel(url: string): string {
  return isTwitterUrl(url) ? 'Ver en Twitter' : 'Ver en Instagram';
}

function SearchBar({
  tenantId,
  network,
  onDone,
}: {
  tenantId: string;
  network: 'instagram' | 'twitter';
  onDone: () => void;
}) {
  const [handles, setHandles] = useState<{ instagram: string | null; twitter: string | null }>({
    instagram: null,
    twitter: null,
  });
  const [configured, setConfigured] = useState(true);
  const [limit, setLimit] = useState(5);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNote('');
    void fetchScrapeTargets()
      .then((res) => {
        if (cancelled) return;
        setHandles({ instagram: res.instagram, twitter: res.twitter });
        setConfigured(res.apifyConfigured);
      })
      .catch(() => {
        if (!cancelled) setHandles({ instagram: null, twitter: null });
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, []);

  const handle = network === 'twitter' ? handles.twitter : handles.instagram;

  async function onSearch() {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    setBusy(true);
    setNote('');
    setSteps([]);
    try {
      const { id } = await startScrape(limit, network);
      pollRef.current = window.setInterval(() => {
        void fetchScrapeRun(id)
          .then((run) => {
            setSteps(run.steps.map((step) => step.text));
            if (run.status === 'running') return;
            if (pollRef.current !== null) window.clearInterval(pollRef.current);
            pollRef.current = null;
            setBusy(false);
            if (run.status === 'error') {
              setNote(run.error ?? 'No se pudo buscar');
              return;
            }
            onDone();
          })
          .catch((err: unknown) => {
            if (pollRef.current !== null) window.clearInterval(pollRef.current);
            pollRef.current = null;
            setBusy(false);
            setNote(err instanceof Error ? err.message : 'No se pudo buscar');
          });
      }, 400);
    } catch (err) {
      setBusy(false);
      setNote(err instanceof Error ? err.message : 'No se pudo buscar');
    }
  }

  const hint = !configured
    ? 'Falta APIFY_TOKEN en el servidor.'
    : !handle
      ? network === 'twitter'
        ? 'Esta cuenta no tiene un usuario de Twitter. Cargalo en Ajustes → Cuentas.'
        : 'Esta cuenta no tiene un perfil de Instagram cargado.'
      : '';
  const message = [hint, note].filter(Boolean).join(' ');

  return (
    <div className="search-bar">
      <label>
        Resultados por cuenta
        <input
          type="number"
          min={1}
          max={20}
          value={limit}
          disabled={busy}
          onChange={(e) => setLimit(Number(e.target.value) || 1)}
        />
      </label>
      <button
        type="button"
        className="btn"
        disabled={busy || !configured || !handle}
        onClick={() => void onSearch()}
      >
        {busy ? 'Buscando…' : 'Buscar'}
      </button>
      {message ? <p className="search-note">{message}</p> : null}
      {steps.length > 0 ? (
        <ol className="search-timeline">
          {steps.map((step, index) => {
            const current = busy && index === steps.length - 1;
            return (
              <li key={`${index}-${step}`} className={current ? 'current' : ''}>
                <span className="step-mark" aria-hidden />
                {step}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function Dashboard({
  user,
  onLogout,
}: {
  user: SessionUser;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>('resumen');
  const [feed, setFeed] = useState<'instagram' | 'twitter'>('instagram');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [activeTenantId, setActiveTenant] = useState<string>(() => {
    return getActiveTenantId() ?? user.tenantId ?? '';
  });
  const [openPosts, setOpenPosts] = useState<string[]>([]);
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const admin = canManageWatchlist(user.role);
  const canSwitchTenant = user.role === 'SUPER_ADMIN';
  const liveTenants = useMemo(
    () => tenants.filter((t) => t.isActive !== false),
    [tenants],
  );
  const activeAccount = liveTenants.find((t) => t.id === activeTenantId);
  const theme = themeForSlug(activeAccount?.slug ?? user.tenantSlug);

  useEffect(() => {
    let cancelled = false;
    void fetchTenants()
      .then((list) => {
        if (cancelled) return;
        setTenants(list);
        const live = list.filter((t) => t.isActive !== false);
        const stored = getActiveTenantId();
        const preferred =
          (stored && live.some((t) => t.id === stored) ? stored : null) ??
          (user.tenantId && live.some((t) => t.id === user.tenantId)
            ? user.tenantId
            : null) ??
          live[0]?.id ??
          '';
        if (preferred && preferred !== getActiveTenantId()) {
          setActiveTenantId(preferred);
        }
        if (preferred) setActiveTenant(preferred);
      })
      .catch(() => {
        if (!cancelled) setTenants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user.tenantId]);

  useEffect(() => {
    if (screen !== 'accounts') return;
    let cancelled = false;
    void fetchTenants()
      .then((list) => {
        if (!cancelled) setTenants(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [screen]);

  useEffect(() => {
    if (!activeTenantId && canSwitchTenant) return;
    let cancelled = false;
    async function load() {
      try {
        const [s, p, w] = await Promise.all([
          fetchSummary(),
          fetchPosts(),
          fetchWatchlist(),
        ]);
        if (cancelled) return;
        setError('');
        setSummary(s);
        setPosts(p.items);
        setWatchlist(w);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, canSwitchTenant, reloadKey]);

  const visibleWatchlist = useMemo(
    () =>
      watchlist
        .filter((row) => (row.network ?? 'instagram') === feed)
        .filter((row) => row.reason === 'COMMENT_AUTHOR'),
    [watchlist, feed],
  );
  const visiblePosts = posts.filter((post) => (post.network ?? 'instagram') === feed);

  useEffect(() => {
    if (tab !== 'publicaciones' || !focusPostId) return;
    const node = document.getElementById(`post-${focusPostId}`);
    node?.scrollIntoView({ block: 'start' });
  }, [tab, focusPostId]);

  function openInPublications(postId: string) {
    setOpenPosts((current) => (current.includes(postId) ? current : [...current, postId]));
    setFocusPostId(postId);
    setTab('publicaciones');
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-bar">
        <button
          type="button"
          className="brand-home"
          onClick={() => {
            setScreen('home');
            setTab('resumen');
          }}
        >
          <span className="mark">
            <IconLogo size={26} />
          </span>
          La Escucha
        </button>
        <div className="app-bar-right">
          {canSwitchTenant ? (
            <button
              type="button"
              className={`icon-btn app-bar-compare${screen === 'compare' ? ' active' : ''}`}
              onClick={() => setScreen('compare')}
            >
              <IconChart size={18} />
              Comparar
            </button>
          ) : null}
          {canSwitchTenant && liveTenants.length > 0 ? (
            <AccountSwitch
              tenants={liveTenants}
              activeTenantId={activeTenantId}
              onChange={(id) => {
                setActiveTenantId(id);
                setActiveTenant(id);
                setSummary(null);
                setPosts([]);
                setWatchlist([]);
                setOpenPosts([]);
              }}
            />
          ) : (
            <div className="meta">{user.tenantName ?? 'Piloto'}</div>
          )}
          <button
            type="button"
            className={`icon-btn${screen !== 'home' ? ' active' : ''}`}
            onClick={() => setScreen('settings')}
          >
            <IconGear size={18} />
            Ajustes
          </button>
          <button className="icon-btn" type="button" onClick={onLogout}>
            <IconLogout size={18} />
            Salir
          </button>
        </div>
      </header>
      <main>
        {screen === 'settings' ? (
          <SettingsHome
            canManageAccounts={canSwitchTenant}
            onOpenProfile={() => setScreen('profile')}
            onOpenAccounts={() => setScreen('accounts')}
            onOpenUsers={() => setScreen('users')}
          />
        ) : null}
        {screen === 'profile' ? (
          <ProfilePage user={user} onBack={() => setScreen('settings')} />
        ) : null}
        {screen === 'users' && canSwitchTenant ? (
          <UsersPage
            tenants={tenants}
            currentUserId={user.id}
            onBack={() => setScreen('settings')}
          />
        ) : null}
        {screen === 'accounts' ? (
          <AccountsPage
            tenants={tenants}
            activeTenantId={activeTenantId}
            onBack={() => setScreen('settings')}
            onCreated={(tenant) => {
              setTenants((list) =>
                [...list, { ...tenant, isActive: tenant.isActive ?? true }].sort(
                  (a, b) => a.name.localeCompare(b.name, 'es'),
                ),
              );
              setActiveTenantId(tenant.id);
              setActiveTenant(tenant.id);
              setSummary(null);
              setPosts([]);
              setWatchlist([]);
              setOpenPosts([]);
            }}
            onUpdated={(tenant) => {
              setTenants((list) =>
                list
                  .map((t) => (t.id === tenant.id ? tenant : t))
                  .sort((a, b) => {
                    const aOn = a.isActive !== false ? 0 : 1;
                    const bOn = b.isActive !== false ? 0 : 1;
                    if (aOn !== bOn) return aOn - bOn;
                    return a.name.localeCompare(b.name, 'es');
                  }),
              );
              if (tenant.isActive === false && tenant.id === activeTenantId) {
                const next = tenants.find(
                  (t) => t.id !== tenant.id && t.isActive !== false,
                );
                if (next) {
                  setActiveTenantId(next.id);
                  setActiveTenant(next.id);
                } else {
                  setActiveTenantId(null);
                  setActiveTenant('');
                }
                setSummary(null);
                setPosts([]);
                setWatchlist([]);
                setOpenPosts([]);
              }
            }}
          />
        ) : null}
        {screen === 'compare' && canSwitchTenant ? (
          <ComparePage tenants={liveTenants} />
        ) : null}
        {screen === 'home' ? (
          <>
        {error ? <p className="error">{error}</p> : null}
        <div className="page-head">
          <div className="page-title">
            <AccountLogo slug={activeAccount?.slug} size={52} />
            <div>
              <h2>{activeAccount?.name ?? user.tenantName ?? 'Escucha'}</h2>
            </div>
          </div>
        </div>
        <div className="net-switch" role="tablist" aria-label="Red">
          {(
            [
              ['instagram', 'Instagram'],
              ['twitter', 'Twitter'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={feed === id}
              className={feed === id ? 'on' : ''}
              onClick={() => setFeed(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {admin ? (
          <SearchBar
            tenantId={activeTenantId}
            network={feed}
            onDone={() => setReloadKey((n) => n + 1)}
          />
        ) : null}
        <div className="tabs">
          <button
            type="button"
            className={tab === 'resumen' ? 'active' : ''}
            onClick={() => setTab('resumen')}
          >
            <IconChart size={16} />
            Resumen
          </button>
          <button
            type="button"
            className={tab === 'publicaciones' ? 'active' : ''}
            onClick={() => setTab('publicaciones')}
          >
            <IconFeed size={16} />
            Publicaciones
          </button>
          <button
            type="button"
            className={tab === 'sugerencias' ? 'active' : ''}
            onClick={() => setTab('sugerencias')}
          >
            <IconComment size={16} />
            Sugerencias
          </button>
          <button
            type="button"
            className={tab === 'referencias' ? 'active' : ''}
            onClick={() => setTab('referencias')}
          >
            <IconAt size={16} />
            Activos{visibleWatchlist.length ? ` (${visibleWatchlist.length})` : ''}
          </button>
        </div>

        {tab === 'resumen' ? (
          !summary && posts.length === 0 ? (
            <p className="muted">Leyendo…</p>
          ) : (
            <Reading
              posts={visiblePosts}
              empty={emptyFeed(feed)}
              onOpenPost={openInPublications}
            />
          )
        ) : null}

        {tab === 'sugerencias' ? (
          !summary && posts.length === 0 ? (
            <p className="muted">Leyendo…</p>
          ) : (
            <SuggestionsPanel
              posts={visiblePosts}
              empty={emptyFeed(feed)}
              onOpenPost={openInPublications}
            />
          )
        ) : null}

        {tab === 'publicaciones' ? (
          <div className="post-list">
            {visiblePosts.length === 0 ? (
              <p className="muted">{emptyFeed(feed)}</p>
            ) : (
              <div className="post-toolbar">
                <span className="muted">{visiblePosts.length} publicaciones</span>
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() =>
                    setOpenPosts(
                      openPosts.length === visiblePosts.length ? [] : visiblePosts.map((p) => p.id),
                    )
                  }
                >
                  {openPosts.length === visiblePosts.length ? 'Cerrar todas' : 'Abrir todas'}
                </button>
              </div>
            )}
            {visiblePosts.map((post) => {
              const open = openPosts.includes(post.id);
              return (
                <article
                  key={post.id}
                  id={`post-${post.id}`}
                  className={`post-card${open ? ' open' : ''}${focusPostId === post.id ? ' target' : ''}`}
                >
                  <button
                    type="button"
                    className="post-toggle"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenPosts((ids) =>
                        ids.includes(post.id)
                          ? ids.filter((id) => id !== post.id)
                          : [...ids, post.id],
                      )
                    }
                  >
                    <IconChevron open={open} />
                    <span className="post-toggle-body">
                      <span className="post-meta">
                        {post.ownerUsername ? `@${post.ownerUsername}` : 'Post'}
                        {post.publishedAt ? ` · ${formatWhen(post.publishedAt)}` : ''}
                      </span>
                      {open ? null : (
                        <span className="post-preview">
                          {captionPreview(post.caption)}
                        </span>
                      )}
                    </span>
                    <span className="comment-count">
                      <IconComment size={14} />
                      {post.comments.length}
                    </span>
                  </button>
                  {open ? (
                    <div className="post-detail">
                      <p className="post-caption">
                        {post.caption || <span className="muted">Sin texto</span>}
                      </p>
                      {post.url ? (
                        <a className="ig-link" href={post.url} target="_blank" rel="noreferrer">
                          {isTwitterUrl(post.url) ? (
                            <IconTwitter size={15} />
                          ) : (
                            <IconInstagram size={15} />
                          )}
                          {postLinkLabel(post.url)}
                        </a>
                      ) : null}
                      <div className="post-comments">
                        <p className="comments-label">
                          {post.comments.length} comentario
                          {post.comments.length === 1 ? '' : 's'}
                        </p>
                        {post.comments.length === 0 ? (
                          <p className="muted">No hay comentarios en esta muestra.</p>
                        ) : (
                          post.comments.map((c) => {
                            const copy = commentCopy(c.cleanText, c.emojis);
                            return (
                              <article
                                key={c.id}
                                className={`comment-card sent-${c.sentiment.toLowerCase()}`}
                              >
                                {copy.body ? (
                                  <p
                                    className={`comment-text${copy.emojiOnly ? ' emoji-only' : ''}`}
                                  >
                                    {copy.body}
                                  </p>
                                ) : (
                                  <p className="comment-text muted">Sin texto</p>
                                )}
                                <div className="comment-meta">
                                  <span className="pill">
                                    {CATEGORY_LABEL[c.category] ?? c.category}
                                  </span>
                                  <span className={sentimentPill(c.sentiment)}>
                                    {SENTIMENT_LABEL[c.sentiment] ?? c.sentiment}
                                  </span>
                                  {c.publishedAt ? (
                                    <time className="comment-when">
                                      {formatWhen(c.publishedAt)}
                                    </time>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {tab === 'referencias' ? (
          <>
          <p className="muted tab-help">
            {feed === 'twitter'
              ? 'Cuentas que respondieron en Twitter y siguen activas. El perfil abre en la red para poder interactuar.'
              : 'Cuentas que comentaron en Instagram y siguen activas. El perfil abre en la red para poder interactuar.'}
          </p>
          <table className="active-people">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Comentarios</th>
                <th>Última vez</th>
                <th>Perfil</th>
              </tr>
            </thead>
            <tbody>
              {visibleWatchlist.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    {feed === 'twitter'
                      ? 'Todavía no hay cuentas que hayan comentado en Twitter.'
                      : 'Todavía no hay cuentas que hayan comentado en Instagram.'}
                  </td>
                </tr>
              ) : null}
              {visibleWatchlist.map((account) => (
                <tr key={account.id}>
                  <td>@{account.username}</td>
                  <td className="num">
                    {account.commentCount > 0 ? account.commentCount : '—'}
                  </td>
                  <td>{formatWhen(account.lastActiveAt ?? account.lastSeenAt)}</td>
                  <td>
                    <a
                      className="ig-link"
                      href={profileUrl(account.network ?? feed, account.username)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir perfil
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

function AccountSwitch({
  tenants,
  activeTenantId,
  onChange,
}: {
  tenants: TenantOption[];
  activeTenantId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = tenants.find((t) => t.id === activeTenantId);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.tenant-switch')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="tenant-switch">
      <span>Cuenta</span>
      <div className="account-menu">
        <button
          type="button"
          className="account-trigger"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <AccountLogo slug={current?.slug} size={22} />
          {current?.name ?? 'Elegí una cuenta'}
          <IconCaret open={open} size={14} />
        </button>
        {open ? (
          <ul className="account-list">
            {tenants.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={t.id === activeTenantId ? 'active' : ''}
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                >
                  <AccountLogo slug={t.slug} size={22} />
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function SettingsHome({
  canManageAccounts,
  onOpenProfile,
  onOpenAccounts,
  onOpenUsers,
}: {
  canManageAccounts: boolean;
  onOpenProfile: () => void;
  onOpenAccounts: () => void;
  onOpenUsers: () => void;
}) {
  return (
    <div className="settings-page">
      <h2>Configuración</h2>
      <p className="muted settings-lead">
        Perfil de quien usa el sistema y, si sos super admin, las cuentas que
        se escuchan (Instagram / municipio).
      </p>
      <h3 className="settings-kicker">Cuenta</h3>
      <div className="settings-grid">
        <button type="button" className="settings-tile" onClick={onOpenProfile}>
          <span className="settings-icon" aria-hidden>
            <IconUser size={20} />
          </span>
          <span className="settings-tile-copy">
            <strong>Perfil</strong>
            <span className="muted">Nombre, email y rol</span>
          </span>
        </button>
        {canManageAccounts ? (
          <button type="button" className="settings-tile" onClick={onOpenAccounts}>
            <span className="settings-icon" aria-hidden>
              <IconAccounts size={20} />
            </span>
            <span className="settings-tile-copy">
              <strong>Cuentas</strong>
              <span className="muted">Instagram, Twitter y alta de cuentas</span>
            </span>
          </button>
        ) : null}
        {canManageAccounts ? (
          <button type="button" className="settings-tile" onClick={onOpenUsers}>
            <span className="settings-icon" aria-hidden>
              <IconUser size={20} />
            </span>
            <span className="settings-tile-copy">
              <strong>Usuarios</strong>
              <span className="muted">Quién entra y con qué rol</span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AccountHandles({
  tenant,
  onUpdated,
}: {
  tenant: TenantOption;
  onUpdated: (tenant: TenantOption) => void;
}) {
  const [instagram, setInstagram] = useState(tenant.instagramHandle ?? '');
  const [twitter, setTwitter] = useState(tenant.twitterHandle ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setInstagram(tenant.instagramHandle ?? '');
    setTwitter(tenant.twitterHandle ?? '');
  }, [tenant.instagramHandle, tenant.twitterHandle]);

  async function save() {
    const nextIg = instagram.trim();
    const nextTw = twitter.trim();
    if (!nextIg) {
      setError('Instagram es obligatorio.');
      return;
    }
    if (nextIg === (tenant.instagramHandle ?? '') && nextTw === (tenant.twitterHandle ?? '')) return;
    setBusy(true);
    setError('');
    try {
      const updated = await patchTenant(tenant.id, {
        instagram: nextIg,
        twitter: nextTw || null,
      });
      onUpdated(updated);
      setInstagram(updated.instagramHandle ?? '');
      setTwitter(updated.twitterHandle ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="handle-fields">
      <label>
        Instagram
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="proargentina"
          aria-label={`Instagram de ${tenant.name}`}
        />
      </label>
      <label>
        Twitter
        <span className="handle-row">
          <input
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="proargentina"
            aria-label={`Twitter de ${tenant.name}`}
          />
          <button type="button" className="btn small secondary" disabled={busy} onClick={() => void save()}>
            {busy ? '…' : 'Guardar'}
          </button>
        </span>
      </label>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}

function AccountsPage({
  tenants,
  activeTenantId,
  onBack,
  onCreated,
  onUpdated,
}: {
  tenants: TenantOption[];
  activeTenantId: string;
  onBack: () => void;
  onCreated: (tenant: TenantOption) => void;
  onUpdated: (tenant: TenantOption) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugFromName(value));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const created = await createTenant(
        name.trim(),
        slug.trim(),
        instagram.trim(),
        twitter.trim() || undefined,
      );
      onCreated(created);
      setName('');
      setSlug('');
      setInstagram('');
      setTwitter('');
      setSlugTouched(false);
      setOk(
        `Lista “${created.name}”. Buscar trae posts de @${created.instagramHandle}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(tenant: TenantOption) {
    const next = tenant.isActive === false;
    if (
      !next &&
      !window.confirm(
        `¿Desactivar “${tenant.name}”? No se borra nada; deja de aparecer en el selector.`,
      )
    ) {
      return;
    }
    setTogglingId(tenant.id);
    setError('');
    try {
      const updated = await patchTenant(tenant.id, { isActive: next });
      onUpdated(updated);
      setOk(next ? `Reactivada “${updated.name}”.` : `Inactiva “${updated.name}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="settings-page">
      <button type="button" className="back-btn" onClick={onBack}>
        <span className="back-icon">
          <IconBack size={18} />
        </span>
        Volver
      </button>
      <h2>Cuentas</h2>
      <p className="muted settings-lead">
        Cada cuenta tiene un Instagram y, si lo cargás, un Twitter.
        Buscar trae solo la red que estés mirando. Desactivar la saca del
        selector sin borrar lo ya cargado.
      </p>

      <form className="card account-form" onSubmit={(e) => void onSubmit(e)}>
        <h3 className="settings-kicker">Nueva cuenta</h3>
        <label htmlFor="tenant-name">Nombre</label>
        <input
          id="tenant-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ángeles Reig"
          required
        />
        <label htmlFor="tenant-slug">Identificador (slug)</label>
        <input
          id="tenant-slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          placeholder="angeles-reig"
          pattern="[a-z0-9-]+"
          minLength={2}
          required
        />
        <p className="muted field-hint">
          Solo minúsculas, números y guiones.
        </p>
        <label htmlFor="tenant-instagram">Instagram a scrapear</label>
        <input
          id="tenant-instagram"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="sanfermunicipio"
          required
        />
        <p className="muted field-hint">
          El usuario, sin @. Al elegir esta cuenta, Buscar trae sus posts.
        </p>
        <label htmlFor="tenant-twitter">Twitter (opcional)</label>
        <input
          id="tenant-twitter"
          value={twitter}
          onChange={(e) => setTwitter(e.target.value)}
          placeholder="proargentina"
        />
        <p className="muted field-hint">
          Usuario de X, sin @. Se puede cargar después en la lista.
        </p>
        {error ? <p className="error">{error}</p> : null}
        {ok ? <p className="ok-msg">{ok}</p> : null}
        <p>
          <button
            className="btn"
            type="submit"
            disabled={busy || !name.trim() || !slug.trim() || !instagram.trim()}
          >
            {busy ? 'Creando…' : 'Crear cuenta'}
          </button>
        </p>
      </form>

      <h3 className="settings-kicker">Ya cargadas</h3>
      {tenants.length === 0 ? (
        <p className="muted">Todavía no hay cuentas.</p>
      ) : (
        <ul className="account-catalog">
          {tenants.map((t) => {
            const inactive = t.isActive === false;
            return (
              <li key={t.id} className={inactive ? 'inactive' : ''}>
                <span className="account-catalog-copy">
                  <strong>
                    <AccountLogo slug={t.slug} size={28} />
                    {t.name}
                    {t.id === activeTenantId && !inactive ? (
                      <span className="pill">Activa ahora</span>
                    ) : null}
                    {inactive ? <span className="pill dim">Inactiva</span> : null}
                  </strong>
                  <AccountHandles tenant={t} onUpdated={onUpdated} />
                </span>
                <button
                  type="button"
                  className={`btn small ${inactive ? '' : 'secondary'}`}
                  disabled={togglingId === t.id}
                  onClick={() => void toggleActive(t)}
                >
                  {togglingId === t.id
                    ? '…'
                    : inactive
                      ? 'Reactivar'
                      : 'Desactivar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function UsersPage({
  tenants,
  currentUserId,
  onBack,
}: {
  tenants: TenantOption[];
  currentUserId: string;
  onBack: () => void;
}) {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('VIEWER');
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    void fetchUsers()
      .then(setUsers)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios');
      });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const created = await createUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        tenantId: role === 'SUPER_ADMIN' ? null : tenantId,
      });
      setUsers((list) =>
        [...list, created].sort((a, b) => {
          const aOn = a.isActive ? 0 : 1;
          const bOn = b.isActive ? 0 : 1;
          if (aOn !== bOn) return aOn - bOn;
          return a.fullName.localeCompare(b.fullName, 'es');
        }),
      );
      setFullName('');
      setEmail('');
      setPassword('');
      setOk(`Listo, ${created.fullName} ya puede entrar.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: SystemUser) {
    setTogglingId(user.id);
    setError('');
    setOk('');
    try {
      const updated = await patchUser(user.id, { isActive: !user.isActive });
      setUsers((list) =>
        list
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => {
            const aOn = a.isActive ? 0 : 1;
            const bOn = b.isActive ? 0 : 1;
            if (aOn !== bOn) return aOn - bOn;
            return a.fullName.localeCompare(b.fullName, 'es');
          }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="settings-page">
      <button type="button" className="back-btn" onClick={onBack}>
        <span className="back-icon">
          <IconBack size={18} />
        </span>
        Volver
      </button>
      <h2>Usuarios</h2>
      <p className="muted settings-lead">
        Cada persona entra con su correo y su contraseña. El super admin ve
        todas las cuentas. El resto solo la cuenta que le asignes.
      </p>

      <form className="card account-form" onSubmit={(e) => void onSubmit(e)}>
        <h3 className="settings-kicker">Nuevo usuario</h3>
        <label htmlFor="user-name">Nombre</label>
        <input
          id="user-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <label htmlFor="user-email">Correo</label>
        <input
          id="user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="user-password">Contraseña</label>
        <input
          id="user-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <label htmlFor="user-role">Rol</label>
        <select id="user-role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="SUPER_ADMIN">Super admin</option>
          <option value="ADMIN">Admin</option>
          <option value="OPERATOR">Operador</option>
          <option value="VIEWER">Consulta</option>
        </select>
        {role !== 'SUPER_ADMIN' ? (
          <>
            <label htmlFor="user-tenant">Cuenta</label>
            <select
              id="user-tenant"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {ok ? <p className="ok-msg">{ok}</p> : null}
        <p>
          <button
            className="btn"
            type="submit"
            disabled={busy || !fullName.trim() || !email.trim() || password.length < 6}
          >
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </p>
      </form>

      <h3 className="settings-kicker">Quién tiene acceso</h3>
      {users.length === 0 ? (
        <p className="muted">Todavía no hay usuarios.</p>
      ) : (
        <ul className="account-catalog">
          {users.map((item) => (
            <li key={item.id} className={item.isActive ? '' : 'inactive'}>
              <span className="account-catalog-copy">
                <strong>
                  {item.fullName}
                  {!item.isActive ? <span className="pill dim">Inactivo</span> : null}
                </strong>
                <span className="muted">
                  {item.email}
                  {' · '}
                  {ROLE_LABEL[item.role] ?? item.role}
                  {item.tenantName ? ` · ${item.tenantName}` : ''}
                </span>
              </span>
              {item.id === currentUserId ? null : (
                <button
                  type="button"
                  className={`btn small ${item.isActive ? 'secondary' : ''}`}
                  disabled={togglingId === item.id}
                  onClick={() => void toggleActive(item)}
                >
                  {togglingId === item.id ? '…' : item.isActive ? 'Desactivar' : 'Reactivar'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfilePage({
  user,
  onBack,
}: {
  user: SessionUser;
  onBack: () => void;
}) {
  return (
    <div className="settings-page">
      <button type="button" className="back-btn" onClick={onBack}>
        <span className="back-icon">
          <IconBack size={18} />
        </span>
        Volver
      </button>
      <h2>Perfil</h2>
      <div className="card profile-card">
        <p>
          <span className="muted">Nombre</span>
          <br />
          {user.fullName}
        </p>
        <p>
          <span className="muted">Correo</span>
          <br />
          {user.email}
        </p>
        <p>
          <span className="muted">Rol</span>
          <br />
          {ROLE_LABEL[user.role] ?? user.role}
        </p>
      </div>
    </div>
  );
}
