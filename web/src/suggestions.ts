import type { PostRow } from './api';
import { CATEGORY_LABEL } from './labels';

const THEME_ORDER = [
  'PUBLIC_WORKS',
  'SECURITY',
  'HEALTH',
  'POLITICS',
  'ATTACK',
  'SUPPORT',
  'ENGAGEMENT',
] as const;

export type ThemeAsk = {
  text: string;
  evidence: string;
  count: number;
  postId: string;
};

export type ThemeSuggestions = {
  category: string;
  label: string;
  asks: ThemeAsk[];
};

type Piece = {
  text: string;
  category: string;
  postId: string;
};

function commentBody(raw: string | null | undefined, clean: string, emojis: string[]): string {
  const source = raw?.trim() || clean;
  const body = source.replace(/\s+/g, ' ').trim();
  const faces = emojis.filter(Boolean).join(' ');
  if (body && faces && !body.includes(faces)) return `${body} ${faces}`;
  return body || faces;
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text: string, max = 140): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max).trimEnd()}…` : one;
}

function sentence(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '');
  const words = clean.split(' ').filter(Boolean);
  if (!clean || words.length > 10 || clean.length > 72) return null;
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)}.`;
}

const PLACE_STOP = new Set([
  'cansado',
  'cansada',
  'cansados',
  'foto',
  'fotos',
  'mandarle',
  'mandar',
  'porque',
  'gracias',
  'favor',
  'por',
  'ya',
  'siempre',
  'nunca',
  'mas',
  'ahi',
  'que',
  'con',
  'para',
  'este',
  'esta',
  'estan',
  'roto',
  'rota',
  'rotas',
  'rotos',
]);

function trimClause(rest: string): string {
  const cut = rest.split(/\b(ahi|porque|no puede|gracias|por favor|ahi es)\b/)[0] ?? rest;
  return cut.replace(/[.,;:]+$/, '').trim().split(' ').slice(0, 6).join(' ');
}

