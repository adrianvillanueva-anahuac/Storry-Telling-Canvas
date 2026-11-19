import { AppState, TextElement, WorkflowNode } from '../types/workflow';
import { calculateConnectionPath, getNodePortCoords } from './connectionPath';
import { getContrastTextColor } from './colorContrast';
import { isFirestoreMediaUrl, resolveMediaUrl } from '../services/mediaCache';

export type ExportScope = 'workspace' | 'view';
export type ExportFormat = 'png' | 'svg';
export type ExportBackground = 'theme' | 'white' | 'transparent';

export interface ViewportCanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface CanvasExportLabels {
  deletedImage?: string;
  imageSnapshot?: string;
  noImage?: string;
  defaultScene?: string;
  defaultContainer?: string;
  defaultStickyNote?: string;
  errRenderPng?: string;
  errCanvasInit?: string;
  errEncodePng?: string;
}

export interface CanvasExportOptions {
  state: AppState;
  scope: ExportScope;
  viewportRect: ViewportCanvasRect;
  isDark: boolean;
  background: ExportBackground;
  includeGrid: boolean;
  embeddedImages?: Record<string, string>;
  labels?: CanvasExportLabels;
}

export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 171;
const WORKSPACE_PADDING = 72;

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

function wrapTextLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const paragraphs = (text || '').split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word.length > maxCharsPerLine ? truncateText(word, maxCharsPerLine) : word;
      }
    }
    if (current) lines.push(current);
  }

  if (lines.length <= maxLines) return lines;
  const sliced = lines.slice(0, maxLines);
  sliced[maxLines - 1] = truncateText(sliced[maxLines - 1], maxCharsPerLine);
  return sliced;
}

export function computeWorkspaceBounds(
  state: AppState,
  fallbackRect?: ViewportCanvasRect
): ExportBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const includeBox = (x: number, y: number, w: number, h: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  };

  Object.values(state.nodes).forEach((n) => {
    const x = parseFloat(n.x) || 0;
    const y = parseFloat(n.y) || 0;
    includeBox(x, y, NODE_WIDTH, NODE_HEIGHT);
  });

  Object.values(state.texts).forEach((t) => {
    const x = parseFloat(t.x) || 0;
    const y = parseFloat(t.y) || 0;
    if (t.mode === 'container') {
      const w = t.width || 340;
      const h = t.height || 240;
      // Leave extra headroom above container for title badge
      includeBox(x, y - 28, w, h + 28);
    } else if (t.mode === 'annotation') {
      const noteW = t.width || 220;
      const maxChars = Math.max(12, Math.floor((noteW - 24) / 6.5));
      const bodyLines = wrapTextLines(t.body || '', maxChars, 8).length;
      const estH = Math.max(t.height || 0, 56 + bodyLines * 16, 98);
      includeBox(x, y, noteW, estH);
    } else {
      const fontSize = t.size || 20;
      const lines = t.width
        ? wrapTextLines(
            t.text || '',
            Math.max(6, Math.floor((t.width - 12) / (fontSize * 0.58))),
            24
          )
        : (t.text || '').split(/\r?\n/);
      const longest = Math.max(1, ...lines.map((l) => l.length));
      const estW = t.width ? t.width : Math.max(80, longest * fontSize * 0.62 + 16);
      const estH = Math.max(t.height || 0, lines.length * fontSize * 1.3 + 12, 36);
      includeBox(x, y, estW, estH);
    }
  });

  if (minX === Infinity) {
    if (fallbackRect && fallbackRect.width > 0 && fallbackRect.height > 0) {
      return {
        x: fallbackRect.x,
        y: fallbackRect.y,
        width: fallbackRect.width,
        height: fallbackRect.height,
      };
    }
    return { x: 2000, y: 2000, width: 1280, height: 800 };
  }

  return {
    x: Math.floor(minX - WORKSPACE_PADDING),
    y: Math.floor(minY - WORKSPACE_PADDING),
    width: Math.max(320, Math.ceil(maxX - minX + WORKSPACE_PADDING * 2)),
    height: Math.max(240, Math.ceil(maxY - minY + WORKSPACE_PADDING * 2)),
  };
}

export function getExportBounds(options: Pick<CanvasExportOptions, 'state' | 'scope' | 'viewportRect'>): ExportBounds {
  if (options.scope === 'view' && options.viewportRect.width > 0 && options.viewportRect.height > 0) {
    return {
      x: options.viewportRect.x,
      y: options.viewportRect.y,
      width: options.viewportRect.width,
      height: options.viewportRect.height,
    };
  }
  return computeWorkspaceBounds(options.state, options.viewportRect);
}

