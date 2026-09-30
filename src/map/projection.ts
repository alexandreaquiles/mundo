import { geoEqualEarth, type GeoProjection } from 'd3-geo';
import type { LngLat } from '../domain/types';
import frame from './view-frame.json';

/** Transformação de visualização: tela = k · (projeção base) + (x, y). */
export interface View {
  k: number;
  x: number;
  y: number;
}

export const IDENTITY_VIEW: View = { k: 1, x: 0, y: 0 };
export const K_MIN = 1;
export const K_MAX = 48;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface MapProjection {
  /** Reescreve escala e translação da projeção e a devolve pronta para uso. */
  apply(view: View): GeoProjection;
  baseScale: number;
  baseTranslate: [number, number];
  width: number;
  height: number;
}

/**
 * O meridiano central do mapa, em graus leste.
 *
 * Não é Greenwich, e isso é de propósito. Com centro em 0° a emenda do mapa
 * cai em 180°, bem no meio da Polinésia: Nova Zelândia e Fiji eram fatiadas ao
 * meio na borda, e Samoa e Kiribati apareciam do lado oposto do mapa em
 * relação aos vizinhos — quem procurasse Samoa perto de Fiji não achava.
 *
 * Em 30° a emenda vai para 150°O, Pacífico aberto. Os cortes caem de 5 países
 * do jogo para 3, e os que sobram são territórios ultramarinos que já são
 * ilhas soltas, não massas contínuas partidas. A capital mais espremida sai de
 * 0,5% da largura até a borda para 6% — e as Américas mantêm a forma, que é o
 * que 46° ou 150° teriam custado.
 *
 * O valor mora em `view-frame.json` porque os scripts em `e2e/` reconstroem
 * esta projeção por fora, em JavaScript puro, para cravar o pino. Repetir o
 * número lá seria uma bomba-relógio: divergir faria o palpite cair longe sem
 * ninguém entender por quê.
 */
export const CENTRAL_MERIDIAN = frame.centralMeridian;

/**
 * A faixa de latitudes que o mapa mostra. Fora dela não se desenha nem se
 * aceita palpite.
 *
 * A Antártida não tem capital, não tem país do jogo e nunca é resposta — e com
 * a terra clara ela virou a maior mancha da tela puxando o olho para o único
 * lugar que não interessa. O limite sul de -58° a tira inteira (a ponta da
 * península fica em -63°) e ainda deixa o Cabo Horn, em -56°, dentro.
 *
 * Ao norte, 84° guarda tudo: a capital mais setentrional é Reiquiavique, a
 * 64,2°, e a terra mais ao norte, na Groenlândia, chega a 83,6°.
 *
 * Isto **não aumenta o mapa** — a largura da tela é que limita, e recortar
 * latitude só tira altura. Quem aumenta é a tela cheia, sem margens.
 */
export const VIEW_BAND = { south: frame.south, north: frame.north };

/** O palpite tem de cair na faixa desenhada; fora dela não há mapa. */
export const insideBand = ([, lat]: LngLat): boolean =>
  lat >= VIEW_BAND.south && lat <= VIEW_BAND.north;

/**
 * Equal Earth: preserva áreas, então a intuição de distância que a pessoa
 * ganha no mapa é a mesma que o jogo usa para pontuar. E tem `invert`.
 *
 * O zoom não é uma transformação separada aplicada no canvas: ele é
 * absorvido pela própria projeção (escala e translação). Isso importa porque
 * `projection.invert` continua exato, sem precisar desfazer nada à mão —
 * com `s' = s·k` e `t' = t·k + d`, temos `raw·s·k + t·k + d = k·tela₀ + d`.
 *
 * A rotação entra antes de tudo isso e não atrapalha: ela é parte da projeção,
 * então `invert` continua desfazendo o caminho inteiro.
 */
export function createProjection(width: number, height: number): MapProjection {
  const projection = geoEqualEarth().rotate([-CENTRAL_MERIDIAN, 0]).fitExtent(
    [
      [0, 0],
      [width, height],
    ],
    { type: 'Sphere' },
  );
  const baseScale = projection.scale();
  const fitted = projection.translate() as [number, number];

  // Centraliza a FAIXA, não a esfera. A esfera centralizada empurra o mundo
  // habitado para cima, porque a Antártida ocupa boa parte da metade de baixo
  // e ela some do desenho.
  const meioDaFaixa = (projection([0, VIEW_BAND.north])![1] + projection([0, VIEW_BAND.south])![1]) / 2;
  const baseTranslate: [number, number] = [fitted[0], fitted[1] + (height / 2 - meioDaFaixa)];

  return {
    width,
    height,
    baseScale,
    baseTranslate,
    apply(view: View) {
      return projection
        .scale(baseScale * view.k)
        .translate([baseTranslate[0] * view.k + view.x, baseTranslate[1] * view.k + view.y]);
    },
  };
}

/** Zoom mantendo fixo o ponto de tela `anchor` (cursor ou centro do pinça). */
export function zoomAbout(view: View, anchor: [number, number], factor: number): View {
  const k = clamp(view.k * factor, K_MIN, K_MAX);
  const f = k / view.k; // fator efetivo depois do limite
  return {
    k,
    x: anchor[0] - f * (anchor[0] - view.x),
    y: anchor[1] - f * (anchor[1] - view.y),
  };
}

/**
 * Impede que o mapa saia de vista: o retângulo projetado do mundo tem
 * de continuar cobrindo boa parte da tela.
 */
export function clampView(view: View, mp: MapProjection): View {
  const worldW = mp.width * view.k;
  const worldH = mp.height * view.k;
  const maxOverhangX = Math.max(0, worldW - mp.width * 0.4);
  const maxOverhangY = Math.max(0, worldH - mp.height * 0.4);
  return {
    k: view.k,
    x: clamp(view.x, mp.width * 0.4 - worldW, maxOverhangX),
    y: clamp(view.y, mp.height * 0.4 - worldH, maxOverhangY),
  };
}

/** Zoom máximo usado na revelação: sem isso, um palpite exato zeraria o vão. */
export const K_MAX_REVEAL = 9;

/**
 * Enquadra dois pontos com folga.
 *
 * Feito na mão em vez de `fitExtent` porque precisamos do resultado no nosso
 * espaço {k, x, y} e de um teto de zoom: quando o palpite cai em cima da
 * capital o vão entre os pontos é zero e qualquer "ajuste ao conteúdo"
 * explodiria a escala.
 */
export function viewFitting(points: LngLat[], mp: MapProjection, padding: number): View {
  const base = mp.apply(IDENTITY_VIEW);
  const projected = points
    .map((p) => base(p))
    .filter((p): p is [number, number] => p !== null);
  if (projected.length === 0) return { ...IDENTITY_VIEW };

  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const availableW = Math.max(1, mp.width - padding * 2);
  const availableH = Math.max(1, mp.height - padding * 2);
  // piso no vão: dois pontos coincidentes não podem pedir zoom infinito
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const k = clamp(Math.min(availableW / spanX, availableH / spanY), K_MIN, K_MAX_REVEAL);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return clampView({ k, x: mp.width / 2 - k * centerX, y: mp.height / 2 - k * centerY }, mp);
}

export const lerpView = (a: View, b: View, t: number): View => ({
  k: a.k + (b.k - a.k) * t,
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const easeCubicInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
