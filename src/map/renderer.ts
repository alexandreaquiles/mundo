import { geoInterpolate, geoPath } from 'd3-geo';
import type { LngLat } from '../domain/types';
import type { MapProjection, View } from './projection';
import type { WorldGeometry } from './geodata';

export interface MicroMarker {
  at: LngLat;
  label: string;
}

export interface Scene {
  world: WorldGeometry;
  view: View;
  /** Países pequenos demais para virarem polígono nesta resolução. */
  micro: MicroMarker[];
  guess: LngLat | null;
  truth: LngLat | null;
  truthLabel: string;
  /** 0 a 1 — quanto do arco de grande círculo já foi desenhado. */
  arcProgress: number;
}

/**
 * A terra é clara e o oceano é escuro, e não os dois quase iguais.
 *
 * O que estava aqui antes dava 1,52 de contraste entre terra e oceano, contra
 * os 3,0 que um elemento gráfico precisa — os continentes mal se separavam da
 * água. Agora são 5,73, e as fronteiras saíram de 1,64 para os mesmos 5,73.
 *
 * Clarear a terra, porém, quebra todo marcador escolhido contra fundo escuro:
 * o pino do palpite caía de 6,97 para 1,28 em cima de um continente. Por isso
 * cada marcador ganhou uma casca escura própria (`casing`) e passou a carregar
 * o próprio contraste — é nela que ele encosta, não na terra. No oceano a
 * casca some, e quem separa é o marcador claro.
 */
const COLORS = {
  /** Fora da "lente" do Equal Earth — evita faixas mortas na tela do celular. */
  backdrop: '#0b1020',
  ocean: '#0e2439',
  land: '#78a0c4',
  /** Cor de água sobre a terra clara: separa país de país sem sujar. */
  border: '#0e2439',
  /** A casca escura que faz todo marcador ler sobre qualquer fundo. */
  casing: '#06101d',
  arc: '#ffc94d',
  guess: '#ffffff',
  truth: '#ff4d4d',
  micro: '#8fd0ff',
  label: '#f8fafc',
  labelShadow: 'rgba(3,10,18,0.9)',
};

const ARC_SAMPLES = 96;
/** Acima deste zoom os microestados já se veem sozinhos. */
const MICRO_MAX_K = 6;

function drawPin(
  ctx: CanvasRenderingContext2D,
  at: [number, number],
  color: string,
  scale = 1,
) {
  const [x, y] = at;
  const h = 22 * scale;
  const r = 7 * scale;
  ctx.save();
  ctx.beginPath();
  // gota: círculo no topo, ponta embaixo no ponto exato
  ctx.moveTo(x, y);
  ctx.lineTo(x - r * 0.8, y - h + r);
  ctx.arc(x, y - h + r, r, Math.PI, 0);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = COLORS.casing;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - h + r, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.casing;
  ctx.fill();
  ctx.restore();
}

/**
 * Onde centrar a etiqueta para ela não sair pela borda da tela.
 *
 * Centralizar no pino corta nomes longos perto da borda — "Bandar Seri
 * Begawan" saía pela direita. O pino já marca o ponto exato, então a etiqueta
 * pode escorregar para dentro sem enganar ninguém.
 *
 * Se a etiqueta for mais larga que a tela inteira não há posição boa; aí ela
 * fica centralizada e transborda dos dois lados por igual, que é menos ruim do
 * que transbordar só de um.
 */
export function clampLabelX(x: number, largura: number, limite: number): number {
  const margem = 4;
  const min = largura / 2 + margem;
  const max = limite - largura / 2 - margem;
  return max < min ? limite / 2 : Math.min(Math.max(x, min), max);
}

/**
 * @param limite largura da tela, para o rótulo não sair pela borda
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  at: [number, number],
  dy: number,
  limite: number,
) {
  ctx.save();
  ctx.font = '600 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 14;
  const x = clampLabelX(at[0], w, limite);
  const y = at[1] + dy;
  ctx.fillStyle = COLORS.labelShadow;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 11, w, 22, 11);
  ctx.fill();
  ctx.fillStyle = COLORS.label;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Desenha uma cena completa. Função pura — não olha para o React nem para
 * o DOM além do contexto que recebe.
 */
export function draw(ctx: CanvasRenderingContext2D, mp: MapProjection, scene: Scene, dpr: number) {
  const { world, view, micro, guess, truth, arcProgress } = scene;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // pinta a caixa toda: numa tela alta e estreita a lente do Equal Earth
  // não preenche o retângulo, e sobra branco se não fizermos isto
  ctx.fillStyle = COLORS.backdrop;
  ctx.fillRect(0, 0, mp.width, mp.height);

  const projection = mp.apply(view);
  const path = geoPath(projection, ctx);

  ctx.beginPath();
  path({ type: 'Sphere' });
  ctx.fillStyle = COLORS.ocean;
  ctx.fill();

  // toda a terra num único caminho: um fill só para 241 países
  ctx.beginPath();
  path(world.land);
  ctx.fillStyle = COLORS.land;
  ctx.fill();

  ctx.beginPath();
  path(world.borders);
  ctx.lineWidth = Math.max(0.3, 0.7 / Math.sqrt(view.k));
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();

  // Microestados são sub-pixel numa vista do mundo inteiro — alguns nem têm
  // polígono nesta resolução. Um ponto garante que todo país seja marcável.
  // Acima de MICRO_MAX_K o polígono real já aparece e o ponto sai de cena.
  if (micro.length > 0 && view.k < MICRO_MAX_K) {
    const fade = Math.min(1, (MICRO_MAX_K - view.k) / 2);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = COLORS.micro;
    ctx.strokeStyle = COLORS.casing;
    ctx.lineWidth = 1.5;
    for (const m of micro) {
      const p = projection(m.at);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (guess && truth && arcProgress > 0) {
    const along = geoInterpolate(guess, truth);
    const coordinates: LngLat[] = [];
    for (let i = 0; i <= ARC_SAMPLES; i++) {
      coordinates.push(along((i / ARC_SAMPLES) * arcProgress) as LngLat);
    }
    ctx.beginPath();
    // LineString em espaço esférico: o d3 reamostra ao longo do grande círculo
    path({ type: 'LineString', coordinates });
    ctx.setLineDash([7, 6]);
    // casca primeiro, âmbar por cima: o tracejado atravessa continentes claros
    // e sem ela desapareceria em cima deles
    ctx.lineWidth = 5;
    ctx.strokeStyle = COLORS.casing;
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.arc;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (guess) {
    const p = projection(guess);
    if (p) drawPin(ctx, p as [number, number], COLORS.guess);
  }
  if (truth && arcProgress >= 1) {
    const p = projection(truth);
    if (p) {
      drawPin(ctx, p as [number, number], COLORS.truth, 1.1);
      drawLabel(ctx, scene.truthLabel, p as [number, number], 18, mp.width);
    }
  }
}