async function fetchUrlAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  if (isFirestoreMediaUrl(url)) {
    try {
      return await resolveMediaUrl(url);
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (response.ok) {
      const blob = await response.blob();
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) return dataUrl;
    }
  } catch {
    // Fallback to anonymous Image load below
  }

  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 440;
        canvas.height = img.naturalHeight || 248;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function preloadNodeImages(
  nodes: Record<string, WorkflowNode>,
  cache: Record<string, string> = {}
): Promise<Record<string, string>> {
  const urls = Array.from(
    new Set(
      Object.values(nodes)
        .map((n) => n.image)
        .filter((u): u is string => Boolean(u) && !cache[u!])
    )
  );

  await Promise.all(
    urls.map(async (url) => {
      const dataUrl = await fetchUrlAsDataUrl(url);
      if (dataUrl) {
        cache[url] = dataUrl;
      }
    })
  );

  return cache;
}

export function buildExportSvgString(options: CanvasExportOptions): {
  svg: string;
  bounds: ExportBounds;
} {
  const { state, scope, viewportRect, isDark, background, includeGrid, embeddedImages = {}, labels = {} } = options;
  const bounds = getExportBounds({ state, scope, viewportRect });

  const useLightSurface = background === 'white' || (background === 'theme' && !isDark);
  const useLightThemePalette = background === 'theme' && !isDark;
  const bgFill =
    background === 'transparent'
      ? 'none'
      : background === 'white'
      ? '#ffffff'
      : isDark
      ? '#0a0a0a'
      : '#c9c6bd';
  const gridColor = useLightThemePalette ? '#f7f4ec' : useLightSurface ? '#d4d4d8' : '#262626';
  const fontFamily = "'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif";

  const defs: string[] = [];

  if (includeGrid && background !== 'transparent') {
    defs.push(`
      <pattern id="export-grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1" fill="${gridColor}" opacity="0.7" />
      </pattern>
    `);
  }

  // Arrow markers per connection color
  const uniqueColors = new Set<string>(['#0052cc']);
  state.connections.forEach((c) => uniqueColors.add(c.color || '#0052cc'));
  uniqueColors.forEach((color) => {
    const hex = sanitizeId(color.replace('#', ''));
    defs.push(`
      <marker id="exp-arrow-end-${hex}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${escapeXml(color)}" />
      </marker>
      <marker id="exp-arrow-start-${hex}" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 10 0 L 0 5 L 10 10 z" fill="${escapeXml(color)}" />
      </marker>
      <marker id="exp-arrow-end-sm-${hex}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${escapeXml(color)}" />
      </marker>
      <marker id="exp-arrow-start-sm-${hex}" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M 10 0 L 0 5 L 10 10 z" fill="${escapeXml(color)}" />
      </marker>
    `);
  });

  // 1. Containers layer
  const containerTitleInvScale =
    scope === 'view' && viewportRect.zoom > 0 ? 1 / viewportRect.zoom : 1;

  const containerElements = Object.values(state.texts).filter((t) => t.mode === 'container');
  const containerSvg = containerElements
    .map((el) => {
      const x = parseFloat(el.x) || 0;
      const y = parseFloat(el.y) || 0;
      const w = el.width || 340;
      const h = el.height || 240;
      const lbl = el.labelId ? state.labels[el.labelId] : undefined;
      const themeColor = el.color || lbl?.color || '#0052cc';
      const fontSize = el.size || 14;
      const fontWeight = el.bold === false ? 'normal' : 'bold';
      const fontStyle = el.italic ? 'italic' : 'normal';
      const titleText = el.text || labels.defaultContainer || 'Container';
      const badgeW = Math.max(70, titleText.length * fontSize * 0.62 + 24);
      const badgeH = Math.max(24, fontSize * 1.45 + 6);
      const anchorX = x + 16;
      const anchorY = y + 8;

      const titleTextColor = getContrastTextColor(themeColor);
      const lblTextColor = lbl ? getContrastTextColor(lbl.color) : '#ffffff';
      const lblBadgeWidth = lbl ? Math.max(54, lbl.name.length * 6.5 + 16) : 0;

      const labelBadgeSvg = lbl
        ? `<g>
            <rect x="${x + w - 16 - lblBadgeWidth}" y="${y - 11}" width="${lblBadgeWidth}" height="20" rx="10" fill="${escapeXml(lbl.color)}" />
            <text x="${x + w - 16 - lblBadgeWidth / 2}" y="${y + 2.5}" text-anchor="middle" font-family="${fontFamily}" font-size="10" font-weight="600" fill="${lblTextColor}">${escapeXml(lbl.name)}</text>
          </g>`
        : '';

      return `
        <g>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${escapeXml(themeColor)}" fill-opacity="0.08" stroke="${escapeXml(themeColor)}" stroke-width="2" stroke-dasharray="8 6" />
          <g transform="translate(${anchorX}, ${anchorY}) scale(${containerTitleInvScale})">
            <rect x="0" y="${-badgeH}" width="${badgeW}" height="${badgeH}" rx="6" fill="${escapeXml(themeColor)}" />
            <text x="12" y="${-badgeH / 2 + fontSize * 0.35}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" fill="${titleTextColor}">${escapeXml(titleText)}</text>
          </g>
          ${labelBadgeSvg}
        </g>
      `;
    })
    .join('\n');

  // 2. Connections layer
  const connectionsSvg = state.connections
    .map((conn) => {
      const start = getNodePortCoords(state.nodes, conn.source, conn.sourcePort);
      const end = getNodePortCoords(state.nodes, conn.target, conn.targetPort);
      if (!start || !end) return '';

      const connType = conn.type || 'angle';
      const pathOptions = {
        angleOffset: conn.angleOffset,
        cornerRadius: conn.cornerRadius,
        curveOffset: conn.curveOffset,
      };
      const { d, labelX, labelY } = calculateConnectionPath(
        start.x,
        start.y,
        end.x,
        end.y,
        conn.sourcePort,
        conn.targetPort,
        connType,
        0,
        pathOptions
      );
      const color = conn.color || '#0052cc';
      const hex = sanitizeId(color.replace('#', ''));
      const isParallel = conn.style === 'parallel';
      const labelFill = useLightSurface ? '#171717' : '#e5e5e5';
      const labelHalo = useLightSurface ? '#ffffff' : '#0a0a0a';

      const labelSvg = conn.label
        ? isParallel
          ? `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-family="${fontFamily}" font-size="11" font-weight="700" fill="${labelFill}" stroke="${labelHalo}" stroke-width="3" paint-order="stroke">${escapeXml(conn.label)}</text>`
          : `<text x="${labelX}" y="${labelY - 8}" text-anchor="middle" font-family="${fontFamily}" font-size="11" font-weight="700" fill="${labelFill}" stroke="${labelHalo}" stroke-width="3" paint-order="stroke">${escapeXml(conn.label)}</text>`
        : '';

      const getStrokeAttrs = (pattern?: string) => {
        if (pattern === 'dotted') return 'stroke-dasharray="1 6" stroke-linecap="round"';
        if (pattern === 'dashed') return 'stroke-dasharray="10 6" stroke-linecap="butt"';
        return '';
      };

      if (isParallel) {
        const line1 = calculateConnectionPath(
          start.x,
          start.y,
          end.x,
          end.y,
          conn.sourcePort,
          conn.targetPort,
          connType,
          -15,
          pathOptions
        );
        const line2 = calculateConnectionPath(
          start.x,
          start.y,
          end.x,
          end.y,
          conn.sourcePort,
          conn.targetPort,
          connType,
          15,
          pathOptions
        );
        const pa = conn.parallelArrows || { first: 'forward', second: 'backward' };
        const ps = conn.parallelStyles || { first: 'solid', second: 'solid' };
        const m1End =
          pa.first === 'forward' || pa.first === 'both' ? `marker-end="url(#exp-arrow-end-sm-${hex})"` : '';
        const m1Start =
          pa.first === 'backward' || pa.first === 'both' ? `marker-start="url(#exp-arrow-start-sm-${hex})"` : '';
        const m2End =
          pa.second === 'forward' || pa.second === 'both' ? `marker-end="url(#exp-arrow-end-sm-${hex})"` : '';
        const m2Start =
          pa.second === 'backward' || pa.second === 'both' ? `marker-start="url(#exp-arrow-start-sm-${hex})"` : '';

        const isSeparateLabels = conn.parallelLabelMode === 'separate';
        const getOutwardLabelSvg = (
          lineLabel: { labelX: number; labelY: number },
          text: string,
          fallbackSign: number
        ) => {
          if (!text) return '';
          const vx = lineLabel.labelX - labelX;
          const vy = lineLabel.labelY - labelY;
          const vLen = Math.hypot(vx, vy);
          const ux = vLen > 0.01 ? vx / vLen : 0;
          const uy = vLen > 0.01 ? vy / vLen : fallbackSign;
          const dist = Math.abs(ux) > 0.6 ? 10 : 12;
          const anchor = ux > 0.6 ? 'start' : ux < -0.6 ? 'end' : 'middle';
          const lx = lineLabel.labelX + ux * dist;
          const ly = lineLabel.labelY + uy * dist;
          return `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="central" font-family="${fontFamily}" font-size="11" font-weight="700" fill="${labelFill}" stroke="${labelHalo}" stroke-width="3" paint-order="stroke">${escapeXml(text)}</text>`;
        };

        const parallelLabelsSvg = isSeparateLabels
          ? `${getOutwardLabelSvg(line1, conn.parallelLabels?.first || '', -1)}${getOutwardLabelSvg(line2, conn.parallelLabels?.second || '', 1)}`
          : labelSvg;

        return `
          <g>
            <path d="${escapeXml(line1.d)}" stroke="${escapeXml(color)}" stroke-width="2" ${getStrokeAttrs(ps.first)} fill="none" ${m1End} ${m1Start} />
            <path d="${escapeXml(line2.d)}" stroke="${escapeXml(color)}" stroke-width="2" ${getStrokeAttrs(ps.second)} fill="none" ${m2End} ${m2Start} />
            ${parallelLabelsSvg}
          </g>
        `;
      }

      const markerEnd =
        conn.arrows === 'end' || conn.arrows === 'both' ? `marker-end="url(#exp-arrow-end-${hex})"` : '';
      const markerStart =
        conn.arrows === 'start' || conn.arrows === 'both' ? `marker-start="url(#exp-arrow-start-${hex})"` : '';
      const strokeAttrs = getStrokeAttrs(conn.style);

      return `
        <g>
          <path d="${escapeXml(d)}" stroke="${escapeXml(color)}" stroke-width="2.5" ${strokeAttrs} fill="none" ${markerEnd} ${markerStart} />
          ${labelSvg}
        </g>
      `;
    })
    .join('\n');

  // 3. Workflow Nodes layer
  const nodeBg = useLightThemePalette ? '#706d65' : useLightSurface ? '#ffffff' : '#171717';
  const nodeHeaderBg = useLightThemePalette ? '#5e5b54' : useLightSurface ? '#f4f4f5' : '#121212';
  const nodeBorder = useLightThemePalette ? '#57544d' : useLightSurface ? '#d4d4d8' : '#404040';
  const nodeTitleColor = useLightThemePalette ? '#f3f0e8' : useLightSurface ? '#18181b' : '#e5e5e5';
  const thumbPlaceholderBg = useLightThemePalette ? '#625f58' : useLightSurface ? '#f4f4f5' : '#141414';
  const thumbPlaceholderStroke = useLightThemePalette ? '#c2bdb1' : useLightSurface ? '#a1a1aa' : '#525252';
  const thumbPlaceholderText = useLightThemePalette ? '#eae6dc' : useLightSurface ? '#52525b' : '#737373';

  const nodesSvg = Object.values(state.nodes)
    .map((node) => {
      const x = parseFloat(node.x) || 0;
      const y = parseFloat(node.y) || 0;
      const clipId = `clip-thumb-${sanitizeId(node.id)}`;
      const thumbX = x + 10;
      const thumbY = y + 47;
      const thumbW = 200;
      const thumbH = 112.5;

      let thumbContent = '';
      const resolvedSrc = node.image ? embeddedImages[node.image] || (node.image.startsWith('data:') ? node.image : null) : null;

      if (resolvedSrc) {
        defs.push(`
          <clipPath id="${clipId}">
            <rect x="${thumbX}" y="${thumbY}" width="${thumbW}" height="${thumbH}" rx="8" />
          </clipPath>
        `);
        thumbContent = `
          <rect x="${thumbX}" y="${thumbY}" width="${thumbW}" height="${thumbH}" rx="8" fill="#000000" />
          <image href="${escapeXml(resolvedSrc)}" x="${thumbX}" y="${thumbY}" width="${thumbW}" height="${thumbH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
          <rect x="${thumbX}" y="${thumbY}" width="${thumbW}" height="${thumbH}" rx="8" fill="none" stroke="${useLightSurface ? '#e4e4e7' : '#262626'}" stroke-width="1" />
        `;
      } else if (node.imageDeletedFromAdmin) {
        const cx = thumbX + thumbW / 2;
        const cy = thumbY + thumbH / 2 - 8;
        thumbContent = `
          <rect x="${thumbX}" y="${thumbY}" width="${thumbW}" height="${thumbH}" rx="8" fill="rgba(127, 29, 29, 0.18)" stroke="rgba(239, 68, 68, 0.7)" stroke-width="1.5" stroke-dasharray="5 4" />
          <g transform="translate(${cx - 16}, ${cy - 16})" stroke="#ef4444" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="24" height="14" rx="2" />
            <circle cx="10.5" cy="9.5" r="1.5" fill="#ef4444" stroke="none" />
            <path d="M12 18 L17 11.5 L23 18" />
            <line x1="2" y1="18.5" x2="30" y2="18.5" stroke="#fca5a5" stroke-dasharray="2.5 2" />
            <line x1="8" y1="21" x2="8" y2="29" />
            <line x1="13.5" y1="21" x2="12.5" y2="29" />
            <line x1="18.5" y1="21" x2="19.5" y2="29" />
            <line x1="24" y1="21" x2="24" y2="29" />
          </g>
          <text x="${cx}" y="${thumbY + thumbH - 16}" text-anchor="middle" font-family="${fontFamily}" font-size="11" font-weight="600" fill="#f87171">${escapeXml(labels.deletedImage || 'Image Deleted')}</text>
        `;
      } else {
        const cx = thumbX + thumbW / 2;
        const cy = thumbY + thumbH / 2;
        thumbContent = `
          <rect x="${thumbX}" y="${thumbY}" width="${thumbW}" height="${thumbH}" rx="8" fill="${thumbPlaceholderBg}" stroke="${thumbPlaceholderStroke}" stroke-width="1.5" stroke-dasharray="5 4" />
          <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="${fontFamily}" font-size="11" font-weight="500" fill="${thumbPlaceholderText}">${escapeXml(node.image ? (labels.imageSnapshot || 'Image Snapshot') : (labels.noImage || 'No Image'))}</text>
        `;
      }

      const pinBadgeSvg =
        node.pins && node.pins.length > 0
          ? `<g>
              <rect x="${x + NODE_WIDTH - 42}" y="${y + 52}" width="26" height="18" rx="9" fill="#2563eb" stroke="${nodeBg}" stroke-width="1.5" />
              <text x="${x + NODE_WIDTH - 29}" y="${y + 64.5}" text-anchor="middle" font-family="${fontFamily}" font-size="10" font-weight="700" fill="#ffffff">${node.pins.length}</text>
            </g>`
          : '';

      const portDots = [
        { cx: x + NODE_WIDTH / 2, cy: y },
        { cx: x + NODE_WIDTH / 2, cy: y + NODE_HEIGHT },
        { cx: x, cy: y + NODE_HEIGHT / 2 },
        { cx: x + NODE_WIDTH, cy: y + NODE_HEIGHT / 2 },
      ]
        .map(
          (p) =>
            `<circle cx="${p.cx}" cy="${p.cy}" r="5" fill="#171717" stroke="#3b82f6" stroke-width="2" />`
        )
        .join('');

      const nodeLbl = node.labelId ? state.labels[node.labelId] : undefined;
      const effectiveNodeBorder = nodeLbl ? nodeLbl.color : nodeBorder;
      const nodeLabelStripSvg = nodeLbl
        ? `<path d="M ${x + 12} ${y} H ${x + NODE_WIDTH - 12} Q ${x + NODE_WIDTH} ${y} ${x + NODE_WIDTH} ${y + 3} H ${x} Q ${x} ${y} ${x + 12} ${y} Z" fill="${escapeXml(nodeLbl.color)}" />`
        : '';
      const nodeLabelBadgeSvg = nodeLbl
        ? (() => {
            const lblText = truncateText(nodeLbl.name, 16);
            const pillW = Math.min(126, Math.max(46, lblText.length * 5.8 + 16));
            const pillFg = getContrastTextColor(nodeLbl.color);
            return `<g>
              <rect x="${x + 14}" y="${y + 139}" width="${pillW}" height="16" rx="8" fill="${escapeXml(nodeLbl.color)}" />
              <text x="${x + 14 + pillW / 2}" y="${y + 150}" text-anchor="middle" font-family="${fontFamily}" font-size="9" font-weight="600" fill="${pillFg}">${escapeXml(lblText)}</text>
            </g>`;
          })()
        : '';

      return `
        <g>
          <rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="${nodeBg}" stroke="${escapeXml(effectiveNodeBorder)}" stroke-width="1.5" />
          <path d="M ${x + 12} ${y} H ${x + NODE_WIDTH - 12} Q ${x + NODE_WIDTH} ${y} ${x + NODE_WIDTH} ${y + 12} V ${y + 37} H ${x} V ${y + 12} Q ${x} ${y} ${x + 12} ${y} Z" fill="${nodeHeaderBg}" />
          ${nodeLabelStripSvg}
          <line x1="${x}" y1="${y + 37}" x2="${x + NODE_WIDTH}" y2="${y + 37}" stroke="${useLightSurface ? '#e4e4e7' : '#262626'}" stroke-width="1" />
          <text x="${x + 12}" y="${y + 23}" font-family="${fontFamily}" font-size="12" font-weight="600" fill="${nodeTitleColor}">${escapeXml(truncateText(node.title || labels.defaultScene || 'Scene', 28))}</text>
          ${thumbContent}
          ${nodeLabelBadgeSvg}
          ${pinBadgeSvg}
          ${portDots}
        </g>
      `;
    })
    .join('\n');

  // 4. Annotations & Floating Texts layer
  const otherTexts = Object.values(state.texts).filter((t) => t.mode !== 'container');
  const textsSvg = otherTexts
    .map((el: TextElement) => {
      const x = parseFloat(el.x) || 0;
      const y = parseFloat(el.y) || 0;

      const lbl = el.labelId ? state.labels[el.labelId] : undefined;

      if (el.mode === 'annotation') {
        const noteBg = useLightThemePalette ? '#e9e1c9' : useLightSurface ? '#fffbeb' : '#291a03';
        const defaultNoteBorder = useLightThemePalette ? '#c9bd98' : useLightSurface ? '#fcd34d' : '#92400e';
        const noteBorder = lbl ? lbl.color : defaultNoteBorder;
        const noteDivider = useLightThemePalette ? '#d5cab0' : useLightSurface ? '#fde68a' : '#78350f';
        const noteText = useLightThemePalette ? '#2b2821' : useLightSurface ? '#171717' : '#fef3c7';
        const noteW = el.width || 220;
        const maxBodyChars = Math.max(12, Math.floor((noteW - 24) / 6.5));
        const maxTitleChars = Math.max(10, Math.floor((noteW - 24) / 7.2));
        const bodyLines = wrapTextLines(el.body || '', maxBodyChars, 12);
        const cardH = Math.max(el.height || 0, 56 + bodyLines.length * 16, 96);

        const bodyTspans = bodyLines
          .map(
            (line, idx) =>
              `<tspan x="${x + 12}" dy="${idx === 0 ? 0 : 16}">${escapeXml(line || ' ')}</tspan>`
          )
          .join('');

        const noteBadgeSvg = lbl
          ? (() => {
              const badgeTxt = truncateText(lbl.name, 18);
              const badgeW = Math.min(132, Math.max(48, badgeTxt.length * 6 + 16));
              const badgeFg = getContrastTextColor(lbl.color);
              return `<g>
                <rect x="${x + 10}" y="${y - 9}" width="${badgeW}" height="16" rx="8" fill="${escapeXml(lbl.color)}" />
                <text x="${x + 10 + badgeW / 2}" y="${y + 2}" text-anchor="middle" font-family="${fontFamily}" font-size="9" font-weight="600" fill="${badgeFg}">${escapeXml(badgeTxt)}</text>
              </g>`;
            })()
          : '';

        return `
          <g>
            <rect x="${x}" y="${y}" width="${noteW}" height="${cardH}" rx="12" fill="${noteBg}" stroke="${escapeXml(noteBorder)}" stroke-width="${lbl ? '1.6' : '1.2'}" />
            ${noteBadgeSvg}
            <text x="${x + 12}" y="${y + 22}" font-family="${fontFamily}" font-size="12" font-weight="700" fill="${noteText}">${escapeXml(truncateText(el.text || labels.defaultStickyNote || 'Sticky Note', maxTitleChars))}</text>
            <line x1="${x + 12}" y1="${y + 30}" x2="${x + noteW - 12}" y2="${y + 30}" stroke="${noteDivider}" stroke-width="1" />
            <text x="${x + 12}" y="${y + 48}" font-family="${fontFamily}" font-size="12" fill="${noteText}" opacity="0.92">${bodyTspans}</text>
          </g>
        `;
      }

      // Floating text
      const fontSize = el.size || 20;
      const fontWeight = el.bold ? 'bold' : 'normal';
      const fontStyle = el.italic ? 'italic' : 'normal';
      const textColor = el.color || (useLightSurface ? '#171717' : '#e2e8f0');
      const lines = el.width
        ? wrapTextLines(
            el.text || '',
            Math.max(6, Math.floor((el.width - 12) / (fontSize * 0.58))),
            24
          )
        : (el.text || '').split(/\r?\n/);
      const tspans = lines
        .map(
          (line, idx) =>
            `<tspan x="${x + 6}" dy="${idx === 0 ? 0 : fontSize * 1.25}">${escapeXml(line || ' ')}</tspan>`
        )
        .join('');

      const floatingBadgeSvg = lbl
        ? (() => {
            const badgeTxt = truncateText(lbl.name, 18);
            const badgeW = Math.min(132, Math.max(46, badgeTxt.length * 6 + 16));
            const badgeFg = getContrastTextColor(lbl.color);
            return `<g>
              <rect x="${x + 6}" y="${y - 16}" width="${badgeW}" height="15" rx="7.5" fill="${escapeXml(lbl.color)}" />
              <text x="${x + 6 + badgeW / 2}" y="${y - 5.5}" text-anchor="middle" font-family="${fontFamily}" font-size="9" font-weight="600" fill="${badgeFg}">${escapeXml(badgeTxt)}</text>
            </g>`;
          })()
        : '';

      return `<g>
        ${floatingBadgeSvg}
        <text x="${x + 6}" y="${y + 6 + fontSize}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" fill="${escapeXml(textColor)}">${tspans}</text>
      </g>`;
    })
    .join('\n');

  const backgroundRect =
    bgFill !== 'none'
      ? `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${bgFill}" />`
      : '';

  const gridRect =
    includeGrid && background !== 'transparent'
      ? `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="url(#export-grid-pattern)" />`
      : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(bounds.width)}" height="${Math.round(bounds.height)}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">
  <defs>
    ${defs.join('\n')}
  </defs>
  ${backgroundRect}
  ${gridRect}
  ${containerSvg}
  ${connectionsSvg}
  ${nodesSvg}
  ${textsSvg}
