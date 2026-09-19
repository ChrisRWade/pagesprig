import { pickContrastInkRgb, TEXT_INK_RGB } from './contrastInk'

const PAPER = { r: 255, g: 254, b: 248 }

export function fillPaperPixels(data: Uint8ClampedArray | Uint8Array): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    data[i] = PAPER.r
    data[i + 1] = PAPER.g
    data[i + 2] = PAPER.b
    data[i + 3] = 255
  }
}

/**
 * Turn a page-background RGBA buffer into black/white ink colors.
 * A 1-pixel box blur on the source keeps noisy scans from sparkling
 * without washing out a hard navy/paper edge.
 */
export function inkMapFromBackground(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  radius = 1
): Uint8ClampedArray {
  const ink = new Uint8ClampedArray(width * height * 4)
  if (width < 1 || height < 1) return ink
  const r = Math.max(0, radius)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0
      let sumG = 0
      let sumB = 0
      let count = 0
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(width - 1, x + r)
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(height - 1, y + r)
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const i = (yy * width + xx) * 4
          if (data[i + 3] < 16) continue
          sumR += data[i]
          sumG += data[i + 1]
          sumB += data[i + 2]
          count += 1
        }
      }
      const o = (y * width + x) * 4
      if (count === 0) {
        ink[o] = TEXT_INK_RGB[0]
        ink[o + 1] = TEXT_INK_RGB[1]
        ink[o + 2] = TEXT_INK_RGB[2]
        ink[o + 3] = 255
        continue
      }
      const rgb = pickContrastInkRgb(sumR / count, sumG / count, sumB / count)
      ink[o] = rgb[0]
      ink[o + 1] = rgb[1]
      ink[o + 2] = rgb[2]
      ink[o + 3] = 255
    }
  }
  return ink
}

/** Color glyph coverage with the local ink map so a letter can split mid-stroke. */
export function compositeGlyphInk(
  glyph: Uint8ClampedArray | Uint8Array,
  ink: Uint8ClampedArray | Uint8Array,
  out: Uint8ClampedArray | Uint8Array
): void {
  const len = Math.min(glyph.length, ink.length, out.length)
  for (let i = 0; i < len; i += 4) {
    out[i] = ink[i]
    out[i + 1] = ink[i + 1]
    out[i + 2] = ink[i + 2]
    out[i + 3] = glyph[i + 3]
  }
}
