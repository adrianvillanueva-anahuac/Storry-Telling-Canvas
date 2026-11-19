import React, { useEffect, useMemo, useRef } from 'react';
import { CanvasStyleSettings } from '../types/workflow';

interface ReactiveDotGridProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  panRef: React.RefObject<{ x: number; y: number }>;
  zoomRef: React.RefObject<number>;
  zoomTrigger: number;
  onRegisterRender?: (fn: (() => void) | null) => void;
  styleSettings: CanvasStyleSettings;
}

interface DotWakeState {
  energy: number;
  ox: number;
  oy: number;
  tx: number;
  ty: number;
}

interface AuroraTrailNode {
  worldX: number;
  worldY: number;
  strength: number;
  angle: number;
  stretch: number;
  radiusMul: number;
}

interface ThemeSprites {
  fourPointStar: HTMLCanvasElement;
}

const WORLD_GRID_STEP = 24;
const BASE_CURSOR_RADIUS_PX = 240; // Proportional cursor field radius
const BASE_EXTRA_RADIUS = 0.95; // Subtle dot growth at working zoom
const DECAY_EPSILON = 0.0025;
const OFFSET_EPSILON = 0.035;
const MAX_AURORA_NODES = 24;

// Starry sky transition window: 48% down to 28% zoom
const STARFIELD_START_ZOOM = 0.48;
const STARFIELD_FULL_ZOOM = 0.28;
const STARFIELD_SURVIVAL_THRESHOLD = 0.72; // ~28% of dots survive as stars

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function getParityVisibility(ix: number, iy: number, zoom: number): number {
  if ((ix & 1) !== 0 || (iy & 1) !== 0) {
    if (zoom >= 0.58) return 1;
    if (zoom <= 0.40) return 0;
    return smoothstep01((zoom - 0.40) / (0.58 - 0.40));
  }
  if ((ix & 2) !== 0 || (iy & 2) !== 0) {
    if (zoom >= 0.31) return 1;
    if (zoom <= 0.22) return 0;
    return smoothstep01((zoom - 0.22) / (0.31 - 0.22));
  }
  return 1;
}

function dotRandomHash(ix: number, iy: number): number {
  let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function packGridKey(ix: number, iy: number): number {
  return (ix + 16384) * 65536 + (iy + 16384);
}

function unpackGridKey(key: number): [number, number] {
  const ix = Math.floor(key / 65536) - 16384;
  const iy = (key % 65536) - 16384;
  return [ix, iy];
}

type RgbTuple = [number, number, number];

function parseHexColor(hex: string, fallback: RgbTuple): RgbTuple {
  const clean = (hex || '').trim().replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
  } else if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
  }
  return fallback;
}

function mixRgb(a: RgbTuple, b: RgbTuple, t: number): RgbTuple {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
  ];
}

function createFourPointStarSprite(nearRgb: RgbTuple, isDark: boolean): HTMLCanvasElement {
  const size = 64;
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const pad = 6;
    const waist = 1.35;
    const core = mixRgb(nearRgb, [255, 255, 255], isDark ? 0.35 : 0.45);
    const starGrad = ctx.createRadialGradient(half, half, 0, half, half, half - pad);
    starGrad.addColorStop(
      0,
      `rgba(${core[0]}, ${core[1]}, ${core[2]}, ${isDark ? 0.92 : 0.94})`
    );
    starGrad.addColorStop(
      0.35,
      `rgba(${nearRgb[0]}, ${nearRgb[1]}, ${nearRgb[2]}, ${isDark ? 0.58 : 0.62})`
    );
    starGrad.addColorStop(
      0.75,
      `rgba(${nearRgb[0]}, ${nearRgb[1]}, ${nearRgb[2]}, ${isDark ? 0.14 : 0.16})`
    );
    starGrad.addColorStop(1, `rgba(${nearRgb[0]}, ${nearRgb[1]}, ${nearRgb[2]}, 0)`);

    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.moveTo(half, pad);
    ctx.quadraticCurveTo(half + waist, half - waist, size - pad, half);
    ctx.quadraticCurveTo(half + waist, half + waist, half, size - pad);
    ctx.quadraticCurveTo(half - waist, half + waist, pad, half);
    ctx.quadraticCurveTo(half - waist, half - waist, half, pad);
    ctx.closePath();
    ctx.fill();
  }
  return offscreen;
}

function getStarVisibility(survivalHash: number, starBlend: number): number {
  if (starBlend <= 0.001) return 1;
  if (survivalHash >= STARFIELD_SURVIVAL_THRESHOLD) return 1;
  // Staggered smooth fade-out across 90% -> 60% zoom
  const fadeRate = 1 + (STARFIELD_SURVIVAL_THRESHOLD - survivalHash) * 1.5;
  return Math.max(0, 1 - starBlend * fadeRate);
}

