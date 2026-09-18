import type { ToolId } from '@shared/types'

/**
 * Custom worksheet cursors.
 *
 * Hotspot rules (Microsoft Win32 "About Cursors", Apple HIG pointers,
 * Photoshop/Figma precision tools):
 * - Arrow / pencil: the tip pixel is the event location
 * - Crosshair / I-beam / stamp / eraser: the geometric center is the event location
 * - Never let a stroke grow past a tip — it shifts where the click feels
 * - White halo, no drop shadow (shadows pull the perceived point off the hotspot)
 * - image-set 1x/2x so Electron/Chromium stays sharp on HiDPI; hotspot stays in 1x space
 */
const INK = '#1A1612'
const HALO = '#FFFFFF'
const NAVY = '#1F4E79'
const GOLD = '#F5D76E'
const GOLD_EDGE = '#7C6414'
const GREEN = '#2F6B4F'
const RED = '#9B2C1A'
const ERASER_PINK = '#E59BB0'
const ERASER_BAND = '#B56F82'
const WOOD = '#E8C49A'
const GRAPHITE = '#1A1612'
const BARREL = '#E2B13C'
const FERRULE = '#C9C4BC'

export interface CursorSpec {
  /** Hotspot in 32×32 user space (CSS 1x pixels). */
  hotspot: readonly [number, number]
  fallback: string
  /** Inner SVG markup in viewBox 0 0 32 32. */
  art: string
}

function svgDoc(art: string, pixelSize: 32 | 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" viewBox="0 0 32 32" fill="none" shape-rendering="geometricPrecision">${art}</svg>`
}

function strokePair(d: string, color: string, width: number, extra = ''): string {
  const halo = Math.max(width + 2.2, 3.2)
  return `<path d="${d}" stroke="${HALO}" stroke-width="${halo}" fill="none" ${extra}/><path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" ${extra}/>`
}

const CROSSHAIR_TICKS = 'M16 1v9.5M16 21.5v9.5M1 16h9.5M21.5 16h9.5'
const CROSSHAIR_ATTR = 'stroke-linecap="butt" stroke-linejoin="miter"'

function precisionCursor(badge: string): string {
  return `${strokePair(CROSSHAIR_TICKS, NAVY, 1.5, CROSSHAIR_ATTR)}${badge}`
}

function badgeStroke(d: string): string {
  return strokePair(d, NAVY, 1.45, 'stroke-linecap="round" stroke-linejoin="round"')
}

function badgeShape(outline: string, inner: string): string {
  return `${outline}${inner}`
}

