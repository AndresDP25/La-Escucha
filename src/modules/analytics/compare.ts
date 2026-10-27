/**
 * Orden de la comparación entre cuentas.
 * Los temas que importan para leer el clima van primero.
 * "Otros" cierra: suele ser la mayoría y no encabeza la lectura.
 */
export const COMPARE_THEMES = [
  'POLITICS',
  'ATTACK',
  'SUPPORT',
  'SECURITY',
  'HEALTH',
  'PUBLIC_WORKS',
  'ENGAGEMENT',
  'OTHER',
] as const;

export type CompareTheme = (typeof COMPARE_THEMES)[number];

export interface CompareGroup {
  tenantId: string;
  category: string;
  count: number;
}

export interface CompareRow {
  category: CompareTheme;
  counts: Record<string, number>;
}

/** Arma una fila por tema, con cero donde esa cuenta no tuvo comentarios. */
export function buildCompareRows(
  accountIds: string[],
  grouped: CompareGroup[],
): CompareRow[] {
  return COMPARE_THEMES.map((category) => {
    const counts: Record<string, number> = {};
    for (const id of accountIds) counts[id] = 0;
    for (const row of grouped) {
      if (row.category !== category) continue;
      if (!(row.tenantId in counts)) continue;
      counts[row.tenantId] = row.count;
    }
    return { category, counts };
  });
}
