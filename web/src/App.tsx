import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  createTenant,
  fetchMe,
  patchTenant,
  fetchPosts,
  fetchSummary,
  fetchTenants,
  fetchScrapeTargets,
  fetchWatchlist,
  getActiveTenantId,
  getToken,
  getUser,
  login,
  patchWatchlist,
  runScrape,
  setActiveTenantId,
  setSession,
  type PostRow,
  type SessionUser,
  type Summary,
  type TenantOption,
  type WatchlistRow,
} from './api';
import {
  CATEGORY_LABEL,
  REASON_LABEL,
  ROLE_LABEL,
  SENTIMENT_LABEL,
  STATUS_LABEL,
} from './labels';
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
  IconLogo,
  IconLogout,
  IconUser,
} from './icons';

type Tab = 'resumen' | 'publicaciones' | 'referencias';
type Screen = 'home' | 'settings' | 'profile' | 'accounts';

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
  return slug === 'agusciarletta' ? 'agusciarletta' : 'san-fernando';
}

function captionPreview(caption: string | null | undefined): string {
  if (!caption) return 'Sin texto';
  const oneLine = caption.replace(/\s+/g, ' ').trim();
  return oneLine.length > 140 ? `${oneLine.slice(0, 140)}…` : oneLine;
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

function BarList({
  items,
}: {
  items: { label: string; count: number }[];
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  if (items.length === 0) return <p className="muted">Sin datos</p>;
  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span className="k">{item.label}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
          <span className="n">{item.count}</span>
        </div>
      ))}
    </div>
  );
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
  const [email, setEmail] = useState('superadmin@sld.local');
  const [password, setPassword] = useState('cambiar123');
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

