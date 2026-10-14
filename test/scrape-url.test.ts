import { describe, expect, it } from 'vitest';
import { normalizeHandle, toInstagramUrl } from '../src/modules/scraping/scraping.service';

describe('toInstagramUrl', () => {
  it('arma la URL de un usuario', () => {
    expect(toInstagramUrl('@sanfermunicipio')).toBe(
      'https://www.instagram.com/sanfermunicipio/',
    );
  });

  it('saca el usuario de una URL', () => {
    expect(normalizeHandle('https://www.instagram.com/sanfermunicipio/')).toBe(
      'sanfermunicipio',
    );
  });

  it('deja pasar una URL que ya viene armada', () => {
    expect(toInstagramUrl('https://www.instagram.com/sanfermunicipio/')).toBe(
      'https://www.instagram.com/sanfermunicipio/',
    );
  });
});
