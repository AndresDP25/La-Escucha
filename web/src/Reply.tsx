import { useRef, useState } from 'react';
import { AccountLogo } from './logos';

export type ReplyIntent = 'fixed' | 'planned' | 'ask';

const INTENTS: { id: ReplyIntent; label: string }[] = [
  { id: 'fixed', label: 'Ya se arregló' },
  { id: 'planned', label: 'Lo vamos a arreglar' },
  { id: 'ask', label: 'Pedir el dato' },
];

function shortTopic(comment: string): string | null {
  const one = comment.replace(/\s+/g, ' ').trim();
  const words = one.split(' ').filter(Boolean);
  if (words.length < 3 || words.length > 12 || one.length > 72) return null;
  return one.replace(/[.!?…]+$/u, '');
}

export function replyDraft(intent: ReplyIntent, comment: string): string {
  const topic = shortTopic(comment);
  if (intent === 'fixed') {
    return topic
      ? `Hola, gracias por avisar. Lo de «${topic}» ya quedó resuelto.`
      : 'Hola, gracias por avisar. Esto ya quedó resuelto.';
  }
  if (intent === 'planned') {
    return topic
      ? `Hola, gracias por avisar. Lo de «${topic}» lo tomamos y lo vamos a resolver.`
      : 'Hola, gracias por avisar. Lo tomamos y lo vamos a resolver.';
  }
  return topic
    ? `Hola, gracias por escribir. Para resolver lo de «${topic}» necesitamos la dirección y un poco más de detalle.`
    : 'Hola, gracias por escribir. Para poder resolverlo necesitamos la dirección y un poco más de detalle.';
}

export function CommentReply({
  comment,
  accountName,
  accountSlug,
}: {
  comment: string;
  accountName: string;
  accountSlug?: string;
}) {
  const [intent, setIntent] = useState<ReplyIntent>('planned');
  const [text, setText] = useState(() => replyDraft('planned', comment));
  const [copied, setCopied] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function choose(next: ReplyIntent) {
    setIntent(next);
    setText(replyDraft(next, comment));
    setCopied(false);
  }

  async function copy() {
    const value = text.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      return;
    } catch {
      const node = areaRef.current;
      if (!node) return;
      node.focus();
      node.select();
      setCopied(document.execCommand('copy'));
    }
  }

  return (
    <div className="reply-box">
      <p className="reply-as">
        <AccountLogo slug={accountSlug} size={18} />
        <span>
          Se contestaría como <strong>{accountName}</strong>. Todavía no se publica en la red.
        </span>
      </p>
      <div className="reply-intents" role="group" aria-label="Tipo de respuesta">
        {INTENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={intent === item.id ? 'on' : ''}
            aria-pressed={intent === item.id}
            onClick={() => choose(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <textarea
        ref={areaRef}
        className="reply-text"
        rows={3}
        value={text}
        aria-label="Texto de la respuesta"
        onChange={(event) => {
          setText(event.target.value);
          setCopied(false);
        }}
      />
      <button type="button" className="reply-copy" onClick={() => void copy()} disabled={!text.trim()}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}
