# Mundo

Jogo de geografia em português: aparece uma bandeira, você diz de que país é,
depois qual é a capital, e por fim marca no mapa onde essa capital fica.
Quinze rodadas, os 195 países soberanos, ranking global.

É uma PWA instalável que roda offline e é implantada no Cloudflare.

## Como o jogo funciona

Cada rodada tem três etapas encadeadas. Errar encerra a rodada ali — aparece
a resposta certa por alguns segundos e a próxima bandeira entra.

| Etapa | Pontos |
|---|---|
| Acertar o país da bandeira | 10 |
| Acertar a capital | 10 |
| Marcar a capital no mapa | 0 a 100 |

O pino vale 100 pontos se cair a menos de 25 km da capital, e vai caindo
exponencialmente até zerar aos 5.000 km. A distância é de grande círculo
(haversine), não a distância na tela.

Máximo por rodada: **120**. Partida perfeita: **1800**.

## Rodando

Precisa de Node 22.

```bash
npm install
npm run build:data                       # gera os dados, o mapa e as bandeiras
npx wrangler d1 execute mundo-scores --local --file=migrations/0001_create_scores.sql
npm run dev                              # SPA e /api juntos, em http://localhost:5173
```

O `@cloudflare/vite-plugin` roda o Worker dentro do servidor do Vite, com um D1
local de verdade em `.wrangler/state`. Não é preciso subir dois processos.

```bash
npm test          # 877 testes: dados, pontuação, sorteio, projeção, máquina de estados, API
npm run build     # build de produção
npm run preview   # serve o build, com service worker ativo
```

O `npm run e2e` joga uma partida inteira num Chromium e guarda as telas em
`e2e/screenshots/`. Ele **não sobe o servidor** — precisa do `npm run dev` rodando
noutro terminal. Para apontar para outro endereço (o `npm run preview`, por
exemplo), passe a URL:

```bash
npm run e2e                                # usa http://localhost:5173/
npm run e2e -- http://localhost:4173/      # o preview
```

Na primeira vez pode ser preciso baixar o navegador com `npx playwright install chromium`.

## Implantação no Cloudflare

É um Worker só, servindo o SPA e a API na mesma origem. Sem CORS, um deploy só.

### Passo obrigatório: o banco D1

O ranking precisa de um banco D1, e criar um exige a sua conta. Enquanto ele não
existir, `wrangler.jsonc` fica com `database_id: "PREENCHER"` e o deploy **recusa
sair** — de propósito, para não publicar um jogo com o ranking quebrado.

Um comando resolve tudo (criar o banco, gravar o id no `wrangler.jsonc`, aplicar as
migrations, buildar e publicar):

```bash
npx wrangler login          # uma vez, abre o navegador
npm run setup:cloudflare
git commit -am "Registra o database_id do D1"
```

O script é idempotente: se o banco já existir, ele reaproveita; se o id já estiver
gravado, ele pula. Dá para rodar de novo sem medo.

**O commit não é opcional.** O deploy pelo CI usa o `wrangler.jsonc` versionado, não o
da sua máquina — se o id ficar só local, o build roda inteiro e a Cloudflare recusa no
fim com o erro `10021`. O `npm run check:deploy` confere isso em segundos, e o workflow
o executa logo depois do `npm ci`.

O workflow aplica as migrations do D1 **antes** de publicar. Na ordem inversa a
produção ficaria com código novo e banco velho no intervalo entre os dois passos.

### Deploys seguintes

Da sua máquina:

```bash
npm run deploy              # confere a config, builda e publica
```

Ou automático, pelo GitHub Actions: `.github/workflows/deploy.yml` roda typecheck,
testes e build a cada push na `main`, e só então publica. Para ligar, guarde dois
segredos no repositório (Settings → Secrets and variables → Actions):

