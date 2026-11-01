import type { PostRow } from './api';
import { buildThemeSuggestions } from './suggestions';

export function SuggestionsPanel({
  posts,
  empty,
  onOpenPost,
}: {
  posts: PostRow[];
  empty?: string;
  onOpenPost?: (postId: string) => void;
}) {
  const themes = buildThemeSuggestions(posts);

  if (posts.length === 0) {
    return <p className="muted">{empty ?? 'No hay comentarios en esta cuenta.'}</p>;
  }

  if (themes.length === 0) {
    return (
      <p className="muted">
        En estos comentarios todavía no aparece un pedido concreto para sugerir.
      </p>
    );
  }

  return (
    <div className="suggestion-page">
      <p className="muted tab-help">
        Sale de lo que piden en los comentarios. Cada tema junta el pedido que se repite.
      </p>
      {themes.map((theme) => (
        <section key={theme.category} className="suggestion-theme-block">
          <h3>{theme.label}</h3>
          {theme.asks.map((ask) => (
            <article key={`${theme.category}-${ask.text}`} className="suggestion">
              <p className="suggestion-ask">{ask.text}</p>
              <p className="suggestion-quote">“{ask.evidence}”</p>
              <div className="suggestion-foot">
                <span className="muted">
                  {ask.count === 1 ? '1 comentario' : `${ask.count} comentarios`}
                </span>
                <button type="button" className="reading-jump" onClick={() => onOpenPost?.(ask.postId)}>
                  Ver esa publicación
                </button>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