function placeName(raw: string): string {
  const words: string[] = [];
  for (const word of raw.split(' ').filter(Boolean)) {
    if (PLACE_STOP.has(word) || words.length >= 3) break;
    words.push(word);
  }
  while (words.length && ['de', 'del', 'en', 'y', 'a'].includes(words[words.length - 1])) {
    words.pop();
  }
  return words
    .map((word) => {
      if (word === 'caba' || word === 'gcba' || word === 'amba') return word.toUpperCase();
      if (word === 'de' || word === 'del' || word === 'y') return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function repairNoun(word: string): string {
  if (word.startsWith('calle')) return 'la calle';
  if (word.startsWith('vereda')) return 'las veredas';
  if (word.startsWith('bache') || word.startsWith('crater')) return 'los baches';
  if (word.startsWith('semaforo')) return 'los semáforos';
  if (word.startsWith('asfalto')) return 'el asfalto';
  return 'el alumbrado';
}

/** Pedido de obra: hace falta un verbo, no alcanza con nombrar la calle. */
function repairAsk(lower: string): string | null {
  const when = lower.match(
    /^(?:y\s+)?((?:las|los|la|el)\s+(?:veredas?|calles?|baches?|asfalto|alumbrado|semaforos?))\s+para cuando$/,
  );
  if (when) return sentence(`Arreglar ${when[1]}`);

  const verb = lower.match(
    /\b(?:arreglen|arreglar|reparen|reparar|asfalten|asfaltar|tapen|tapar|tapa)\s+(.+)/,
  );
  if (!verb) return null;
  const infra = verb[1].match(
    /\b(?:(?:las|los|la|el)\s+)?(veredas?|calles?|baches?|crateres?|asfalto|alumbrado|semaforos?)\b(?:\s+(?:de|del|en)\s+([a-z0-9ñ ]+))?/,
  );
  if (!infra) return null;
  const where = placeName(infra[2] ?? '');
  const noun = repairNoun(infra[1]);
  return sentence(where ? `Arreglar ${noun} de ${where}` : `Arreglar ${noun}`);
}

function asAdvice(raw: string, category: string): string | null {
  const plain = raw.replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = fold(plain);

  if (category === 'PUBLIC_WORKS') {
    const repair = repairAsk(lower);
    if (repair) return repair;
  }

  const money = lower.match(/(?:pongan|poner)\s+(?:mas\s+)?(?:plata|recursos|presupuesto)\s+en\s+(.+)/);
  if (money) return sentence(`Poner más recursos en ${trimClause(money[1])}`);

  const missing = lower.match(/(?:falta|faltan)\s+((?:de\s+)?(?:las|los|la|el)\s+\S+(?:\s+\S+){0,3})/);
  if (missing) {
    const thing = missing[1].replace(/^de\s+/, '');
    return sentence(`Resolver la falta de ${thing}`);
  }

  return null;
}

function titleName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function politicalAdvice(items: Piece[]): string | null {
  const against = new Map<string, number>();
  const favor = new Map<string, number>();
  const skip = new Set(['gobierno', 'politica', 'politico', 'candidato', 'gente', 'pais']);
  for (const item of items) {
    const lower = fold(item.text);
    for (const match of lower.matchAll(/\bno\s+(?:a|al)\s+([a-zñ]{3,})/g)) {
      if (!skip.has(match[1])) against.set(match[1], (against.get(match[1]) ?? 0) + 1);
    }
    for (const match of lower.matchAll(/\b(?:si|voto|voten)\s+(?:a|al|por)\s+([a-zñ]{3,})/g)) {
      if (!skip.has(match[1])) favor.set(match[1], (favor.get(match[1]) ?? 0) + 1);
    }
  }
  const pick = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mentioned = [...against.values(), ...favor.values()].reduce((sum, count) => sum + count, 0);
  if (mentioned < 2) return null;
  const no = pick(against);
  const yes = pick(favor);
  if (no && yes && no !== yes) {
    return `Los comentarios rechazan a ${titleName(no)} y acompañan a ${titleName(yes)}.`;
  }
  if (no) return `Los comentarios rechazan a ${titleName(no)}.`;
  if (yes) return `Los comentarios acompañan a ${titleName(yes)}.`;
  return null;
}

function piecesOf(posts: PostRow[]): Piece[] {
  const comments = posts.flatMap((post) =>
    post.comments.map((comment) => ({
      text: commentBody(comment.rawText, comment.cleanText, comment.emojis),
      category: comment.category,
      postId: post.id,
    })),
  );
  const tweets = posts
    .filter((post) => post.network === 'twitter' && post.caption?.trim() && post.category)
    .map((post) => ({
      text: post.caption?.trim() ?? '',
      category: post.category ?? 'OTHER',
      postId: post.id,
    }));
  return [...comments, ...tweets].filter(
    (piece) => piece.category !== 'OTHER' && piece.text.replace(/\s+/g, ' ').trim().length >= 8,
  );
}

function asksFrom(items: Piece[]): ThemeAsk[] {
  const groups = new Map<string, Piece[]>();
  for (const item of items) {
    const text = asAdvice(item.text, item.category);
    if (!text) continue;
    const list = groups.get(text) ?? [];
    list.push(item);
    groups.set(text, list);
  }
  return [...groups.entries()]
    .filter((entry) => entry[1].length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([text, group]) => ({
      text,
      evidence: clip(group[0].text),
      count: group.length,
      postId: group[0].postId,
    }));
}

export function buildThemeSuggestions(posts: PostRow[]): ThemeSuggestions[] {
  const pieces = piecesOf(posts);
  return THEME_ORDER.map((category) => {
    const items = pieces.filter((piece) => piece.category === category);
    const asks: ThemeAsk[] = [];
    if (category === 'POLITICS') {
      const line = politicalAdvice(items);
      if (line) {
        const sample = items.find((item) => /no\s+(?:a|al)\s+|voto|voten/i.test(fold(item.text))) ?? items[0];
        if (sample) {
          asks.push({
            text: line,
            evidence: clip(sample.text),
            count: items.length,
            postId: sample.postId,
          });
        }
      }
    }
    for (const ask of asksFrom(items)) {
      if (asks.some((item) => item.text === ask.text)) continue;
      asks.push(ask);
      if (asks.length >= 3) break;
    }
    return {
      category,
      label: CATEGORY_LABEL[category] ?? category,
      asks,
    };
  }).filter((theme) => theme.asks.length > 0);
}
