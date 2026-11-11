import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  createUser,
  fetchApifyKey,
  fetchEcosystems,
  fetchMe,
  saveApifyKey,
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
  runScrape,
  setActiveTenantId,
  setSession,
  type EcosystemAccount,
  type EcosystemGroup,
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
import { CommentReply } from './Reply';
import { TasksPage } from './Tasks';
import { EcosystemView, EcosystemsPage } from './Ecosystem';
import {
  IconAccounts,
  IconAt,
  IconBack,
  IconBoard,
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
type Screen = 'home' | 'settings' | 'profile' | 'accounts' | 'users' | 'compare' | 'tasks' | 'ecosystem' | 'groups';

const ECOSYSTEM_KEY = 'sld_ecosystem_id';

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
  const faces = emojis.filter((emoji) => emoji && !clean.includes(emoji)).join(' ');
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
      <form autoComplete="off" onSubmit={(e) => void onSubmit(e)}>
        <div className="brand">
          <IconLogo size={40} />
          <h1>La Escucha</h1>
        </div>
        <p className="hint">Monitoreo de publicaciones y comentarios.</p>
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
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

function emptyFeed(feed: 'instagram' | 'twitter', together = false): string {
  const who = together ? 'este ecosistema' : 'esta cuenta';
  if (feed === 'twitter') {
    return together
      ? 'Este ecosistema todavía no tiene tweets.'
      : 'Esta cuenta todavía no tiene tweets. Cargá el usuario en Cuentas y apretá Buscar.';
  }
  return `No hay publicaciones de Instagram en ${who}.`;
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

  const handle = network === 'twitter' ? handles.twitter : handles.instagram;

  async function onSearch() {
    setBusy(true);
    setNote('Buscando… puede tardar un minuto.');
    try {
      const res = await runScrape(limit, network);
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

  const hint = !configured
    ? 'Cargá tu clave de Apify en Ajustes → Perfil.'
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
  const [tab, setTab] = useState<Tab>('publicaciones');
  const [feed, setFeed] = useState<'instagram' | 'twitter'>('instagram');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [activeTenantId, setActiveTenant] = useState<string>(() => {
    return getActiveTenantId() ?? user.tenantId ?? '';
  });
  const [openPosts, setOpenPosts] = useState<string[]>([]);
  const [replyCommentId, setReplyCommentId] = useState<string | null>(null);
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('ecosystem');
  const [scope, setScope] = useState<'account' | 'group'>('account');
  const [ecosystems, setEcosystems] = useState<EcosystemGroup[]>([]);
  const [ecosystemId, setEcosystemId] = useState<string | null>(
    () => localStorage.getItem(ECOSYSTEM_KEY),
  );
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const admin = canManageWatchlist(user.role);
  const canSwitchTenant = user.role === 'SUPER_ADMIN';
  const liveTenants = useMemo(
    () => tenants.filter((t) => t.isActive !== false),
    [tenants],
  );
  const activeAccount = liveTenants.find((t) => t.id === activeTenantId);
  const ecosystem = ecosystems.find((item) => item.id === ecosystemId) ?? ecosystems[0] ?? null;
  const theme = themeForSlug(
    ecosystem?.accounts[0]?.slug ?? activeAccount?.slug ?? user.tenantSlug,
  );

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
    let cancelled = false;
    void fetchEcosystems()
      .then(async (list) => {
        if (cancelled) return;
        setEcosystems(list);
        const freshTenants = await fetchTenants().catch(() => null);
        if (!cancelled && freshTenants) setTenants(freshTenants);
        const stored = localStorage.getItem(ECOSYSTEM_KEY);
        const next = list.find((item) => item.id === stored) ?? list[0] ?? null;
        setEcosystemId(next?.id ?? null);
        if (next) localStorage.setItem(ECOSYSTEM_KEY, next.id);
        const memberIds = new Set(next?.accounts.map((account) => account.id) ?? []);
        if (next && !memberIds.has(getActiveTenantId() ?? '')) {
          const first = next.accounts[0];
          if (first) {
            setActiveTenantId(first.id);
            setActiveTenant(first.id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setEcosystems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const groupAccounts = ecosystem?.accounts ?? [];
  const groupKey = groupAccounts.map((account) => account.id).join(',');

  useEffect(() => {
    if (scope === 'group') {
      if (groupAccounts.length === 0) return;
      let cancelled = false;
      async function loadGroup() {
        try {
          const bundles = await Promise.all(
            groupAccounts.map(async (account) => {
              const page = await fetchPosts(account.id);
              return page.items.map((post) => ({
                ...post,
                accountId: account.id,
                accountName: account.name,
                accountSlug: account.slug,
              }));
            }),
          );
          if (cancelled) return;
          const merged = bundles.flat().sort((a, b) => {
            const left = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const right = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return right - left;
          });
          setError('');
          setPosts(merged);
          setWatchlist([]);
          setSummary({
            total: merged.reduce((sum, post) => sum + post.comments.length, 0),
            posts: merged.length,
            byCategory: [],
            bySentiment: [],
          });
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Error al cargar');
          }
        }
      }
      void loadGroup();
      return () => {
        cancelled = true;
      };
    }
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
  }, [scope, groupKey, activeTenantId, canSwitchTenant, reloadKey]);

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

  function chooseEcosystem(next: EcosystemGroup) {
    setEcosystemId(next.id);
    localStorage.setItem(ECOSYSTEM_KEY, next.id);
    const first = next.accounts[0];
    if (first) {
      setActiveTenantId(first.id);
      setActiveTenant(first.id);
      setSummary(null);
      setPosts([]);
      setWatchlist([]);
      setOpenPosts([]);
      setReloadKey((n) => n + 1);
    }
  }

  function openAccount(account: EcosystemAccount) {
    setScope('account');
    setActiveTenantId(account.id);
    setActiveTenant(account.id);
    setSummary(null);
    setPosts([]);
    setWatchlist([]);
    setOpenPosts([]);
    setReloadKey((n) => n + 1);
  }

  function openGroup() {
    setScope('group');
    setSummary(null);
    setPosts([]);
    setWatchlist([]);
    setOpenPosts([]);
    setReloadKey((n) => n + 1);
  }

  function openInPublications(postId: string) {
    setOpenPosts((current) => (current.includes(postId) ? current : [...current, postId]));
    setFocusPostId(postId);
    setTab('publicaciones');
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-bar">
        <div className="app-bar-left">
          <div className="brand-home">
            <span className="mark">
              <IconLogo size={26} />
            </span>
            La Escucha
          </div>
          <nav className="app-nav" aria-label="Secciones">
            <button
              type="button"
              className={`icon-btn${screen === 'ecosystem' ? ' active' : ''}`}
              onClick={() => setScreen('ecosystem')}
            >
              <IconAccounts size={18} />
              Ecosistema
            </button>
            <button
              type="button"
              className={`icon-btn${screen === 'home' ? ' active' : ''}`}
              onClick={() => {
                setScreen('home');
                setTab('publicaciones');
              }}
            >
              <IconFeed size={18} />
              Monitoreo
            </button>
            {canSwitchTenant ? (
              <button
                type="button"
                className={`icon-btn${screen === 'compare' ? ' active' : ''}`}
                onClick={() => setScreen('compare')}
              >
                <IconChart size={18} />
                Comparar
              </button>
            ) : null}
            <button
              type="button"
              className={`icon-btn${screen === 'tasks' ? ' active' : ''}`}
              onClick={() => setScreen('tasks')}
            >
              <IconBoard size={18} />
              Tareas
            </button>
          </nav>
        </div>
        <div className="app-bar-right">
          {ecosystem ? (
            <div className="now-listening" aria-label="Cuenta en uso">
              {scope === 'account' ? (
                <AccountLogo slug={activeAccount?.slug} size={22} />
              ) : null}
              <span>
                <span className="now-eco">{ecosystem.name}</span>
                <strong>
                  {scope === 'account'
                    ? (activeAccount?.name ?? 'Una cuenta')
                    : 'Todas las cuentas'}
                </strong>
              </span>
            </div>
          ) : (
            <div className="meta">{user.tenantName ?? 'Piloto'}</div>
          )}
          <button
            type="button"
            className={`icon-btn${
              screen === 'settings' ||
              screen === 'profile' ||
              screen === 'accounts' ||
              screen === 'users' ||
              screen === 'groups'
                ? ' active'
                : ''
            }`}
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
            ecosystemName={ecosystem?.name}
            onOpenGroups={() => setScreen('groups')}
            onOpenUsers={() => setScreen('users')}
          />
        ) : null}
        {screen === 'profile' ? (
          <ProfilePage user={user} onBack={() => setScreen('settings')} />
        ) : null}
        {screen === 'users' && canSwitchTenant ? (
          <UsersPage
            tenants={tenants.filter(
              (tenant) =>
                !ecosystem || ecosystem.accounts.some((account) => account.id === tenant.id),
            )}
            currentUserId={user.id}
            onBack={() => setScreen('settings')}
          />
        ) : null}
        {screen === 'accounts' ? (
          <AccountsPage
            tenants={tenants.filter(
              (tenant) =>
                !ecosystem || ecosystem.accounts.some((account) => account.id === tenant.id),
            )}
            activeTenantId={activeTenantId}
            onBack={() => setScreen('settings')}
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
                  (t) =>
                    t.id !== tenant.id &&
                    t.isActive !== false &&
                    (!ecosystem || ecosystem.accounts.some((account) => account.id === t.id)),
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
        {screen === 'groups' && canSwitchTenant ? (
          <EcosystemsPage
            groups={ecosystems}
            activeId={ecosystem?.id ?? null}
            onSelect={chooseEcosystem}
            available={tenants.filter(
              (tenant) =>
                tenant.isActive !== false &&
                !ecosystems.some((item) => item.accounts.some((account) => account.id === tenant.id)),
            )}
            onBack={() => setScreen('settings')}
            onCreated={(created) => {
              setEcosystems((list) =>
                [...list, created].sort((a, b) => a.name.localeCompare(b.name, 'es')),
              );
              chooseEcosystem(created);
            }}
          />
        ) : null}
        {screen === 'ecosystem' && ecosystem ? (
          <EcosystemView
            group={ecosystem}
            selectedId={scope === 'account' ? activeTenantId : null}
            onOpenAccount={openAccount}
            onOpenGroup={openGroup}
          />
        ) : null}
        {screen === 'ecosystem' && !ecosystem ? (
          <p className="hint">Todavía no hay un ecosistema armado.</p>
        ) : null}
        {screen === 'compare' && canSwitchTenant ? (
          <ComparePage
            tenants={
              ecosystem
                ? liveTenants.filter((tenant) =>
                    ecosystem.accounts.some((account) => account.id === tenant.id),
                  )
                : liveTenants
            }
          />
        ) : null}
        {screen === 'tasks' && ecosystem ? (
          <TasksPage key={ecosystem.id} ecosystemName={ecosystem.name} />
        ) : null}
        {screen === 'tasks' && !ecosystem ? (
          <p className="hint">Elegí un ecosistema para ver sus tareas.</p>
        ) : null}
        {screen === 'home' ? (
          <>
        {error ? <p className="error">{error}</p> : null}
        <div className="page-head">
          <div className="page-title">
            {scope === 'group' && ecosystem ? null : (
              <AccountLogo slug={activeAccount?.slug} size={52} />
            )}
            <div>
              <h2>
                {scope === 'group' && ecosystem
                  ? ecosystem.name
                  : (activeAccount?.name ?? user.tenantName ?? 'Escucha')}
              </h2>
              {scope === 'group' && ecosystem ? (
                <p>{ecosystem.accounts.map((account) => account.name).join(' · ')}</p>
              ) : null}
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
        {admin && scope === 'account' ? (
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
          {scope === 'account' ? (
            <button
              type="button"
              className={tab === 'referencias' ? 'active' : ''}
              onClick={() => setTab('referencias')}
            >
              <IconAt size={16} />
              Activos{visibleWatchlist.length ? ` (${visibleWatchlist.length})` : ''}
            </button>
          ) : null}
        </div>

        {tab === 'resumen' ? (
          !summary && posts.length === 0 ? (
            <p className="muted">Leyendo…</p>
          ) : (
            <Reading
              posts={visiblePosts}
              empty={emptyFeed(feed, scope === 'group')}
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
              empty={emptyFeed(feed, scope === 'group')}
              onOpenPost={openInPublications}
            />
          )
        ) : null}

        {tab === 'publicaciones' ? (
          <div className="post-list">
            {visiblePosts.length === 0 ? (
              <p className="muted">{emptyFeed(feed, scope === 'group')}</p>
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
                        {post.accountName ? (
                          <span className="post-account">
                            <AccountLogo slug={post.accountSlug} size={18} />
                            {post.accountName}
                          </span>
                        ) : null}
                        {post.ownerUsername ? `@${post.ownerUsername}` : 'Post'}
                        {post.publishedAt ? ` · ${formatWhen(post.publishedAt)}` : ''}
                      </span>
                      {open || !post.imageUrl ? null : (
                        <span className="post-preview-row">
                          <img
                            className="post-thumb"
                            src={post.imageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                          <span className="post-preview">
                            {captionPreview(post.caption)}
                          </span>
                        </span>
                      )}
                      {open || post.imageUrl ? null : (
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
                      {post.imageUrl ? (
                        <img
                          className="post-image"
                          src={post.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                      ) : null}
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
                            const copy = commentCopy(c.rawText?.trim() || c.cleanText, c.emojis);
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
                                  {copy.body && !copy.emojiOnly ? (
                                    <button
                                      type="button"
                                      className={`reply-toggle${replyCommentId === c.id ? ' on' : ''}`}
                                      aria-expanded={replyCommentId === c.id}
                                      onClick={() =>
                                        setReplyCommentId((current) => (current === c.id ? null : c.id))
                                      }
                                    >
                                      Responder
                                    </button>
                                  ) : null}
                                </div>
                                {replyCommentId === c.id && copy.body ? (
                                  <CommentReply
                                    comment={copy.body}
                                    accountName={
                                      post.accountName ?? activeAccount?.name ?? user.tenantName ?? 'esta cuenta'
                                    }
                                    accountSlug={post.accountSlug ?? activeAccount?.slug}
                                  />
                                ) : null}
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

function SettingsHome({
  canManageAccounts,
  ecosystemName,
  onOpenProfile,
  onOpenAccounts,
  onOpenGroups,
  onOpenUsers,
}: {
  canManageAccounts: boolean;
  ecosystemName?: string;
  onOpenProfile: () => void;
  onOpenAccounts: () => void;
  onOpenGroups: () => void;
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
              <span className="muted">Instagram y Twitter de este ecosistema</span>
            </span>
          </button>
        ) : null}
        {canManageAccounts ? (
          <button type="button" className="settings-tile" onClick={onOpenGroups}>
            <span className="settings-icon" aria-hidden>
              <IconAccounts size={20} />
            </span>
            <span className="settings-tile-copy">
              <strong>Ecosistemas</strong>
              <span className="muted">
                {ecosystemName ? `En uso: ${ecosystemName}` : 'Elegí cuál se escucha'}
              </span>
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
  onUpdated,
}: {
  tenants: TenantOption[];
  activeTenantId: string;
  onBack: () => void;
  onUpdated: (tenant: TenantOption) => void;
}) {
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
        Las cuentas de este ecosistema. Podés corregir Instagram o Twitter.
        Desactivar una la saca del mapa sin borrar lo ya cargado.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {ok ? <p className="ok-msg">{ok}</p> : null}

      <h3 className="settings-kicker">Cuentas</h3>
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
  const [hint, setHint] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchApifyKey()
      .then((status) => {
        if (cancelled) return;
        setConfigured(status.configured);
        setHint(status.hint);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo leer la clave de Apify.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: string) {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const status = await saveApifyKey(next);
      setConfigured(status.configured);
      setHint(status.hint);
      setToken('');
      setOk(status.configured ? 'Clave guardada.' : 'Clave quitada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la clave');
    } finally {
      setBusy(false);
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
        <form
          className="apify-key"
          onSubmit={(event) => {
            event.preventDefault();
            void save(token);
          }}
        >
          <span className="muted">Clave de Apify</span>
          <p className="muted">
            {configured
              ? `Guardada ${hint ?? ''}. Las búsquedas usan la tuya.`
              : 'Todavía no cargaste una. Sin esta clave, Buscar no corre.'}
          </p>
          <input
            type="password"
            autoComplete="off"
            value={token}
            placeholder="Pegá tu clave"
            aria-label="Clave de Apify"
            onChange={(event) => setToken(event.target.value)}
          />
          <span className="apify-key-actions">
            <button className="btn" type="submit" disabled={busy || !token.trim()}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            {configured ? (
              <button
                className="btn small secondary"
                type="button"
                disabled={busy}
                onClick={() => void save('')}
              >
                Quitar
              </button>
            ) : null}
          </span>
          {error ? <span className="error">{error}</span> : null}
          {ok ? <span className="muted">{ok}</span> : null}
        </form>
      </div>
    </div>
  );
}
