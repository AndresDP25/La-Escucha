import { describe, expect, it } from 'vitest';
import { buildCompareRows } from '../src/modules/analytics/compare';

describe('buildCompareRows', () => {
  it('pone los temas en orden y deja Otros al final, con ceros', () => {
    const rows = buildCompareRows(
      ['ciudad', 'argentina'],
      [
        { tenantId: 'ciudad', category: 'OTHER', count: 30 },
        { tenantId: 'ciudad', category: 'SECURITY', count: 4 },
        { tenantId: 'argentina', category: 'ATTACK', count: 2 },
      ],
    );

    expect(rows.map((row) => row.category)).toEqual([
      'POLITICS',
      'ATTACK',
      'SUPPORT',
      'SECURITY',
      'HEALTH',
      'PUBLIC_WORKS',
      'ENGAGEMENT',
      'OTHER',
    ]);
    expect(rows.find((row) => row.category === 'SECURITY')?.counts).toEqual({
      ciudad: 4,
      argentina: 0,
    });
    expect(rows.find((row) => row.category === 'ATTACK')?.counts.argentina).toBe(2);
    expect(rows.at(-1)?.category).toBe('OTHER');
  });

  it('ignora un tema o una cuenta que no entra en la comparación', () => {
    const rows = buildCompareRows(
      ['ciudad'],
      [{ tenantId: 'ajena', category: 'HEALTH', count: 9 }],
    );
    expect(rows.find((row) => row.category === 'HEALTH')?.counts).toEqual({
      ciudad: 0,
    });
  });
});
