/**
 * Tests unitarios del procesamiento de texto y la privacidad.
 * Ejecutar con: npm test
 */
import { describe, it, expect } from 'vitest';
import {
  processText,
  normalizeText,
  extractEmojis,
} from '../src/core/text/text-processor';
import { scrubPII } from '../src/core/privacy/anonymizer';

describe('normalizeText', () => {
  it('pasa a minusculas y remueve acentos y signos', () => {
    expect(normalizeText('¡Qué BACHE más grande!')).toBe('que bache mas grande');
  });

  it('remueve URLs, menciones y hashtags', () => {
    const result = normalizeText('Mira @vecino esto https://x.com #SanFernando');
    expect(result).toBe('mira esto');
  });
});

describe('extractEmojis', () => {
  it('aisla los emojis del texto', () => {
    expect(extractEmojis('Buenisimo 👏😊')).toEqual(['👏', '😊']);
  });
});

describe('processText', () => {
  it('devuelve texto limpio sin stop-words', () => {
    const { clean } = processText('El bache de la calle es un desastre');
    expect(clean).toContain('bache');
    expect(clean).toContain('desastre');
    expect(clean).not.toContain('el');
    expect(clean).not.toContain('la');
  });
});

describe('scrubPII', () => {
  it('enmascara email, telefono y menciones', () => {
    const result = scrubPII('Escribime a juan@mail.com o al 11 2345-6789 @juan');
    expect(result).toContain('[EMAIL]');
    expect(result).toContain('[TEL]');
    expect(result).toContain('[USUARIO]');
  });
});
