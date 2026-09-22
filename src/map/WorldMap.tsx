import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LngLat } from '../domain/types';
import { COUNTRIES } from '../data/countries';
import {
  IDENTITY_VIEW,
  clampView,
  createProjection,
  easeCubicInOut,
  lerpView,
  viewFitting,
  zoomAbout,
  type MapProjection,
  type View,
} from './projection';
import { loadWorld, type Quality, type WorldGeometry } from './geodata';
import { draw, type MicroMarker } from './renderer';

/** Tempo parado depois do gesto antes de trocar para a malha detalhada. */
const SETTLE_MS = 140;
const FLY_MS = 750;
const TAP_SLOP_PX = 8;
const TAP_MS = 350;

export interface WorldMapProps {
  guess: LngLat | null;
  truth: LngLat | null;
  truthLabel: string;
  /** `null` desliga a interação (durante a revelação). */
  onPick: ((at: LngLat) => void) | null;
  /** Reenquadra para mostrar palpite e resposta. */
  revealing: boolean;
  reducedMotion: boolean;
}

export function WorldMap({ guess, truth, truthLabel, onPick, revealing, reducedMotion }: WorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [worlds, setWorlds] = useState<Partial<Record<Quality, WorldGeometry>>>({});
  const [error, setError] = useState<string | null>(null);

  // Estes mudam a cada frame; ficam em refs para não re-renderizar o React.
  const viewRef = useRef<View>({ ...IDENTITY_VIEW });
  const qualityRef = useRef<Quality>('high');
  const arcRef = useRef(0);
  const dirtyRef = useRef(true);
  const frameRef = useRef(0);
  const settleTimer = useRef<number | undefined>(undefined);

  const mp: MapProjection | null = useMemo(
    () => (size.width > 0 && size.height > 0 ? createProjection(size.width, size.height) : null),
    [size.width, size.height],
  );

  /** Países que não têm polígono na resolução atual — desenhados como ponto. */
  const micro: MicroMarker[] = useMemo(() => {
    const world = worlds[qualityRef.current] ?? worlds.high ?? worlds.low;
    if (!world) return [];
    return COUNTRIES.filter((c) => !world.ids.has(c.ccn3)).map((c) => ({
      at: [c.centroidLng, c.centroidLat] as LngLat,
      label: c.name,
    }));
  }, [worlds]);

  const invalidate = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadWorld('low')
      .then((w) => !cancelled && setWorlds((prev) => ({ ...prev, low: w })))
      .catch(() => {});
    loadWorld('high')
      .then((w) => !cancelled && setWorlds((prev) => ({ ...prev, high: w })))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── laço de desenho ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mp) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(mp.width * dpr);
    canvas.height = Math.round(mp.height * dpr);
    canvas.style.width = `${mp.width}px`;
    canvas.style.height = `${mp.height}px`;
    dirtyRef.current = true;

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);
      if (!dirtyRef.current) return;
      const world = worlds[qualityRef.current] ?? worlds.high ?? worlds.low;
      if (!world) return;
      dirtyRef.current = false;
      draw(ctx, mp, {
        world,
        view: viewRef.current,
        micro,
        guess,
        truth: revealing ? truth : null,
        truthLabel,
        arcProgress: arcRef.current,
      }, dpr);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [mp, worlds, micro, guess, truth, truthLabel, revealing]);

  useEffect(invalidate, [guess, truth, revealing, micro, invalidate]);

  /** Troca para a malha leve durante o gesto e volta à detalhada no repouso. */
  const setInteracting = useCallback(
    (active: boolean) => {
      window.clearTimeout(settleTimer.current);
      if (active) {
        if (worlds.low) qualityRef.current = 'low';
      } else {
        settleTimer.current = window.setTimeout(() => {
          if (worlds.high) qualityRef.current = 'high';
          invalidate();
        }, SETTLE_MS);
      }
      invalidate();
    },
    [worlds, invalidate],
  );

  const setView = useCallback(
    (next: View) => {
      if (!mp) return;
      viewRef.current = clampView(next, mp);
      invalidate();
    },
    [mp, invalidate],
  );

  // ── revelação: anima o arco e reenquadra ───────────────────────────────
  useEffect(() => {
    if (!mp) return;
    if (!revealing || !guess || !truth) {
      arcRef.current = 0;
      invalidate();
      return;
    }
    const target = viewFitting([guess, truth], mp, Math.min(mp.width, mp.height) * 0.18);
    if (reducedMotion) {
      arcRef.current = 1;
      setView(target);
      return;
    }
    const from = { ...viewRef.current };
    const start = performance.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / FLY_MS);
      viewRef.current = lerpView(from, target, easeCubicInOut(t));
      arcRef.current = Math.min(1, t / 0.8);
      invalidate();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [revealing, guess, truth, mp, reducedMotion, setView, invalidate]);

  // reinicia o enquadramento quando uma nova rodada de pino começa
  useEffect(() => {
    if (!revealing && onPick && mp) {
      viewRef.current = { ...IDENTITY_VIEW };
      arcRef.current = 0;
      invalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truthLabel, mp]);

  // ── gestos ─────────────────────────────────────────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ dist: 0, mid: [0, 0] as [number, number], moved: 0, startedAt: 0 });

  const localPoint = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current.moved = 0;
      gesture.current.startedAt = performance.now();
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.dist = Math.hypot(b!.x - a!.x, b!.y - a!.y);
      gesture.current.mid = midpointLocal(a!, b!);
    }
    setInteracting(true);
  };

  const midpointLocal = (a: { x: number; y: number }, b: { x: number; y: number }): [number, number] =>
    localPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved += Math.hypot(dx, dy);

    if (pointers.current.size === 1) {
      setView({ ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy });
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(b!.x - a!.x, b!.y - a!.y);
      const mid = midpointLocal(a!, b!);
      const prevMid = gesture.current.mid;
      let next = zoomAbout(viewRef.current, mid, gesture.current.dist > 0 ? dist / gesture.current.dist : 1);
      next = { ...next, x: next.x + (mid[0] - prevMid[0]), y: next.y + (mid[1] - prevMid[1]) };
      gesture.current.dist = dist;
      gesture.current.mid = mid;
      setView(next);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setInteracting(false);

    const quick = performance.now() - gesture.current.startedAt < TAP_MS;
    if (wasSingle && onPick && mp && gesture.current.moved < TAP_SLOP_PX && quick) {
      const at = mp.apply(viewRef.current).invert?.(localPoint(e));
      if (at) onPick([at[0], at[1]]);
    }
  };

  // wheel precisa de listener não passivo para poder cancelar o scroll da página
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const rect = canvas.getBoundingClientRect();
      setView(zoomAbout(viewRef.current, [e.clientX - rect.left, e.clientY - rect.top], Math.exp(-px * 0.002)));
      setInteracting(true);
      setInteracting(false);
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [setView, setInteracting]);

  const zoomByButton = (factor: number) => {
    if (!mp) return;
    setView(zoomAbout(viewRef.current, [mp.width / 2, mp.height / 2], factor));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60;
    const v = viewRef.current;
    switch (e.key) {
      case 'ArrowLeft': setView({ ...v, x: v.x + step }); break;
      case 'ArrowRight': setView({ ...v, x: v.x - step }); break;
      case 'ArrowUp': setView({ ...v, y: v.y + step }); break;
      case 'ArrowDown': setView({ ...v, y: v.y - step }); break;
      case '+': case '=': zoomByButton(1.5); break;
      case '-': case '_': zoomByButton(1 / 1.5); break;
      case '0': setView({ ...IDENTITY_VIEW }); break;
      default: return;
    }
    e.preventDefault();
  };

  const loading = !worlds.low && !worlds.high;

  return (
    <div className="map" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="map__canvas"
        tabIndex={0}
        role="application"
        aria-label="Mapa-múndi. Toque para marcar onde fica a capital. Setas movem, mais e menos dão zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      />
      {loading && <p className="map__status">Carregando o mapa…</p>}
      {error && !loading && <p className="map__status map__status--error">{error}</p>}
      {onPick && (
      <div className="map__controls">
        <button type="button" onClick={() => zoomByButton(1.6)} aria-label="Aproximar">+</button>
        <button type="button" onClick={() => zoomByButton(1 / 1.6)} aria-label="Afastar">−</button>
        <button type="button" onClick={() => setView({ ...IDENTITY_VIEW })} aria-label="Recentralizar">⤢</button>
      </div>
      )}
    </div>
  );
}
