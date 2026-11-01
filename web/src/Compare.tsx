import { useEffect, useState } from 'react';
import {
  fetchCompare,
  fetchCompareComments,
  type CompareComment,
  type CompareResult,
  type TenantOption,
} from './api';
import { CATEGORY_LABEL, SENTIMENT_LABEL } from './labels';
import { AccountLogo } from './logos';

const SELECTION_KEY = 'sld_compare_ids';

function readSelection(liveIds: string[]): string[] {
  const raw = localStorage.getItem(SELECTION_KEY);
  if (!raw) return liveIds;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return liveIds;
    return parsed.filter((id): id is string => typeof id === 'string' && liveIds.includes(id));
  } catch {
    return liveIds;
  }
}

function commentBody(text: string, emojis: string[]): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const faces = emojis.filter(Boolean).join(' ');
  if (clean && faces) return `${clean} ${faces}`;
  return clean || faces;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function sentimentClass(sentiment: string): string {
  if (sentiment === 'POSITIVE') return 'pill pos';
  if (sentiment === 'NEGATIVE') return 'pill neg';
  return 'pill neu';
}

export function ComparePage({ tenants }: { tenants: TenantOption[] }) {
  const live = tenants.filter((tenant) => tenant.isActive !== false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [data, setData] = useState<CompareResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<{ tenantId: string; category: string } | null>(null);
  const [comments, setComments] = useState<CompareComment[]>([]);
  const [commentsError, setCommentsError] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    const liveIds = tenants
      .filter((tenant) => tenant.isActive !== false)
      .map((tenant) => tenant.id);
    setSelected((current) => {
      if (current === null) return readSelection(liveIds);
      return current.filter((id) => liveIds.includes(id));
    });
  }, [tenants]);

  useEffect(() => {
    if (selected === null) return;
    localStorage.setItem(SELECTION_KEY, JSON.stringify(selected));
  }, [selected]);

  useEffect(() => {
    if (selected === null) return;
    if (selected.length === 0) {
      setData(null);
      setOpen(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchCompare(selected)
      .then((result) => {
        if (cancelled) return;
        setError('');
        setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo comparar');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!open) {
      setComments([]);
      return;
    }
    let cancelled = false;
    setCommentsLoading(true);
    setCommentsError('');
    void fetchCompareComments(open.tenantId, open.category)
      .then((result) => {
        if (!cancelled) setComments(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setComments([]);
          setCommentsError(err instanceof Error ? err.message : 'No se pudieron leer');
        }
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function toggle(id: string) {
    setOpen(null);
    setSelected((current) => {
      const list = current ?? [];
      return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
    });
  }

  function openCell(tenantId: string, category: string, count: number) {
    if (count === 0) return;
    if (open?.tenantId === tenantId && open.category === category) {
      setOpen(null);
      return;
    }
    setComments([]);
    setCommentsError('');
    setCommentsLoading(true);
    setOpen({ tenantId, category });
  }

  const accounts = data?.accounts ?? [];
  const openAccount = accounts.find((account) => account.id === open?.tenantId);

  return (
    <>
      <div className="page-head">
        <h2>Comparar</h2>
        <p>
          Comentarios por tema, en las cuentas que elijas. El comentario sigue
          en la cuenta de la que salió.
        </p>
      </div>
      <div className="compare-picks" role="group" aria-label="Cuentas a comparar">
        {live.map((tenant) => {
          return (
            <label key={tenant.id} className={selected?.includes(tenant.id) ? 'on' : ''}>
              <input
                type="checkbox"
                checked={selected?.includes(tenant.id) ?? false}
                onChange={() => toggle(tenant.id)}
              />
              <AccountLogo slug={tenant.slug} size={20} />
              {tenant.name}
            </label>
          );
        })}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {selected !== null && selected.length === 0 ? (
        <p className="muted">Elegí al menos una cuenta.</p>
      ) : null}
      {loading && !data ? <p className="muted">Leyendo comentarios…</p> : null}
      {data && accounts.length > 0 ? (
        <div className="compare-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Tema</th>
                {accounts.map((account) => (
                  <th key={account.id} className="num">
                    <span className="compare-account">
                      <AccountLogo
                        slug={tenants.find((tenant) => tenant.id === account.id)?.slug}
                        size={18}
                      />
                      <span className="compare-account-name">{account.name}</span>
                    </span>
                    {[account.instagramHandle, account.twitterHandle]
                      .filter((handle): handle is string => Boolean(handle))
                      .filter((handle, index, list) => list.indexOf(handle) === index)
                      .map((handle) => (
                        <span key={handle} className="compare-handle">
                          @{handle}
                        </span>
                      ))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.categories.map((row) => (
                <tr key={row.category} className={row.category === 'OTHER' ? 'compare-other' : ''}>
                  <th scope="row">{CATEGORY_LABEL[row.category] ?? row.category}</th>
                  {accounts.map((account) => {
                    const count = row.counts[account.id] ?? 0;
                    const active =
                      open?.tenantId === account.id && open.category === row.category;
                    return (
                      <td key={account.id} className="num">
                        {count === 0 ? (
                          <span className="muted">0</span>
                        ) : (
                          <button
                            type="button"
                            className={active ? 'cell on' : 'cell'}
                            aria-pressed={active}
                            onClick={() => openCell(account.id, row.category, count)}
                          >
                            {count}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="compare-total">
                <th scope="row">Total</th>
                {accounts.map((account) => {
                  const total = data.categories.reduce(
                    (sum, row) => sum + (row.counts[account.id] ?? 0),
                    0,
                  );
                  return (
                    <td key={account.id} className="num">
                      {total}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {open && openAccount ? (
        <section className="compare-detail">
          <h3>
            {CATEGORY_LABEL[open.category] ?? open.category} en {openAccount.name}
          </h3>
          {commentsLoading ? <p className="muted">Leyendo comentarios…</p> : null}
          {commentsError ? <p className="error">{commentsError}</p> : null}
          {!commentsLoading && comments.length === 0 && !commentsError ? (
            <p className="muted">No hay comentarios en este tema.</p>
          ) : null}
          <div className="post-comments">
            {comments.map((comment) => {
              const body = commentBody(comment.text, comment.emojis);
              return (
                <article
                  key={comment.id}
                  className={`comment-card sent-${comment.sentiment.toLowerCase()}`}
                >
                  <p className="compare-origin">{openAccount.name}</p>
                  {body ? (
                    <p className="comment-text">{body}</p>
                  ) : (
                    <p className="comment-text muted">Sin texto</p>
                  )}
                  {comment.post.caption ? (
                    <p className="muted compare-post">
                      En: {comment.post.caption.replace(/\s+/g, ' ').trim().slice(0, 140)}
                    </p>
                  ) : null}
                  <div className="comment-meta">
                    <span className={sentimentClass(comment.sentiment)}>
                      {SENTIMENT_LABEL[comment.sentiment] ?? comment.sentiment}
                    </span>
                    {comment.publishedAt ? (
                      <time className="comment-when">{formatWhen(comment.publishedAt)}</time>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
