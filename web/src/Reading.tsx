import { useState } from 'react';
import { CATEGORY_LABEL } from './labels';
import { IconChevron, IconInstagram, IconTwitter } from './icons';
import type { PostRow } from './api';
const THEME_ORDER = [
  'POLITICS',
  'ATTACK',
  'SUPPORT',
  'SECURITY',
  'HEALTH',
  'PUBLIC_WORKS',
  'ENGAGEMENT',
] as const;

const PER_THEME = 3;

function commentText(raw: string | null | undefined, clean: string, emojis: string[]): string {
  const source = raw?.trim() || clean;
  const body = source.replace(/\s+/g, ' ').trim();
  const faces = emojis.filter(Boolean).join(' ');
  if (body && faces && !body.includes(faces)) return `${body} ${faces}`;
  return body || faces;
}

function formatAgo(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return minutes <= 1 ? 'hace 1 minuto' : `hace ${minutes} minutos`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

function preview(text: string | null, max = 110): string {
  if (!text) return '';
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

function linkLabel(url: string): string {
  return /(?:^|\/\/)(?:www\.)?(?:twitter|x)\.com\//i.test(url)
    ? 'Ver en Twitter'
    : 'Ver el post';
}

type ReadingItem = {
  id: string;
  rawText: string | null | undefined;
  cleanText: string;
  emojis: string[];
  category: string;
  publishedAt: string | null;
  post: PostRow;
  kind: 'tweet' | 'comment';
};

export function Reading({
  posts,
  empty,
  onOpenPost,
}: {
  posts: PostRow[];
  empty?: string;
  onOpenPost?: (postId: string) => void;
}) {
  const comments: ReadingItem[] = posts.flatMap((post) =>
    post.comments.map((comment) => ({
      id: comment.id,
      rawText: comment.rawText,
      cleanText: comment.cleanText,
      emojis: comment.emojis,
      category: comment.category,
      publishedAt: comment.publishedAt,
      post,
      kind: 'comment' as const,
    })),
  );
  const tweets: ReadingItem[] = posts
    .filter((post) => post.network === 'twitter' && post.caption?.trim() && post.category)
    .map((post) => ({
      id: `tweet-${post.id}`,
      rawText: post.caption,
      cleanText: post.caption ?? '',
      emojis: [],
      category: post.category ?? 'OTHER',
      publishedAt: post.publishedAt,
      post,
      kind: 'tweet' as const,
    }));
  const pieces = [...tweets, ...comments];
  const others = pieces.filter((comment) => comment.category === 'OTHER').length;
  const sections = THEME_ORDER.map((category) => {
    const items = pieces
      .filter((comment) => comment.category === category)
      .sort((a, b) => {
        const left = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const right = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return right - left;
      });
    return { category, total: items.length, items: items.slice(0, PER_THEME) };
  }).filter((section) => section.total > 0);

  const [openIds, setOpenIds] = useState<string[]>([]);

  if (pieces.length === 0) {
    return (
      <p className="muted">
        {posts.length === 0
          ? (empty ?? 'No hay comentarios en esta cuenta.')
          : 'Hay publicaciones, pero todavía no hay respuestas para leer.'}
      </p>
    );
  }

  function toggle(category: string) {
    setOpenIds((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  return (
    <div className="reading">
      {sections.map((section) => {
        const open = openIds.includes(section.category);
        return (
        <section key={section.category} className="reading-section">
          <h3>
            <button
              type="button"
              className="reading-toggle"
              aria-expanded={open}
              onClick={() => toggle(section.category)}
            >
              <IconChevron open={open} size={16} />
              {CATEGORY_LABEL[section.category] ?? section.category}
              <span>{section.total}</span>
            </button>
          </h3>
          {open ? (
          <div className="reading-list">
            {section.items.map((comment) => {
              const text = commentText(comment.rawText, comment.cleanText, comment.emojis);
              const where = comment.kind === 'comment' ? preview(comment.post.caption) : '';
              return (
                <article key={comment.id} className="reading-card">
                  <p>{text || 'Sin texto'}</p>
                  {where ? (
                    <button
                      type="button"
                      className="reading-post reading-jump"
                      onClick={() => onOpenPost?.(comment.post.id)}
                    >
                      En: {where}
                    </button>
                  ) : null}
                  <div className="reading-foot">
                    <time>{formatAgo(comment.publishedAt)}</time>
                    <span className="reading-links">
                      <button
                        type="button"
                        className="reading-jump"
                        onClick={() => onOpenPost?.(comment.post.id)}
                      >
                        Ver en Publicaciones
                      </button>
                      {comment.post.url ? (
                        <a className="ig-link" href={comment.post.url} target="_blank" rel="noreferrer">
                          {/(?:^|\/\/)(?:www\.)?(?:twitter|x)\.com\//i.test(comment.post.url) ? (
                            <IconTwitter size={15} />
                          ) : (
                            <IconInstagram size={15} />
                          )}
                          {linkLabel(comment.post.url)}
                        </a>
                      ) : null}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          ) : null}
        </section>
        );
      })}
      {others > 0 ? (
        <p className="muted reading-rest">
          {others} sin un tema claro. Están en Publicaciones.
        </p>
      ) : null}
    </div>
  );
}
