/**
 * Confere o wrangler.jsonc antes de tentar publicar.
 *
 * Existe por causa de um erro real: o `database_id` foi preenchido numa
 * máquina mas não commitado, e o CI só descobriu no fim do build, devolvendo
 * um código de erro da Cloudflare que não dizia o que fazer. Aqui a falha
 * acontece em segundos e diz exatamente qual é o passo que falta.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Problem {
  what: string;
  fix: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A binding que `worker/index.ts` e `worker/routes/scores.ts` usam. */
const EXPECTED_BINDING = 'DB';

/**
 * Remove comentários de linha inteira. Basta para este arquivo, que não tem
 * comentário no fim de linha nem `//` dentro de string — e é melhor do que um
 * parser de JSONC genérico que poderia estragar uma URL.
 */
function stripComments(jsonc: string): string {
  return jsonc.replace(/^\s*\/\/.*$/gm, '');
}

export function checkWranglerConfig(jsonc: string): Problem[] {
  let config: any;
  try {
    config = JSON.parse(stripComments(jsonc));
  } catch (err) {
    return [{ what: `wrangler.jsonc não é um JSON válido: ${(err as Error).message}`, fix: 'Revise o arquivo à mão.' }];
  }

  const databases = config.d1_databases;
  if (!Array.isArray(databases) || databases.length === 0) {
    return [{
      what: 'Não há nenhum banco D1 configurado.',
      fix: 'Rode `npm run setup:cloudflare` para criar o banco e gravar a configuração.',
    }];
  }

  const problems: Problem[] = [];

  // Mais de uma binding para o mesmo banco não quebra o deploy, mas é
  // configuração morta — foi assim que o painel da Cloudflare deixou o arquivo.
  if (databases.length > 1) {
    problems.push({
      what: `Há ${databases.length} bindings D1 (${databases.map((d: any) => d.binding).join(', ')}), e o Worker só usa \`env.${EXPECTED_BINDING}\`.`,
      fix: 'Deixe só a binding DB em wrangler.jsonc.',
    });
  }

  const db = databases.find((d: any) => d.binding === EXPECTED_BINDING);
  if (!db) {
    problems.push({
      what: `Nenhuma binding chamada "${EXPECTED_BINDING}" — é a que o Worker acessa.`,
      fix: `Renomeie a binding do banco para "${EXPECTED_BINDING}".`,
    });
    return problems;
  }

  const id = db.database_id;
  if (typeof id !== 'string' || id === '' || id === 'PREENCHER') {
    problems.push({
      what: 'O `database_id` do D1 não está preenchido no repositório.',
      fix: 'Rode `npm run setup:cloudflare` e **commite o wrangler.jsonc** — o deploy usa o arquivo versionado, não o da sua máquina.',
    });
  } else if (!UUID.test(id)) {
    problems.push({
      what: `O \`database_id\` não parece um UUID.`,
      fix: 'Confira o id com `npx wrangler d1 list`.',
    });
  }

  return problems;
}

/** Só roda a verificação quando chamado direto, não quando importado num teste. */
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const path = resolve(import.meta.dirname, '../wrangler.jsonc');
  const problems = checkWranglerConfig(readFileSync(path, 'utf8'));

  if (problems.length === 0) {
    console.log('✓ wrangler.jsonc pronto para publicar');
  } else {
    console.error('\n✗ O wrangler.jsonc não está pronto para publicar:\n');
    for (const p of problems) {
      console.error(`  • ${p.what}`);
      console.error(`    → ${p.fix}\n`);
    }
    process.exit(1);
  }
}
