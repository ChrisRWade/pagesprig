import { compositeGlyphInk, fillPaperPixels, inkMapFromBackground } from '@shared/adaptiveInk'
import { textLineHeight, textPadX, textPadY, wrapTextLines } from '@shared/textLayout'

export interface PageBox {
  x: number
  y: number
  width: number
  height: number
}

export interface PageSample {
  canvas: HTMLCanvasElement
  rendered: { width: number; height: number }
}

let sampleScratch: HTMLCanvasElement | null = null
let inkScratch: HTMLCanvasElement | null = null

function sampleContext(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!sampleScratch) sampleScratch = document.createElement('canvas')
  sampleScratch.width = Math.max(1, width)
  sampleScratch.height = Math.max(1, height)
  return sampleScratch.getContext('2d', { willReadFrequently: true })
}

export function samplePageRegion(
  sample: PageSample | null | undefined,
  box: PageBox,
  destW: number,
  destH: number
): ImageData {
  const width = Math.max(1, Math.round(destW))
  const height = Math.max(1, Math.round(destH))
  const fallback = new ImageData(width, height)
  fillPaperPixels(fallback.data)
  if (!sample || sample.rendered.width <= 0 || sample.rendered.height <= 0) return fallback

  const { canvas, rendered } = sample
  const ctx = sampleContext(width, height)
  if (!ctx) return fallback

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#fffef8'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const scaleX = canvas.width / rendered.width
  const scaleY = canvas.height / rendered.height
  const srcX = box.x * rendered.width * scaleX
  const srcY = box.y * rendered.height * scaleY
  const srcW = Math.max(1, box.width * rendered.width * scaleX)
  const srcH = Math.max(1, box.height * rendered.height * scaleY)

  try {
    ctx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, width, height)
    return ctx.getImageData(0, 0, width, height)
  } catch {
    return fallback
  }
}

function glyphFont(fontSizePx: number): string {
  return `400 ${Math.max(1, fontSizePx)}px "Atkinson Hyperlegible", "Segoe UI", sans-serif`
}

export function textFontIsReady(fontSizePx: number): boolean {
  return Boolean(typeof document !== 'undefined' && document.fonts?.check?.(glyphFont(fontSizePx)))
}

function paintGlyphs(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSizePx: number,
  width: number,
  height: number
): void {
  const padX = textPadX(fontSizePx)
  const padY = textPadY(fontSizePx)
  const lineHeight = textLineHeight(fontSizePx)
  ctx.save()
  ctx.font = glyphFont(fontSizePx)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.direction = 'ltr'
  const maxWidth = Math.max(1, width - padX * 2)
  const lines = wrapTextLines(text, maxWidth, (value) => ctx.measureText(value).width)
  let y = padY + (lineHeight - fontSizePx) / 2
  for (const line of lines) {
    if (y >= height) break
    if (line) ctx.fillText(line, padX, y, maxWidth)
    y += lineHeight
  }
  ctx.restore()
}

export function rasterizeAdaptiveTextInto(
  target: HTMLCanvasElement,
  text: string,
  fontSizePx: number,
  pixelWidth: number,
  pixelHeight: number,
  background: ImageData
): boolean {
  const width = Math.max(1, Math.round(pixelWidth))
  const height = Math.max(1, Math.round(pixelHeight))
  target.width = width
  target.height = height
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!text) return true

  const ink = inkMapFromBackground(background.data, background.width, background.height)
  paintGlyphs(ctx, text, fontSizePx, width, height)
  const glyphs = ctx.getImageData(0, 0, width, height)
  const out = ctx.createImageData(width, height)
  compositeGlyphInk(glyphs.data, ink, out.data)
  ctx.putImageData(out, 0, 0)
  return true
}

export function inkMapDataUrl(
  sample: PageSample | null | undefined,
  box: PageBox,
  pixelWidth: number,
  pixelHeight: number
): string | null {
  const width = Math.max(1, Math.round(pixelWidth))
  const height = Math.max(1, Math.round(pixelHeight))
  const background = samplePageRegion(sample, box, width, height)
  const ink = inkMapFromBackground(background.data, background.width, background.height)
  const canvas = inkScratch ?? (typeof document !== 'undefined' ? document.createElement('canvas') : null)
  if (!canvas) return null
  inkScratch = canvas
  canvas.width = background.width
  canvas.height = background.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = ctx.createImageData(background.width, background.height)
  image.data.set(ink)
  ctx.putImageData(image, 0, 0)
  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export function canvasPngBase64(canvas: HTMLCanvasElement): string | null {
  try {
    const url = canvas.toDataURL('image/png')
    const marker = 'base64,'
    const index = url.indexOf(marker)
    return index >= 0 ? url.slice(index + marker.length) : null
  } catch {
    return null
  }
}

export async function waitForTextFont(fontSizePx: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  try {
    await document.fonts.load(glyphFont(fontSizePx))
  } catch {
    /* keep the fallback stack */
  }
}