| Segredo | Onde achar |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [Criar token](https://dash.cloudflare.com/profile/api-tokens) com o modelo **Edit Cloudflare Workers**, mais permissão de leitura/escrita em **D1** |
| `CLOUDFLARE_ACCOUNT_ID` | Canto direito da página inicial do painel, ou `npx wrangler whoami` |

O workflow também confere que os arquivos gerados batem com os versionados — se
alguém editar `src/data/countries.json` à mão, o deploy falha em vez de publicar
um dado que ninguém consegue reproduzir.

## Como está montado

```
data/          dados curados à mão (capitais em pt-BR, coordenadas, correções)
scripts/       pipeline offline que transforma os dados em assets
src/domain/    regras do jogo — puras, sem React, cobertas por testes
src/map/       projeção, gestos e renderização em canvas
src/screens/   as telas
worker/        Worker do Cloudflare: /api e os arquivos estáticos
```

A camada `src/domain` não conhece React nem o DOM: pontuação, sorteio e a
máquina de estados são funções puras, e é por isso que dá para testar uma
partida inteira sem montar um componente.

### O mapa

Projeção **Equal Earth**, que preserva áreas — importante porque o jogo pontua
por distância real, e num Mercator a pessoa aprenderia a geografia errada.

O zoom não é uma transformação aplicada no canvas: ele é absorvido pela própria
projeção, reescrevendo escala e translação. Como `tela = raw·(s·k) + (t·k + d)`
é igual a `k·tela₀ + d`, `projection.invert` continua exato e o pino não precisa
desfazer transformação nenhuma à mão. Um teste confere ida e volta nas 195
capitais, em quatro níveis de zoom e dois tamanhos de tela.

O mapa vem em duas resoluções: a de 110m é desenhada durante o gesto e a de 50m
no repouso, o que mantém a pinça fluida em celular.

### Os dados

195 países: 193 membros da ONU mais Vaticano e Palestina. Tudo o que o jogo usa
é gerado em build time a partir de arquivos versionados — nenhuma chamada de
rede no build, nenhum dataset pesado no bundle.

Duas armadilhas que valem registro, porque não são óbvias:

- O `world-countries` **não tem** coordenada de capital (`capitalInfo.latlng` é
  coisa da API REST Countries, não do pacote npm). As coordenadas vêm do
  Natural Earth, com 12 linhas corrigidas à mão onde o dataset aponta para a
  maior cidade em vez da capital oficial.
- As traduções do `world-countries` são **português europeu**. Há um mapa de
  correções pt-BR e um teste com lista de bloqueio que quebra o build se uma
  forma como "Polónia" ou "Vietname" voltar a aparecer.

Os detalhes e a procedência estão em [`data/README.md`](data/README.md).

## Sobre o ranking

Tem URL própria (`/ranking`), então dá para compartilhar o link — o Worker serve
o `index.html` para qualquer caminho fora de `/api`, e o roteamento no cliente é
History API pura, sem dependência.

**Uma linha por jogador.** A lista mostra a melhor partida de cada um, com a
contagem de quantas jogou; tocar em "N partidas" expande as outras.

Quem identifica a pessoa é um `player_id` anônimo gerado no navegador dela, não
o nome — o nome é só o rótulo, e pertence ao primeiro aparelho que o usar. Assim
ninguém toma a sua linha digitando o seu nome, e não há nada para criar ou
lembrar. O preço é que aparelho novo é jogador novo; foi a troca escolhida para
não ter cadastro.

Partidas anteriores a essa mudança ficaram com `player_id` nulo e continuam
agrupadas por nome. Quem reivindicar aquele nome herda essas partidas — é o que
a migration `0002` prepara.

A ordem total (`score DESC, duration_ms ASC, created_at ASC`) vive numa constante
única no Worker porque a listagem e o cálculo de posição **precisam** concordar:
se divergirem, o "você está em 12º" aponta para a linha errada e a janela de
vizinhos desloca junto.

Quem não aparece na página carregada vê a própria vizinhança num bloco à parte,
em vez de não se achar no ranking.

O jogo roda inteiro no navegador, então **não há como provar que uma pontuação
enviada é real** — quem abrir o DevTools consegue mandar o número que quiser.
O que existe é proporcional ao problema: validação de faixa e formato, recusa
de requisições de outra origem, limite de envios por IP (guardado como hash
diário, nunca o IP em si) e uma coluna `hidden` para esconder abuso na mão.

Tornar isso à prova de trapaça exigiria o servidor sortear e guardar cada
rodada, o que transformaria um jogo que funciona offline num jogo que só
funciona online. Não valeu a troca.

## Créditos dos dados

- [Natural Earth](https://www.naturalearthdata.com/) — geometria dos países e coordenadas das capitais (domínio público)
- [world-countries](https://github.com/mledoze/countries) — nomes, capitais, regiões (MIT)
- [world-atlas](https://github.com/topojson/world-atlas) — TopoJSON pronto (ISC)
- [flag-icons](https://github.com/lipis/flag-icons) — as bandeiras (MIT)
