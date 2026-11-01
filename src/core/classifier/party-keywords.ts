/**
 * Diccionario para cuentas de un partido.
 * Crítica pesa más que política: si el comentario ataca, se lee como crítica
 * y el texto original se conserva. Política sola marca el comentario como sensible.
 */
export type PartyKeywordGroup = {
  category:
    | 'SECURITY'
    | 'PUBLIC_WORKS'
    | 'HEALTH'
    | 'POLITICS'
    | 'SUPPORT'
    | 'ENGAGEMENT'
    | 'ATTACK';
  patterns: string[];
  weight?: number;
};

export const PARTY_KEYWORDS: PartyKeywordGroup[] = [
  {
    category: 'ATTACK',
    weight: 3,
    patterns: [
      'fraude',
      'decepcion',
      'dictadura',
      'dictatorial',
      'traicion',
      'infeliz',
      'desastre',
      'tibieza',
      'mentira',
      'corrupto',
      'corrupcion',
      'verguenza',
      'cocinado',
    ],
  },
  {
    category: 'SUPPORT',
    weight: 2,
    patterns: ['excelente', 'gracias', 'felicitaciones', 'fuerza', 'genial', 'bravo', 'ojala'],
  },
  {
    category: 'SECURITY',
    weight: 2,
    patterns: ['inseguridad', 'robo', 'robaron', 'chorro', 'chorros', 'carcel', 'preso', 'presos', 'policia'],
  },
  {
    category: 'HEALTH',
    weight: 3,
    patterns: ['salud', 'hospital', 'suicid'],
  },
  {
    category: 'PUBLIC_WORKS',
    weight: 2,
    patterns: ['plaza', 'obra', 'bache', 'vereda', 'inmobiliario'],
  },
  {
    category: 'POLITICS',
    weight: 1,
    patterns: [
      'macri',
      'milei',
      'peron',
      'eleccion',
      'elecciones',
      'candidato',
      'presidente',
      'concejal',
      'intendente',
      'partido',
      'gobierno',
      'politico',
      'politica',
    ],
  },
];