</svg>`;

  return { svg, bounds };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportCanvasToFile(
  options: CanvasExportOptions & {
    format: ExportFormat;
    pngScale?: 1 | 2 | 3;
    projectTitle?: string;
    imageCache?: Record<string, string>;
  }
): Promise<void> {
  const { format, pngScale = 2, projectTitle = 'storyboard', scope, imageCache = {} } = options;

  const embeddedImages = await preloadNodeImages(options.state.nodes, imageCache);
  const { svg, bounds } = buildExportSvgString({
    ...options,
    embeddedImages,
  });

  const safeTitle =
    projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'storyboard';
  const scopeTag = scope === 'view' ? 'view' : 'workspace';
  const baseFilename = `${safeTitle}-${scopeTag}`;

  if (format === 'svg') {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    triggerBlobDownload(svgBlob, `${baseFilename}.svg`);
    return;
  }

  // Render SVG onto offscreen canvas for crisp PNG output
  const MAX_CANVAS_DIM = 8192;
  const maxDimScale = Math.min(
    pngScale,
    MAX_CANVAS_DIM / Math.max(1, bounds.width),
    MAX_CANVAS_DIM / Math.max(1, bounds.height)
  );
  const targetWidth = Math.max(1, Math.round(bounds.width * maxDimScale));
  const targetHeight = Math.max(1, Math.round(bounds.height * maxDimScale));

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = () => reject(new Error(options.labels?.errRenderPng || 'Failed to render storyboard vector image to PNG.'));
      imageEl.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(options.labels?.errCanvasInit || 'Could not initialize 2D export canvas.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 1)
    );
    if (!pngBlob) {
      throw new Error(options.labels?.errEncodePng || 'Could not encode PNG file.');
    }

    triggerBlobDownload(pngBlob, `${baseFilename}.png`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
