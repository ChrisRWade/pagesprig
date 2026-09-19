import { TEXT_COLOR } from '@shared/constants'
import { averageRgb, pickContrastInk } from '@shared/contrastInk'

const SAMPLE = 16

let scratch: HTMLCanvasElement | null = null

function scratchContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!scratch) scratch = document.createElement('canvas')
  scratch.width = SAMPLE
  scratch.height = SAMPLE
  return scratch.getContext('2d', { willReadFrequently: true })
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Sample a 16×16 downsample of the PDF canvas under a normalized box. */
export function contrastInkFromCanvas(
  canvas: HTMLCanvasElement | null | undefined,
  box: Box,
  rendered: { width: number; height: number }
): string {
  if (!canvas || rendered.width <= 0 || rendered.height <= 0) return TEXT_COLOR
  const ctx = scratchContext()
  if (!ctx) return TEXT_COLOR

  const scaleX = canvas.width / rendered.width
  const scaleY = canvas.height / rendered.height
  const sx = Math.max(0, box.x * rendered.width * scaleX)
  const sy = Math.max(0, box.y * rendered.height * scaleY)
  const sw = Math.max(1, box.width * rendered.width * scaleX)
  const sh = Math.max(1, box.height * rendered.height * scaleY)
  if (sx >= canvas.width || sy >= canvas.height) return TEXT_COLOR

  const width = Math.min(sw, canvas.width - sx)
  const height = Math.min(sh, canvas.height - sy)
  if (width < 1 || height < 1) return TEXT_COLOR

  try {
    ctx.clearRect(0, 0, SAMPLE, SAMPLE)
    ctx.drawImage(canvas, sx, sy, width, height, 0, 0, SAMPLE, SAMPLE)
    const pixels = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data
    const rgb = averageRgb(pixels)
    return pickContrastInk(rgb.r, rgb.g, rgb.b)
  } catch {
    return TEXT_COLOR
  }
}