function SearchBar({
  tenantId,
  onDone,
}: {
  tenantId: string;
  onDone: () => void;
}) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [configured, setConfigured] = useState(true);
  const [limit, setLimit] = useState(5);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    setNote('');
    void fetchScrapeTargets()
      .then((res) => {
        if (cancelled) return;
        setAccounts(res.accounts);
        setConfigured(res.apifyConfigured);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  async function onSearch() {
    setBusy(true);
    setNote('Buscando… puede tardar un minuto.');
    try {
      const res = await runScrape(limit);
      if (res.posts === 0) {
        setNote('Apify no trajo publicaciones.');
      } else if (res.duplicated) {
        setNote('Esas publicaciones ya estaban cargadas.');
      } else {
        setNote(
          `Entraron ${res.posts} publicaciones y ${res.comments} comentarios.`,
        );
      }
      onDone();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'No se pudo buscar');
    } finally {
      setBusy(false);
    }
  }

  const accountLabel =
    accounts.length === 0
      ? 'Esta cuenta no tiene un perfil de Instagram cargado.'
      : `Posts de ${accounts.map((name) => (name.startsWith('@') ? name : `@${name}`)).join(', ')}.`;

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
        disabled={busy || !configured || accounts.length === 0}
        onClick={() => void onSearch()}
      >
        {busy ? 'Buscando…' : 'Buscar'}
      </button>
      <p className="search-note">
        {configured
          ? `${accountLabel} Cada búsqueda corta a los 0,05 USD.`
          : 'Falta APIFY_TOKEN en el servidor.'}
        {note ? ` ${note}` : ''}
      </p>
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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [activeTenantId, setActiveTenant] = useState<string>(() => {
    return getActiveTenantId() ?? user.tenantId ?? '';
  });
  const [openPosts, setOpenPosts] = useState<string[]>([]);
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

  const pending = useMemo(
    () => watchlist.filter((a) => a.status === 'PENDING').length,
    [watchlist],
  );

  async function changeStatus(id: string, status: string) {
    const updated = await patchWatchlist(id, status);
    setWatchlist((rows) => rows.map((r) => (r.id === id ? updated : r)));
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
          />
        ) : null}
        {screen === 'profile' ? (
          <ProfilePage user={user} onBack={() => setScreen('settings')} />
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
        {screen === 'home' ? (
          <>
        {error ? <p className="error">{error}</p> : null}
        <div className="page-head">
          <h2>{activeAccount?.name ?? user.tenantName ?? 'Escucha'}</h2>
          <p>Publicaciones, comentarios y cuentas que aparecen en el hilo.</p>
        </div>
        {admin ? (
          <SearchBar
            tenantId={activeTenantId}
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
            className={tab === 'referencias' ? 'active' : ''}
            onClick={() => setTab('referencias')}
          >
            <IconAt size={16} />
            Referencias{pending ? ` (${pending})` : ''}
          </button>
        </div>

        {tab === 'resumen' && summary ? (
          <>
            <div className="cards">
              <div className="card">
                <div className="n">{summary.posts ?? posts.length}</div>
                <div className="l">Publicaciones</div>
              </div>
              <div className="card">
                <div className="n">{summary.total}</div>
                <div className="l">Comentarios</div>
              </div>
              <div className="card">
                <div className="n">{watchlist.length}</div>
                <div className="l">Referencias</div>
              </div>
              <div className="card">
                <div className="n">{pending}</div>
                <div className="l">Sin decidir</div>
              </div>
            </div>
            <div className="split">
              <div className="card">
                <strong>Por tema</strong>
                <BarList
                  items={summary.byCategory.map((r) => ({
                    label: CATEGORY_LABEL[r.category] ?? r.category,
                    count: r.count,
                  }))}
                />
              </div>
              <div className="card">
                <strong>Por tono</strong>
                <BarList
                  items={summary.bySentiment.map((r) => ({
                    label: SENTIMENT_LABEL[r.sentiment] ?? r.sentiment,
                    count: r.count,
                  }))}
                />
              </div>
            </div>
          </>
        ) : null}

        {tab === 'publicaciones' ? (
          <div className="post-list">
            {posts.length === 0 ? (
              <p className="muted">No hay publicaciones en esta cuenta.</p>
            ) : (
              <div className="post-toolbar">
                <span className="muted">{posts.length} publicaciones</span>
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() =>
                    setOpenPosts(
                      openPosts.length === posts.length ? [] : posts.map((p) => p.id),
                    )
                  }
                >
                  {openPosts.length === posts.length ? 'Cerrar todas' : 'Abrir todas'}
                </button>
              </div>
            )}
            {posts.map((post) => {
              const open = openPosts.includes(post.id);
              return (
                <article
                  key={post.id}
                  className={`post-card${open ? ' open' : ''}`}
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
                          <IconInstagram size={15} />
                          Ver en Instagram
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
            Cuentas de Instagram que salieron en los posts (comentaron, las
            mencionaron o las etiquetaron). No se siguen solas: acá decidís si
            pasarlas a monitoreo o dejarlas de lado.
          </p>
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>De dónde salió</th>
                <th>Estado</th>
                {admin ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {watchlist.map((a) => (
                <tr key={a.id}>
                  <td>@{a.username}</td>
                  <td>{REASON_LABEL[a.reason] ?? a.reason}</td>
                  <td>{STATUS_LABEL[a.status] ?? a.status}</td>
                  {admin ? (
                    <td>
                      {a.status !== 'WATCHING' ? (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => void changeStatus(a.id, 'WATCHING')}
                        >
                          Monitorear
                        </button>
                      ) : null}{' '}
                      {a.status !== 'IGNORED' ? (
                        <button
                          type="button"
                          className="btn small secondary"
                          onClick={() => void changeStatus(a.id, 'IGNORED')}
                        >
                          Ignorar
                        </button>
                      ) : null}
                    </td>
                  ) : null}
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
}: {
  canManageAccounts: boolean;
  onOpenProfile: () => void;
  onOpenAccounts: () => void;
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
              <span className="muted">Alta de Instagram / municipio</span>
            </span>
          </button>
        ) : null}
      </div>
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
      const created = await createTenant(name.trim(), slug.trim(), instagram.trim());
      onCreated(created);
      setName('');
      setSlug('');
      setInstagram('');
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
      const updated = await patchTenant(tenant.id, next);
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
        Cada cuenta es un municipio o una persona, y un perfil de Instagram.
        Buscar trae los posts de ese perfil. Desactivar la saca del selector
        sin borrar lo ya cargado.
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
                    {t.name}
                    {t.id === activeTenantId && !inactive ? (
                      <span className="pill">Activa ahora</span>
                    ) : null}
                    {inactive ? <span className="pill dim">Inactiva</span> : null}
                  </strong>
                  <span className="muted">
                    {t.instagramHandle ? `@${t.instagramHandle}` : t.slug}
                  </span>
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
