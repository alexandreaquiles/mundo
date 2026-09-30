import { describe, expect, it } from 'vitest';
import { clampLabelX } from '../src/map/renderer';

describe('clampLabelX', () => {
  const TELA = 358;

  it('deixa a etiqueta onde está quando ela cabe', () => {
    expect(clampLabelX(180, 120, TELA)).toBe(180);
  });

  it('puxa para dentro quando o pino está na borda direita', () => {
    // "Bandar Seri Begawan" num pino colado na borda: era o nome saindo da tela
    const x = clampLabelX(350, 160, TELA);
    expect(x + 160 / 2).toBeLessThanOrEqual(TELA);
    expect(x).toBeLessThan(350);
  });

  it('puxa para dentro quando o pino está na borda esquerda', () => {
    const x = clampLabelX(6, 160, TELA);
    expect(x - 160 / 2).toBeGreaterThanOrEqual(0);
    expect(x).toBeGreaterThan(6);
  });

  it('centraliza quando a etiqueta é mais larga que a tela', () => {
    // sem posição boa, transbordar por igual é menos ruim que só de um lado
    expect(clampLabelX(10, 500, TELA)).toBe(TELA / 2);
  });

  it('nunca devolve NaN nem sai da tela para nomes reais', () => {
    for (const largura of [40, 90, 160, 220]) {
      for (const x of [-50, 0, 100, 179, 358, 900]) {
        const r = clampLabelX(x, largura, TELA);
        expect(Number.isFinite(r)).toBe(true);
        expect(r - largura / 2).toBeGreaterThanOrEqual(-1);
        expect(r + largura / 2).toBeLessThanOrEqual(TELA + 1);
      }
    }
  });
});
