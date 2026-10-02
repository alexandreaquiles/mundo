# Terceiros

Este repositório **redistribui** arquivos de outros projetos, não só depende
deles. Isso muda a obrigação: licença como MIT e ISC exige que o aviso de
copyright acompanhe as cópias, e a ODbL exige mais do que isso.

O código do Mundo é MIT (veja `LICENSE`). O que está abaixo não é.

## Dados de países — ODbL 1.0, com share-alike

`data/capitals.pt-BR.json`, `data/countries.pt-BR.json` e o gerado
`src/data/countries.json` derivam de
[**world-countries**](https://github.com/mledoze/countries) v5.1.0 — nomes de
país, capitais em inglês, região e sub-região.

O pacote declara **ODbL-1.0**, e não MIT. A declaração está no campo `licenses`
legado do `package.json`, que as ferramentas modernas ignoram e mostram como
licença desconhecida — foi exatamente assim que este projeto passou um tempo
afirmando "MIT" no README.

A diferença é prática: a ODbL é *share-alike* para bancos de dados. Quem
publicar um banco derivado destes arquivos tem de atribuir a origem e oferecer
o derivado sob a mesma ODbL. Como o Mundo publica um banco derivado, estes
arquivos de dados vão sob ODbL 1.0, mesmo com o código em MIT.

Texto: <https://opendatacommons.org/licenses/odbl/1.0/>

## Coordenadas e geometria — domínio público

[**Natural Earth**](https://www.naturalearthdata.com/) — coordenadas das
capitais (`ne_10m_populated_places_simple`) e a geometria dos países.
Domínio público; sem obrigação, mas o crédito fica registrado.

## TopoJSON do mundo — ISC

`public/data/world-110m.json` e `public/data/world-50m.json` vêm de
[**world-atlas**](https://github.com/topojson/world-atlas), que empacota o
Natural Earth.

```
Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

## Bandeiras — MIT

Os 196 SVGs em `public/flags/` são cópias do
[**flag-icons**](https://github.com/lipis/flag-icons), com uma limpeza de
comentários e espaços feita por `scripts/build-flags.ts`. O desenho é deles.

```
The MIT License (MIT)

Copyright (c) 2013 Panayiotis Lipiridis

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Bibliotecas

As dependências de `package.json` (d3-geo, topojson-client, React, Vite e as
demais) não são redistribuídas neste repositório — `node_modules/` e `dist/`
não são versionados. Elas vão no bundle publicado, e suas licenças (ISC, MIT,
BSD) permitem isso; os textos acompanham cada pacote em `node_modules/`.
