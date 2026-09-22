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
npm test          # 842 testes: dados, pontuação, sorteio, projeção, máquina de estados, API
npm run build     # build de produção
npm run preview   # serve o build, com service worker ativo
npm run e2e       # joga uma partida inteira num Chromium e guarda as telas em e2e/screenshots/
```

## Implantação no Cloudflare

É um Worker só, servindo o SPA e a API na mesma origem. Sem CORS, um deploy só.

O que você precisa fazer à mão, uma vez:

```bash
npx wrangler login
npx wrangler d1 create mundo-scores        # copie o database_id que ele imprime
```

Cole o `database_id` em `wrangler.jsonc` (está marcado como `PREENCHER`). Depois:

```bash
npx wrangler d1 migrations apply mundo-scores --remote
npm run deploy
```

Sem o `database_id` o jogo implanta e funciona; só o ranking fica indisponível.

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
