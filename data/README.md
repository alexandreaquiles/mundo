# Dados curados

Estes arquivos são a **fonte da verdade** do jogo. São revisados à mão e versionados;
o build (`npm run build:data`) apenas os combina e valida — não busca nada na rede.

## Arquivos

| Arquivo | O que é |
|---|---|
| `capitals.pt-BR.json` | Os 195 países: capital em inglês, capital em pt-BR, latitude e longitude da capital |
| `countries.pt-BR.json` | Correções pt-BR dos nomes de país (o dataset de origem traz pt-PT) |
| `pt-pt-blocklist.json` | Formas de português europeu que nunca podem sobreviver ao build (guardado por teste) |
| `flag-confusables.json` | Grupos de bandeiras parecidas, usados para gerar distratores difíceis |

## Procedência

- **Nomes de país, capitais em inglês, região, sub-região, área** — [`world-countries`](https://www.npmjs.com/package/world-countries) v5.1.0 (**ODbL 1.0**).
  A licença está no campo `licenses` legado do `package.json`, que as ferramentas modernas ignoram;
  por isso este arquivo dizia "MIT" por um tempo. A ODbL é *share-alike*: veja [`../THIRD-PARTY.md`](../THIRD-PARTY.md).
  Atenção: `translations.por` é **português europeu**; por isso o `countries.pt-BR.json`.
  O pacote **não** tem `capitalInfo.latlng` — esse campo só existe na API REST Countries.
- **Coordenadas das capitais** — [Natural Earth](https://www.naturalearthdata.com/) `ne_10m_populated_places_simple`
  (domínio público), filtrando `adm0cap === 1` e casando por `adm0_a3`. 192 dos 195 casaram
  automaticamente; o restante foi preenchido à mão (campo `"source": "manual"`).
- **Bandeiras** — [`flag-icons`](https://github.com/lipis/flag-icons) v7.5.0 (MIT), SVGs 4x3.
- **Geometria do mapa** — [`world-atlas`](https://www.npmjs.com/package/world-atlas) v2.0.2 (ISC),
  TopoJSON derivado do Natural Earth.

## Escolhas editoriais

Países com mais de uma sede de governo — o jogo adota uma única resposta:

| País | Capital adotada | Por quê |
|---|---|---|
| África do Sul | Pretória | Capital administrativa; a mais ensinada no Brasil |
| Bolívia | Sucre | Capital constitucional |
| Costa do Marfim | Yamoussoukro | Capital oficial desde 1983 |
| Benin | Porto-Novo | Capital oficial (Cotonou é a sede do governo) |
| Tanzânia | Dodoma | Capital oficial desde 1996 |
| Essuatíni | Mbabane | Capital administrativa (Lobamba é a legislativa) |
| Burundi | Gitega | Capital política desde 2019 |
| Palau | Ngerulmud | Capital desde 2006 (o Natural Earth ainda traz Melekeok) |
| Palestina | Ramala | Sede da Autoridade Palestina |

## Roster

195 = 193 membros da ONU + 2 observadores permanentes (Vaticano e Palestina).
O campo `unMember` do `world-countries` marca o Vaticano incorretamente como membro, então
o build usa uma lista explícita e falha se o total não for exatamente 195.