export const CURSOR_SPECS: Record<ToolId, CursorSpec> = {
  select: {
    hotspot: [1, 1],
    fallback: 'default',
    // Windows-style pointer. Outline and fill share the tip so (1,1) is the true point.
    art: `<path fill="${HALO}" d="M1 1v20.2l5.2-5 4.2 9.8 3.4-1.5-4.2-9.7h7.6z"/><path fill="${INK}" d="M1 1v18.4l4.6-4.4 3.8 8.8 2-0.9-3.8-8.7h6.4z"/>`
  },
  pencil: {
    hotspot: [1, 30],
    fallback: 'crosshair',
    art: `<g transform="translate(1 30) rotate(42)">
      <path fill="${HALO}" d="M0 0L3.15-7.2V-27.2h-6.3V-7.2z"/>
      <path fill="${GRAPHITE}" d="M0 0l2.15-5.3h-4.3z"/>
      <path fill="${WOOD}" d="M-2.15-5.3h4.3L2.95-8.8h-5.9z"/>
      <path fill="${BARREL}" d="M-2.95-8.8h5.9v-11.6h-5.9z"/>
      <path fill="${FERRULE}" d="M-3.15-20.4h6.3v2.7h-6.3z"/>
      <path fill="${ERASER_PINK}" d="M-2.85-23.2h5.7v2.8h-5.7z"/>
      <path fill="${INK}" fill-opacity=".16" d="M.35-23.2h1.05v14.4H.35z"/>
    </g>`
  },
  highlighter: {
    hotspot: [16, 16],
    fallback: 'crosshair',
    // Chisel face is centered on the hotspot so the stroke lands in the nib, not the barrel.
    art: `<g transform="translate(16 16) rotate(40)">
      <rect x="-6.8" y="-2.5" width="13.6" height="5" rx="0.7" fill="${HALO}"/>
      <rect x="6.4" y="-2.7" width="11.2" height="5.4" rx="1.15" fill="${HALO}"/>
      <rect x="-6" y="-1.7" width="12" height="3.4" rx="0.35" fill="#C99418" stroke="${GOLD_EDGE}" stroke-width="0.75"/>
      <path d="M-5.5-1 5.5-1 5.5 1.2-5.5 1.2z" fill="${GOLD}"/>
      <rect x="6.4" y="-1.9" width="9.8" height="3.8" rx="0.85" fill="${GOLD}" stroke="${GOLD_EDGE}" stroke-width="0.7"/>
      <rect x="14.6" y="-1.4" width="2.2" height="2.8" rx="0.5" fill="${ERASER_PINK}"/>
    </g>`
  },
  text: {
    hotspot: [16, 16],
    fallback: 'text',
    art: `<path fill="${HALO}" d="M10.5 1.6h11v4.2h-3.4V26.2h3.4v4.2h-11v-4.2h3.4V5.8h-3.4z"/><path fill="${INK}" d="M12 3h8v2h-3v22h3v2h-8v-2h3V5h-3z"/>`
  },
  line: {
    hotspot: [16, 16],
    fallback: 'crosshair',
    art: precisionCursor(badgeStroke('M23 27.5 29.2 21.3'))
  },
  rect: {
    hotspot: [16, 16],
    fallback: 'crosshair',
    art: precisionCursor(
      badgeShape(
        `<rect x="22.5" y="22.5" width="7.2" height="5.8" stroke="${HALO}" stroke-width="2.8"/>`,
        `<rect x="22.5" y="22.5" width="7.2" height="5.8" stroke="${NAVY}" stroke-width="1.35"/>`
      )
    )
  },
  ellipse: {
    hotspot: [16, 16],
    fallback: 'crosshair',
    art: precisionCursor(
      badgeShape(
        `<ellipse cx="26.1" cy="25.4" rx="4.4" ry="3.4" stroke="${HALO}" stroke-width="2.8"/>`,
        `<ellipse cx="26.1" cy="25.4" rx="4.4" ry="3.4" stroke="${NAVY}" stroke-width="1.35"/>`
      )
    )
  },
  arrow: {
    hotspot: [16, 16],
    fallback: 'crosshair',
    art: precisionCursor(badgeStroke('M23 27.2 29.4 20.8M25.6 20.8H29.4V24.6'))
  },
  checkmark: {
    hotspot: [16, 16],
    fallback: 'copy',
    art: strokePair('M6.5 16.2 13.2 23.2 25.5 8.8', GREEN, 2.45, 'stroke-linecap="round" stroke-linejoin="round"')
  },
  xmark: {
    hotspot: [16, 16],
    fallback: 'copy',
    art: `${strokePair('M8.5 8.5 23.5 23.5', RED, 2.35, 'stroke-linecap="round"')}${strokePair('M23.5 8.5 8.5 23.5', RED, 2.35, 'stroke-linecap="round"')}`
  },
  eraser: {
    hotspot: [16, 16],
    fallback: 'cell',
    art: `<g transform="translate(16 16) rotate(-32)">
      <rect x="-8.2" y="-5.4" width="16.4" height="10.8" rx="2.1" fill="${HALO}"/>
      <rect x="-7.1" y="-4.3" width="14.2" height="8.6" rx="1.6" fill="${ERASER_PINK}" stroke="#7A4454" stroke-width="0.8"/>
      <rect x="-1" y="-4.3" width="2" height="8.6" fill="${ERASER_BAND}"/>
    </g>`
  }
}

export function cursorSvg(tool: ToolId, pixelSize: 32 | 64 = 32): string {
  return svgDoc(CURSOR_SPECS[tool].art, pixelSize)
}

export function cssCursorForTool(tool: ToolId): string {
  const spec = CURSOR_SPECS[tool]
  const url1 = `url("data:image/svg+xml,${encodeURIComponent(cursorSvg(tool, 32))}")`
  const url2 = `url("data:image/svg+xml,${encodeURIComponent(cursorSvg(tool, 64))}")`
  const [x, y] = spec.hotspot
  return `image-set(${url1} 1x, ${url2} 2x) ${x} ${y}, ${spec.fallback}`
}

export const TOOL_CURSORS: Record<ToolId, string> = {
  select: cssCursorForTool('select'),
  pencil: cssCursorForTool('pencil'),
  highlighter: cssCursorForTool('highlighter'),
  text: cssCursorForTool('text'),
  line: cssCursorForTool('line'),
  rect: cssCursorForTool('rect'),
  ellipse: cssCursorForTool('ellipse'),
  arrow: cssCursorForTool('arrow'),
  checkmark: cssCursorForTool('checkmark'),
  xmark: cssCursorForTool('xmark'),
  eraser: cssCursorForTool('eraser')
}

export const TIP_ALIGNED_TOOLS: ToolId[] = ['select', 'pencil']
export const CENTER_ALIGNED_TOOLS: ToolId[] = [
  'highlighter',
  'text',
  'line',
  'rect',
  'ellipse',
  'arrow',
  'checkmark',
  'xmark',
  'eraser'
]
