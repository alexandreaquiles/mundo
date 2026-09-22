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

const COLORS = {
  /** Fora da "lente" do Equal Earth — evita faixas mortas na tela do celular. */
  backdrop: '#0d1c2c',
  ocean: '#14283d',
  land: '#2b4560',
  landEdge: '#16293d',
  border: '#12222f',
  graticule: 'rgba(255,255,255,0.05)',
  arc: '#f4b942',
  guess: '#9fb3c8',
  truth: '#ef4444',
  micro: '#4d7ea8',
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
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(3,10,18,0.55)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - h + r, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(3,10,18,0.55)';
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, at: [number, number], dy: number) {
  ctx.save();
  ctx.font = '600 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 14;
  const x = at[0];
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
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.landEdge;
  ctx.stroke();

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
    for (const m of micro) {
      const p = projection(m.at);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
      ctx.fill();
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
      drawLabel(ctx, scene.truthLabel, p as [number, number], 18);
    }
  }
}
