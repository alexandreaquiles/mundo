import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkWranglerConfig } from '../scripts/check-deploy-config';

const root = resolve(import.meta.dirname, '..');

/** Monta um wrangler.jsonc com as bindings D1 que o teste quiser. */
const config = (d1: unknown) => `{
  // um comentário de linha inteira, como o arquivo de verdade tem
  "name": "mundo",
  "main": "worker/index.ts",
  "d1_databases": ${JSON.stringify(d1)},
  "vars": { "APP_VERSION": "1.0.0" }
}`;

const ok = { binding: 'DB', database_name: 'mundo-scores', database_id: '2f9a1c40-31b8-4d7e-9a02-5c6b8e1f0d33' };

describe('checkWranglerConfig', () => {
  it('aprova uma configuração correta', () => {
    expect(checkWranglerConfig(config([ok]))).toEqual([]);
  });

  it('pega o database_id não commitado, que foi o erro real', () => {
    const problems = checkWranglerConfig(config([{ ...ok, database_id: 'PREENCHER' }]));
    expect(problems).toHaveLength(1);
    expect(problems[0]!.what).toContain('não está preenchido');
    expect(problems[0]!.fix).toContain('commite');
  });

  it('pega o id vazio e o que não é UUID', () => {
    expect(checkWranglerConfig(config([{ ...ok, database_id: '' }]))[0]!.what).toContain('não está preenchido');
    expect(checkWranglerConfig(config([{ ...ok, database_id: 'abc123' }]))[0]!.what).toContain('UUID');
  });

  it('pega a binding duplicada que o painel da Cloudflare cria', () => {
    const problems = checkWranglerConfig(config([ok, { ...ok, binding: 'mundo_scores' }]));
    expect(problems).toHaveLength(1);
    expect(problems[0]!.what).toContain('2 bindings');
    expect(problems[0]!.what).toContain('mundo_scores');
  });

  it('pega a binding com nome errado', () => {
    const problems = checkWranglerConfig(config([{ ...ok, binding: 'BANCO' }]));
    expect(problems.some((p) => p.what.includes('"DB"'))).toBe(true);
  });

  it('pega a ausência de banco', () => {
    expect(checkWranglerConfig(config([]))[0]!.what).toContain('nenhum banco');
    expect(checkWranglerConfig('{ "name": "mundo" }')[0]!.what).toContain('nenhum banco');
  });

  it('não engasga com JSON quebrado', () => {
    const problems = checkWranglerConfig('{ isso não é json }');
    expect(problems).toHaveLength(1);
    expect(problems[0]!.what).toContain('não é um JSON válido');
  });

  /** O que realmente importa: o arquivo que está no repositório agora. */
  it('aprova o wrangler.jsonc versionado', () => {
    expect(checkWranglerConfig(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8'))).toEqual([]);
  });
});
