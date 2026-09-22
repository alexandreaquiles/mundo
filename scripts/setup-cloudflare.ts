/**
 * Primeiro deploy na Cloudflare, num comando só.
 *
 * Cria o banco D1 (ou reaproveita o que já existe), escreve o `database_id`
 * no wrangler.jsonc, aplica as migrations e publica.
 *
 * Idempotente: pode rodar de novo sem medo. O que já estiver pronto é pulado.
 *
 *   npx wrangler login      # uma vez
 *   npm run setup:cloudflare
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const CONFIG = resolve(root, 'wrangler.jsonc');
const DB_NAME = 'mundo-scores';
const PLACEHOLDER = 'PREENCHER';

const step = (msg: string) => console.log(`\n\x1b[1m▸ ${msg}\x1b[0m`);
const ok = (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);

function wrangler(args: string[], opts: { capture?: boolean } = {}): string {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: opts.capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  }) ?? '';
}

function die(message: string, hint?: string): never {
  console.error(`\n\x1b[31m✗ ${message}\x1b[0m`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

// ── 1. autenticação ────────────────────────────────────────────────────────
step('Conferindo a autenticação');
{
  // `wrangler whoami` sai com código 0 mesmo deslogado, então o jeito de
  // saber é ler a saída.
  let out = '';
  try {
    out = wrangler(['whoami'], { capture: true });
  } catch {
    die('Não consegui rodar o wrangler.', 'O `npm install` rodou?');
  }
  process.stdout.write(out);
  if (/not authenticated|não autenticado/i.test(out)) {
    die('O wrangler não está autenticado.', 'Rode `npx wrangler login` e tente de novo.');
  }
}

// ── 2. banco D1 ────────────────────────────────────────────────────────────
step(`Procurando o banco "${DB_NAME}"`);

/** O `d1 create` não tem `--json`, então lemos o id sempre pelo `d1 list`. */
function findDatabaseId(): string | null {
  let raw: string;
  try {
    raw = wrangler(['d1', 'list', '--json'], { capture: true });
  } catch {
    die('Não consegui listar os bancos D1.', 'A conta tem acesso a D1? Verifique as permissões do token.');
  }
  // o wrangler pode imprimir avisos antes do JSON; pegamos do primeiro colchete
  const start = raw.indexOf('[');
  if (start === -1) return null;
  const list = JSON.parse(raw.slice(start)) as { uuid: string; name: string }[];
  return list.find((db) => db.name === DB_NAME)?.uuid ?? null;
}

let databaseId = findDatabaseId();

if (databaseId) {
  ok(`já existe: ${databaseId}`);
} else {
  step(`Criando o banco "${DB_NAME}"`);
  wrangler(['d1', 'create', DB_NAME]);
  databaseId = findDatabaseId();
  if (!databaseId) {
    die('Criei o banco mas não achei o id depois.', 'Rode `npx wrangler d1 list` e cole o uuid no wrangler.jsonc à mão.');
  }
  ok(`criado: ${databaseId}`);
}

// ── 3. wrangler.jsonc ──────────────────────────────────────────────────────
/** Se o arquivo mudou, o lembrete de commitar tem de ser a última coisa na tela. */
let configChanged = false;

step('Atualizando o wrangler.jsonc');
const config = readFileSync(CONFIG, 'utf8');

// Substituição pontual em vez de parse + serialize, para não perder os
// comentários do arquivo (é JSONC, não JSON).
const pattern = /("database_id"\s*:\s*")([^"]*)(")/;
const current = config.match(pattern)?.[2];

if (current === undefined) {
  die('Não achei "database_id" no wrangler.jsonc.', 'O arquivo foi reestruturado? Ajuste o id à mão.');
} else if (current === databaseId) {
  ok('já estava com o id certo');
} else {
  if (current !== PLACEHOLDER) {
    console.log(`  \x1b[33m!\x1b[0m trocando o id anterior (${current}) pelo do banco encontrado`);
  }
  writeFileSync(CONFIG, config.replace(pattern, `$1${databaseId}$3`));
  ok(`gravado: ${databaseId}`);
  configChanged = true;
}

// ── 4. migrations ──────────────────────────────────────────────────────────
step('Aplicando as migrations no banco remoto');
wrangler(['d1', 'migrations', 'apply', DB_NAME, '--remote']);

// ── 5. build e deploy ──────────────────────────────────────────────────────
step('Build');
execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });

step('Publicando');
wrangler(['deploy']);

console.log('\n\x1b[32mPronto.\x1b[0m A URL do Worker está logo acima.');

if (configChanged) {
  // Este foi um erro real: o id ficou só na máquina e o deploy pelo CI, que
  // usa o arquivo versionado, falhou depois com um erro da Cloudflare.
  console.log(`
\x1b[43;30m FALTA UM PASSO \x1b[0m

  O database_id foi gravado no wrangler.jsonc, mas só na sua máquina.
  O deploy pelo GitHub Actions usa o arquivo \x1b[1mversionado\x1b[0m:

      git add wrangler.jsonc
      git commit -m "Registra o database_id do D1"
      git push
`);
}