export const ReactiveDotGrid: React.FC<ReactiveDotGridProps> = ({
  viewportRef,
  panRef,
  zoomRef,
  zoomTrigger,
  onRegisterRender,
  styleSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const styleRef = useRef<CanvasStyleSettings>(styleSettings);
  const spriteCacheRef = useRef<{ key: string; sprites: ThemeSprites } | null>(null);

  const targetPointerRef = useRef<{ x: number; y: number } | null>(null);
  const smoothPointerRef = useRef<{ x: number; y: number } | null>(null);
  const prevStampPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pointerVelocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const lastMoveTimestampRef = useRef<number>(0);
  const pointerActiveRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const wakeStatesRef = useRef<Map<number, DotWakeState>>(new Map());
  const auroraNodesRef = useRef<AuroraTrailNode[]>([]);
  const lastAuroraScreenRef = useRef<{ x: number; y: number } | null>(null);

  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const scheduleRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    styleRef.current = styleSettings;
    if (!styleSettings.reactiveEnabled || styleSettings.reactiveIntensity <= 0) {
      wakeStatesRef.current.clear();
      auroraNodesRef.current.length = 0;
      lastAuroraScreenRef.current = null;
    }
    scheduleRenderRef.current?.();
  }, [styleSettings]);

  useEffect(() => {
    scheduleRenderRef.current?.();
  }, [zoomTrigger]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const onChange = (ev: MediaQueryListEvent) => {
      reducedMotionRef.current = ev.matches;
      scheduleRenderRef.current?.();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const vp = viewportRef.current;
    const canvas = canvasRef.current;
    if (!vp || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, vp.clientWidth);
      const height = Math.max(1, vp.clientHeight);
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const getThemeSprites = (dark: boolean, nearHex: string, nearRgb: RgbTuple): ThemeSprites => {
      const cacheKey = `${dark ? 'd' : 'l'}:${nearHex.toLowerCase()}`;
      if (!spriteCacheRef.current || spriteCacheRef.current.key !== cacheKey) {
        spriteCacheRef.current = {
          key: cacheKey,
          sprites: {
            fourPointStar: createFourPointStarSprite(nearRgb, dark),
          },
        };
      }
      return spriteCacheRef.current.sprites;
    };

    const renderFrame = (now: number) => {
      rafIdRef.current = null;

      const prevTime = lastFrameTimeRef.current || now;
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      lastFrameTimeRef.current = now;

      syncCanvasSize();

      const viewW = vp.clientWidth;
      const viewH = vp.clientHeight;
      const scrollLeft = panRef.current.x;
      const scrollTop = panRef.current.y;
      const zoom = Math.max(0.1, zoomRef.current || 1);
      const rawScreenStep = WORLD_GRID_STEP * zoom;
      const style = styleRef.current;
      const dark = style.isDark;
      const themePalette = dark ? style.themeColors.dark : style.themeColors.light;
      const farRgb = parseHexColor(
        themePalette.farDotColor,
        dark ? [58, 58, 58] : [247, 244, 236]
      );
      const nearRgb = parseHexColor(
        themePalette.nearDotColor,
        dark ? [237, 237, 237] : [255, 254, 250]
      );
      const intensityFactor = style.reactiveEnabled
        ? Math.max(0, Math.min(1, style.reactiveIntensity / 100))
        : 0;
      const configuredRadius = Math.max(40, style.reactiveRadius || BASE_CURSOR_RADIUS_PX);
      const reducedMotion = reducedMotionRef.current;

      // Smooth parity fade completes BEFORE stride switches (58%->40% for stride 1->2, 31%->22% for stride 2->4)
      const stride = zoom >= 0.39 ? 1 : zoom >= 0.21 ? 2 : 4;
      const effectiveStep = rawScreenStep * stride;

      // Starry sky blend across 48% -> 28% zoom-out
      const rawStarBlend =
        zoom >= STARFIELD_START_ZOOM
          ? 0
          : zoom <= STARFIELD_FULL_ZOOM
          ? 1
          : (STARFIELD_START_ZOOM - zoom) / (STARFIELD_START_ZOOM - STARFIELD_FULL_ZOOM);
      const starBlend = rawStarBlend * rawStarBlend * (3 - 2 * rawStarBlend);
      // Continuous star jitter scale independent of discrete stride jumps
      const continuousJitterSpan = rawScreenStep * 2 * 0.68 * starBlend;

      // Proportional scaling when zooming out or in
      const zoomScale =
        zoom < 1
          ? Math.max(0.38, Math.pow(zoom, 0.62))
          : Math.min(1.3, 1 + (zoom - 1) * 0.2);

      const cursorRadiusPx = configuredRadius * zoomScale;
      const cursorRadiusSq = cursorRadiusPx * cursorRadiusPx;
      // Dot inflation fades out in starry mode so only the cursor trail glow/glint is visible
      const extraRadius = BASE_EXTRA_RADIUS * zoomScale * (1 - starBlend) * intensityFactor;
      const baseRadius =
        (dark ? 0.92 : 1.02) *
        (zoom < 1 ? Math.max(0.68, Math.pow(zoom, 0.35)) : Math.min(1.22, 1 + (zoom - 1) * 0.14));

      // Smooth cursor glide & velocity tracking
      if (pointerActiveRef.current && targetPointerRef.current) {
        if (!smoothPointerRef.current) {
          smoothPointerRef.current = { ...targetPointerRef.current };
          prevStampPointerRef.current = { ...targetPointerRef.current };
          pointerVelocityRef.current = { vx: 0, vy: 0 };
        } else {
          const prevSmoothX = smoothPointerRef.current.x;
          const prevSmoothY = smoothPointerRef.current.y;
          const glideAlpha = 1 - Math.exp(-dt * 15);
          smoothPointerRef.current.x +=
            (targetPointerRef.current.x - smoothPointerRef.current.x) * glideAlpha;
          smoothPointerRef.current.y +=
            (targetPointerRef.current.y - smoothPointerRef.current.y) * glideAlpha;

          const instVx = (smoothPointerRef.current.x - prevSmoothX) / dt;
          const instVy = (smoothPointerRef.current.y - prevSmoothY) / dt;
          const velBlend = 1 - Math.exp(-dt * 12);
          pointerVelocityRef.current.vx += (instVx - pointerVelocityRef.current.vx) * velBlend;
          pointerVelocityRef.current.vy += (instVy - pointerVelocityRef.current.vy) * velBlend;
        }
      } else {
        const decayVel = Math.exp(-dt * 10);
        pointerVelocityRef.current.vx *= decayVel;
        pointerVelocityRef.current.vy *= decayVel;
      }

      const pointer = pointerActiveRef.current ? smoothPointerRef.current : null;
      const wakeStates = wakeStatesRef.current;
      const auroraNodes = auroraNodesRef.current;

      const riseAlpha = 1 - Math.exp(-dt * 14);
      const trailDecayFactor = Math.exp(-dt * 0.82);
      const offsetFollowAlpha = 1 - Math.exp(-dt * 13);
      const targetOffsetDecay = Math.exp(-dt * 3.4);

      // In starry mode, only moving the cursor paints the wake so the resting sky stays calm
      const timeSinceMoveMs = now - lastMoveTimestampRef.current;
      const moveRecency = Math.max(0, 1 - Math.max(0, timeSinceMoveMs - 130) / 380);
      const trailMotionStrength =
        starBlend <= 0.01 ? 1 : Math.max((1 - starBlend) * 0.85, moveRecency);

      // Update soft aurora trail ribbon nodes in world space
      const speedPx = Math.hypot(pointerVelocityRef.current.vx, pointerVelocityRef.current.vy);
      const moveAngle =
        speedPx > 8 ? Math.atan2(pointerVelocityRef.current.vy, pointerVelocityRef.current.vx) : 0;

      if (pointer && trailMotionStrength > 0.03) {
        const lastScreen = lastAuroraScreenRef.current;
        const distSinceLastAurora = lastScreen
          ? Math.hypot(pointer.x - lastScreen.x, pointer.y - lastScreen.y)
          : Infinity;
        const minSpacing = Math.max(14, cursorRadiusPx * 0.12);

        const worldX = (scrollLeft + pointer.x) / zoom;
        const worldY = (scrollTop + pointer.y) / zoom;
        const speedNorm = Math.min(1, speedPx / 950);
        const targetStrength =
          moveRecency > 0.08
            ? (0.62 + 0.38 * speedNorm) * trailMotionStrength
            : 0.42 * (1 - starBlend);

        if (distSinceLastAurora >= minSpacing || auroraNodes.length === 0) {
          auroraNodes.push({
            worldX,
            worldY,
            strength: targetStrength,
            angle: moveAngle,
            stretch: reducedMotion ? 1 : 1 + speedNorm * 0.42,
            radiusMul: 0.82 + 0.24 * speedNorm,
          });
          if (auroraNodes.length > MAX_AURORA_NODES) {
            auroraNodes.shift();
          }
          lastAuroraScreenRef.current = { x: pointer.x, y: pointer.y };
        } else if (auroraNodes.length > 0 && targetStrength > 0.05) {
          const head = auroraNodes[auroraNodes.length - 1];
          const headLerp = 1 - Math.exp(-dt * 12);
          head.worldX += (worldX - head.worldX) * headLerp;
          head.worldY += (worldY - head.worldY) * headLerp;
          head.strength = Math.max(head.strength, targetStrength);
        }
      } else {
        lastAuroraScreenRef.current = null;
      }

      const auroraDecay = Math.exp(-dt * 1.45);
      for (let i = auroraNodes.length - 1; i >= 0; i--) {
        const node = auroraNodes[i];
        // Keep gentle stationary aura only when pointer is resting in normal zoom
        const isHeadResting =
          i === auroraNodes.length - 1 &&
          pointer !== null &&
          starBlend < 0.95 &&
          moveRecency <= 0.05;
        if (isHeadResting) {
          const restTarget = 0.38 * (1 - starBlend);
          node.strength += (restTarget - node.strength) * (1 - Math.exp(-dt * 4));
        } else {
          node.strength *= auroraDecay;
        }
        if (node.strength <= 0.008) {
          auroraNodes.splice(i, 1);
        }
      }

      const rawMinIx = Math.floor((scrollLeft - rawScreenStep) / rawScreenStep);
      const rawMaxIx = Math.ceil((scrollLeft + viewW + rawScreenStep) / rawScreenStep);
      const rawMinIy = Math.floor((scrollTop - rawScreenStep) / rawScreenStep);
      const rawMaxIy = Math.ceil((scrollTop + viewH + rawScreenStep) / rawScreenStep);

      const minIx = Math.floor(rawMinIx / stride) * stride;
      const maxIx = Math.ceil(rawMaxIx / stride) * stride;
      const minIy = Math.floor(rawMinIy / stride) * stride;
      const maxIy = Math.ceil(rawMaxIy / stride) * stride;

      const touchedKeys = new Set<number>();

      // Normalized cursor velocity for subtle fluid magnetic drift
      const speedNorm = Math.min(1, speedPx / 750);
      const dirVx = speedPx > 12 ? (pointerVelocityRef.current.vx / speedPx) * speedNorm : 0;
      const dirVy = speedPx > 12 ? (pointerVelocityRef.current.vy / speedPx) * speedNorm : 0;
      const magneticScale =
        (reducedMotion ? 0 : zoomScale * (1 - starBlend * 0.35)) * intensityFactor;

      if (pointer && intensityFactor > 0.001 && trailMotionStrength > 0.02) {
        const prev = prevStampPointerRef.current || pointer;
        const segDx = pointer.x - prev.x;
        const segDy = pointer.y - prev.y;
        const segDist = Math.hypot(segDx, segDy);
        const stepSize = Math.max(18, cursorRadiusPx * 0.25);
        const subSteps = Math.min(6, Math.max(1, Math.ceil(segDist / stepSize)));

        for (let s = 1; s <= subSteps; s++) {
          const frac = s / subSteps;
          const px = prev.x + segDx * frac;
          const py = prev.y + segDy * frac;
          const stampWeight = (0.55 + 0.45 * frac) * trailMotionStrength * intensityFactor;

          const pMinIx =
            Math.floor(
              Math.max(
                minIx,
                Math.floor((scrollLeft + px - cursorRadiusPx) / rawScreenStep) - stride
              ) / stride
            ) * stride;
          const pMaxIx =
            Math.ceil(
              Math.min(
                maxIx,
                Math.ceil((scrollLeft + px + cursorRadiusPx) / rawScreenStep) + stride
              ) / stride
            ) * stride;
          const pMinIy =
            Math.floor(
              Math.max(
                minIy,
                Math.floor((scrollTop + py - cursorRadiusPx) / rawScreenStep) - stride
              ) / stride
            ) * stride;
          const pMaxIy =
            Math.ceil(
              Math.min(
                maxIy,
                Math.ceil((scrollTop + py + cursorRadiusPx) / rawScreenStep) + stride
              ) / stride
            ) * stride;

          for (let ix = pMinIx; ix <= pMaxIx; ix += stride) {
            const baseSx = ix * rawScreenStep - scrollLeft;
            if (Math.abs(baseSx - px) > cursorRadiusPx + effectiveStep) continue;

            for (let iy = pMinIy; iy <= pMaxIy; iy += stride) {
              const parityVis = getParityVisibility(ix, iy, zoom);
              if (parityVis <= 0.01) continue;
              const survivalHash = dotRandomHash(ix, iy);
              if (getStarVisibility(survivalHash, starBlend) * parityVis <= 0.01) continue;

              const jitterX =
                starBlend > 0.001
                  ? (dotRandomHash(ix * 7 + 13, iy * 11 - 5) - 0.5) * continuousJitterSpan
                  : 0;
              const jitterY =
                starBlend > 0.001
                  ? (dotRandomHash(ix * 13 - 3, iy * 5 + 19) - 0.5) * continuousJitterSpan
                  : 0;

              const sx = baseSx + jitterX;
              const sy = iy * rawScreenStep - scrollTop + jitterY;
              const dx = sx - px;
              const dy = sy - py;
              const distSq = dx * dx + dy * dy;

              if (distSq < cursorRadiusSq) {
                const dist = Math.sqrt(distSq);
                const t = 1 - dist / cursorRadiusPx;
                const smoothT = t * t * (3 - 2 * t);
                const eased = smoothT * stampWeight;

                // Subtle fluid magnetic displacement: gentle radial parting + cursor flow pull
                let targetOx = 0;
                let targetOy = 0;
                if (magneticScale > 0.01) {
                  const radialBell = t * t * (1 - t) * 6.75; // Smoothly 0 at center and edge
                  const invDist = dist > 0.5 ? 1 / dist : 0;
                  const radialPush = radialBell * 2.5 * magneticScale * stampWeight;
                  const flowPull = smoothT * 2.0 * magneticScale * stampWeight;
                  targetOx = dx * invDist * radialPush + dirVx * flowPull;
                  targetOy = dy * invDist * radialPush + dirVy * flowPull;
                }

                const key = packGridKey(ix, iy);
                let state = wakeStates.get(key);
                if (!state) {
                  const initEnergy = eased * riseAlpha;
                  if (initEnergy > DECAY_EPSILON || Math.hypot(targetOx, targetOy) > OFFSET_EPSILON) {
                    wakeStates.set(key, {
                      energy: initEnergy,
                      ox: targetOx * offsetFollowAlpha,
                      oy: targetOy * offsetFollowAlpha,
                      tx: targetOx,
                      ty: targetOy,
                    });
                    touchedKeys.add(key);
                  }
                } else {
                  if (eased >= state.energy) {
                    state.energy += (eased - state.energy) * riseAlpha;
                  } else if (!touchedKeys.has(key)) {
                    state.energy = Math.max(
                      state.energy * trailDecayFactor,
                      eased * (1 - starBlend * 0.85)
                    );
                  }
                  if (Math.hypot(targetOx, targetOy) >= Math.hypot(state.tx, state.ty) * 0.7) {
                    state.tx = targetOx;
                    state.ty = targetOy;
                  } else if (!touchedKeys.has(key)) {
                    state.tx *= targetOffsetDecay;
                    state.ty *= targetOffsetDecay;
                  }
                  if (!touchedKeys.has(key)) {
                    state.ox += (state.tx - state.ox) * offsetFollowAlpha;
                    state.oy += (state.ty - state.oy) * offsetFollowAlpha;
                  }
                  touchedKeys.add(key);
                }
              }
            }
          }
        }

        prevStampPointerRef.current = { x: pointer.x, y: pointer.y };
      } else {
        prevStampPointerRef.current = pointer ? { x: pointer.x, y: pointer.y } : null;
      }

      // Smoothly relax untouched wake states and prune completed entries
      wakeStates.forEach((state, key) => {
        const [ix, iy] = unpackGridKey(key);
        if (getParityVisibility(ix, iy, zoom) <= 0.01) {
          wakeStates.delete(key);
          return;
        }
        if (!touchedKeys.has(key)) {
          state.energy *= trailDecayFactor;
          state.tx *= targetOffsetDecay;
          state.ty *= targetOffsetDecay;
          state.ox += (state.tx - state.ox) * offsetFollowAlpha;
          state.oy += (state.ty - state.oy) * offsetFollowAlpha;
        }
        if (
          state.energy <= DECAY_EPSILON &&
          Math.abs(state.ox) <= OFFSET_EPSILON &&
          Math.abs(state.oy) <= OFFSET_EPSILON
        ) {
          wakeStates.delete(key);
        }
      });

      ctx.clearRect(0, 0, viewW, viewH);

      const sprites = getThemeSprites(dark, themePalette.nearDotColor, nearRgb);
      const nowSec = now * 0.001;
      if (auroraNodes.length > 0) {
        auroraNodes.length = 0;
      }

      // PASS 2: Base Grid (>= 48% zoom) OR Starry Sky Transition (48% -> 28%)
      const baseDotAlpha = dark ? 1 : 0.52;
      if (starBlend <= 0.005) {
        const oddFade = zoom >= 0.58 ? 1 : zoom <= 0.40 ? 0 : smoothstep01((zoom - 0.40) / (0.58 - 0.40));
        ctx.fillStyle = `rgba(${farRgb[0]}, ${farRgb[1]}, ${farRgb[2]}, ${baseDotAlpha})`;
        ctx.beginPath();
        const fadingDots: Array<{ x: number; y: number }> = [];
        for (let ix = minIx; ix <= maxIx; ix += stride) {
          const sx = ix * rawScreenStep - scrollLeft;
          const xOdd = (ix & 1) !== 0;
          for (let iy = minIy; iy <= maxIy; iy += stride) {
            const key = packGridKey(ix, iy);
            if (wakeStates.has(key)) continue;
            const sy = iy * rawScreenStep - scrollTop;
            if (oddFade < 0.995 && (xOdd || (iy & 1) !== 0)) {
              if (oddFade > 0.01) fadingDots.push({ x: sx, y: sy });
              continue;
            }
            ctx.moveTo(sx + baseRadius, sy);
            ctx.arc(sx, sy, baseRadius, 0, Math.PI * 2);
          }
        }
        ctx.fill();

        if (fadingDots.length > 0 && oddFade > 0.01) {
          ctx.fillStyle = `rgba(${farRgb[0]}, ${farRgb[1]}, ${farRgb[2]}, ${(baseDotAlpha * oddFade).toFixed(3)})`;
          ctx.beginPath();
          for (let i = 0; i < fadingDots.length; i++) {
            const d = fadingDots[i];
            ctx.moveTo(d.x + baseRadius, d.y);
            ctx.arc(d.x, d.y, baseRadius, 0, Math.PI * 2);
          }
          ctx.fill();
        }
      } else {
        const dimStars: Array<{ x: number; y: number; r: number }> = [];
        const midStars: Array<{ x: number; y: number; r: number }> = [];
        const brightStars: Array<{
          x: number;
          y: number;
          r: number;
          glow: number;
          starLum: number;
        }> = [];
        const FADE_BUCKETS = 6;
        const fadingBuckets: Array<Array<{ x: number; y: number; r: number }>> = Array.from(
          { length: FADE_BUCKETS },
          () => []
        );

        for (let ix = minIx; ix <= maxIx; ix += stride) {
          const baseSx = ix * rawScreenStep - scrollLeft;
          for (let iy = minIy; iy <= maxIy; iy += stride) {
            const parityVis = getParityVisibility(ix, iy, zoom);
            if (parityVis <= 0.01) continue;
            const survivalHash = dotRandomHash(ix, iy);
            const vis = getStarVisibility(survivalHash, starBlend) * parityVis;
            if (vis <= 0.01) continue;

            const key = packGridKey(ix, iy);
            if (wakeStates.has(key)) continue;

            const jitterX =
              (dotRandomHash(ix * 7 + 13, iy * 11 - 5) - 0.5) * continuousJitterSpan;
            const jitterY =
              (dotRandomHash(ix * 13 - 3, iy * 5 + 19) - 0.5) * continuousJitterSpan;
            const sx = baseSx + jitterX;
            const sy = iy * rawScreenStep - scrollTop + jitterY;

            const starLum = dotRandomHash(ix + 7919, iy - 3571);
            const starSizeMul = 1 - starBlend + starBlend * (0.55 + starLum * 0.95);
            const r = baseRadius * starSizeMul;

            if (vis < 0.96) {
              const bucket = Math.max(
                0,
                Math.min(FADE_BUCKETS - 1, Math.floor(vis * FADE_BUCKETS))
              );
              fadingBuckets[bucket].push({ x: sx, y: sy, r });
            } else if (starLum > 0.82) {
              brightStars.push({
                x: sx,
                y: sy,
                r,
                glow: (starLum - 0.82) / 0.18,
                starLum,
              });
            } else if (starLum > 0.42) {
              midStars.push({ x: sx, y: sy, r });
            } else {
              dimStars.push({ x: sx, y: sy, r });
            }
          }
        }

        const dimRgb = mixRgb(farRgb, nearRgb, (dark ? 0.17 : 0) * starBlend);
        const dimAlpha = baseDotAlpha + ((dark ? 0.42 : 0.30) - baseDotAlpha) * starBlend;

        for (let b = 0; b < FADE_BUCKETS; b++) {
          const list = fadingBuckets[b];
          if (list.length === 0) continue;
          const bucketAlpha = ((b + 0.5) / FADE_BUCKETS) * dimAlpha;
          if (bucketAlpha <= 0.01) continue;
          ctx.fillStyle = `rgba(${dimRgb[0]}, ${dimRgb[1]}, ${dimRgb[2]}, ${bucketAlpha.toFixed(3)})`;
          ctx.beginPath();
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            ctx.moveTo(s.x + s.r, s.y);
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          }
          ctx.fill();
        }

        if (dimStars.length > 0) {
          ctx.fillStyle = `rgba(${dimRgb[0]}, ${dimRgb[1]}, ${dimRgb[2]}, ${dimAlpha.toFixed(3)})`;
          ctx.beginPath();
          for (let i = 0; i < dimStars.length; i++) {
            const s = dimStars[i];
            ctx.moveTo(s.x + s.r, s.y);
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          }
          ctx.fill();
        }

        if (midStars.length > 0) {
          const midRgb = mixRgb(farRgb, nearRgb, 0.55 * starBlend);
          const midAlpha = baseDotAlpha + ((dark ? 0.64 : 0.68) - baseDotAlpha) * starBlend;
          ctx.fillStyle = `rgba(${midRgb[0]}, ${midRgb[1]}, ${midRgb[2]}, ${midAlpha.toFixed(3)})`;
          ctx.beginPath();
          for (let i = 0; i < midStars.length; i++) {
            const s = midStars[i];
            ctx.moveTo(s.x + s.r, s.y);
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          }
          ctx.fill();
        }

        if (brightStars.length > 0) {
          for (let i = 0; i < brightStars.length; i++) {
            const s = brightStars[i];

            // Crisp 4-point glint (no glow) on the brightest ~8% resting stars in starry sky mode
            if (s.starLum > 0.92) {
              const starPeak = (s.starLum - 0.92) / 0.08;
              const glintR = s.r * (3.0 + starPeak * 1.6);
              ctx.globalAlpha = starBlend * (0.14 + starPeak * 0.2);
              ctx.drawImage(
                sprites.fourPointStar,
                s.x - glintR,
                s.y - glintR,
                glintR * 2,
                glintR * 2
              );
            }
          }
          ctx.globalAlpha = 1;

          const brightRgb = mixRgb(farRgb, nearRgb, 0.99 * starBlend);
          const brightAlpha = baseDotAlpha + ((dark ? 0.90 : 0.90) - baseDotAlpha) * starBlend;
          ctx.fillStyle = `rgba(${brightRgb[0]}, ${brightRgb[1]}, ${brightRgb[2]}, ${brightAlpha.toFixed(3)})`;
          ctx.beginPath();
          for (let i = 0; i < brightStars.length; i++) {
            const s = brightStars[i];
            ctx.moveTo(s.x + s.r, s.y);
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          }
          ctx.fill();
        }
      }

      // PASS 3 & 4: Active Magnetic Dots, Monochromatic Radial Glows & 4-Point Sparkle Glints
      if (wakeStates.size > 0) {
        const activeRenderList: Array<{
          sx: number;
          sy: number;
          energy: number;
          vis: number;
          starLum: number;
        }> = [];

        wakeStates.forEach((state, key) => {
          const [ix, iy] = unpackGridKey(key);
          if (
            ix < minIx - stride ||
            ix > maxIx + stride ||
            iy < minIy - stride ||
            iy > maxIy + stride
          ) {
            return;
          }

          const parityVis = getParityVisibility(ix, iy, zoom);
          if (parityVis <= 0.01) return;
          const survivalHash = dotRandomHash(ix, iy);
          const vis = getStarVisibility(survivalHash, starBlend) * parityVis;
          if (vis <= 0.01) return;

          const jitterX =
            starBlend > 0.001
              ? (dotRandomHash(ix * 7 + 13, iy * 11 - 5) - 0.5) * continuousJitterSpan
              : 0;
          const jitterY =
            starBlend > 0.001
              ? (dotRandomHash(ix * 13 - 3, iy * 5 + 19) - 0.5) * continuousJitterSpan
              : 0;

          const sx = ix * rawScreenStep - scrollLeft + jitterX + state.ox;
          const sy = iy * rawScreenStep - scrollTop + jitterY + state.oy;
          const starLum = dotRandomHash(ix + 7919, iy - 3571);

          activeRenderList.push({
            sx,
            sy,
            energy: state.energy,
            vis,
            starLum,
          });
        });

        // Pass 3: Magnetically displaced dot/star cores (pure crisp rendering without glow)
        for (let i = 0; i < activeRenderList.length; i++) {
          const item = activeRenderList[i];
          const starSizeMul = 1 - starBlend + starBlend * (0.55 + item.starLum * 0.95);
          const radius = baseRadius * starSizeMul + item.energy * extraRadius;

          if (dark) {
            const lift = item.energy * (0.62 + 0.38 * item.starLum) + starBlend * item.starLum * 0.65;
            const [r, g, b] = mixRgb(farRgb, nearRgb, lift);
            const baseAlpha = starBlend > 0.01 ? 0.56 + starBlend * item.starLum * 0.34 : 1;
            const alpha = Math.min(0.96, (baseAlpha + item.energy * 0.38) * item.vis);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
          } else {
            const lift = item.energy * (0.72 + 0.28 * item.starLum) + starBlend * item.starLum * 0.65;
            const [r, g, b] = mixRgb(farRgb, nearRgb, lift);
            const alpha = Math.min(
              0.94,
              (0.52 + item.energy * (0.28 + item.starLum * 0.14) + starBlend * item.starLum * 0.16) *
                item.vis
            );
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
          }

          ctx.beginPath();
          ctx.arc(item.sx, item.sy, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Pass 4: Selective 4-Point Star Glints along the peak cursor wake
        for (let i = 0; i < activeRenderList.length; i++) {
          const item = activeRenderList[i];
          if (item.starLum <= 0.78 || item.energy <= 0.2) continue;

          const lumRank = (item.starLum - 0.78) / 0.22;
          const twinkle = reducedMotion
            ? 1
            : 0.86 + 0.14 * Math.sin(nowSec * 2.1 + item.starLum * 19.7);
          const glintAlpha =
            Math.pow(item.energy, 1.2) * (0.24 + 0.52 * lumRank) * twinkle * item.vis;

          if (glintAlpha <= 0.02) continue;

          const glintRadius =
            (baseRadius * 2.6 + item.energy * 5.2 * zoomScale) * (0.72 + lumRank * 0.48);
          ctx.globalAlpha = Math.min(0.48, glintAlpha * (dark ? 0.46 : 0.52));
          ctx.drawImage(
            sprites.fourPointStar,
            item.sx - glintRadius,
            item.sy - glintRadius,
            glintRadius * 2,
            glintRadius * 2
          );
        }
        ctx.globalAlpha = 1;
      }

      const isCursorMoving =
        pointerActiveRef.current &&
        targetPointerRef.current &&
        smoothPointerRef.current &&
        Math.hypot(
          targetPointerRef.current.x - smoothPointerRef.current.x,
          targetPointerRef.current.y - smoothPointerRef.current.y
        ) > 0.35;

      const keepIdleGlow =
        !reducedMotion &&
        starBlend < 0.98 &&
        pointerActiveRef.current &&
        intensityFactor > 0.001;

      if (
        keepIdleGlow ||
        wakeStates.size > 0 ||
        auroraNodes.length > 0 ||
        (isCursorMoving && intensityFactor > 0.001)
      ) {
        rafIdRef.current = requestAnimationFrame(renderFrame);
      } else {
        lastFrameTimeRef.current = 0;
      }
    };

    const scheduleRender = () => {
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(renderFrame);
      }
    };

    const renderNow = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      renderFrame(performance.now());
    };

    scheduleRenderRef.current = scheduleRender;
    onRegisterRender?.(renderNow);

    const updatePointerFromEvent = (clientX: number, clientY: number) => {
      const rect = vp.getBoundingClientRect();
      targetPointerRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      lastMoveTimestampRef.current = performance.now();
      pointerActiveRef.current = true;
      if (styleRef.current.reactiveEnabled && styleRef.current.reactiveIntensity > 0) {
        scheduleRender();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      updatePointerFromEvent(e.clientX, e.clientY);
    };

    const handlePointerDown = (e: PointerEvent) => {
      updatePointerFromEvent(e.clientX, e.clientY);
    };

    const handlePointerUpOrCancel = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        pointerActiveRef.current = false;
        scheduleRender();
      }
    };

    const handlePointerLeave = () => {
      pointerActiveRef.current = false;
      scheduleRender();
    };

    const handleViewportChange = () => {
      scheduleRender();
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleRender();
    });
    resizeObserver.observe(vp);

    vp.addEventListener('pointermove', handlePointerMove, { passive: true });
    vp.addEventListener('pointerdown', handlePointerDown, { passive: true });
    vp.addEventListener('pointerup', handlePointerUpOrCancel, { passive: true });
    vp.addEventListener('pointercancel', handlePointerUpOrCancel, { passive: true });
    vp.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    vp.addEventListener('scroll', handleViewportChange, { passive: true });
    vp.addEventListener('wheel', handleViewportChange, { passive: true });

    scheduleRender();

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      scheduleRenderRef.current = null;
      onRegisterRender?.(null);
      resizeObserver.disconnect();
      vp.removeEventListener('pointermove', handlePointerMove);
      vp.removeEventListener('pointerdown', handlePointerDown);
      vp.removeEventListener('pointerup', handlePointerUpOrCancel);
      vp.removeEventListener('pointercancel', handlePointerUpOrCancel);
      vp.removeEventListener('pointerleave', handlePointerLeave);
      vp.removeEventListener('scroll', handleViewportChange);
      vp.removeEventListener('wheel', handleViewportChange);
    };
  }, [viewportRef, panRef, zoomRef, onRegisterRender]);

  const vignetteStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!styleSettings.vignetteEnabled || styleSettings.vignetteIntensity <= 0) {
      return undefined;
    }
    const maxAlpha = styleSettings.isDark ? 0.88 : 0.58;
    const edgeAlpha =
      (Math.max(0, Math.min(100, styleSettings.vignetteIntensity)) / 100) * maxAlpha;
    const gradPct = Math.max(0, Math.min(100, styleSettings.vignetteGradient)) / 100;
    const innerStop = 62 - gradPct * 54;
    const outerStop = 76 + gradPct * 32;
    const rgb = styleSettings.isDark ? '0, 0, 0' : '43, 41, 36';

    const stopCount = 30;
    const stops: string[] = [];
    for (let i = 0; i < stopCount; i++) {
      const u = i / (stopCount - 1);
      // Smootherstep (zero 1st & 2nd derivative at both ends) for a silky, band-free falloff
      const eased = u * u * u * (u * (u * 6 - 15) + 10);
      const pos = innerStop + (outerStop - innerStop) * u;
      const alpha = edgeAlpha * eased;
      stops.push(`rgba(${rgb}, ${alpha.toFixed(4)}) ${pos.toFixed(2)}%`);
    }

    return {
      background: `radial-gradient(ellipse at 50% 50%, ${stops.join(', ')})`,
    };
  }, [
    styleSettings.isDark,
    styleSettings.vignetteEnabled,
    styleSettings.vignetteIntensity,
    styleSettings.vignetteGradient,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full z-0"
      />
      {vignetteStyle && (
        <div
          aria-hidden="true"
          style={vignetteStyle}
          className="pointer-events-none absolute inset-0 w-full h-full z-0"
        />
      )}
    </>
  );
};
