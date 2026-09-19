import { TEXT_COLOR } from './constants'

export const TEXT_ON_DARK = '#FFFFFF'
export const TEXT_INK_RGB = [0x1a, 0x16, 0x12] as const
export const TEXT_ON_DARK_RGB = [255, 255, 255] as const

function srgbToLinear(channel: number): number {
  const s = channel / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(a: number, b: number): number {
  const light = Math.max(a, b)
  const dark = Math.min(a, b)
  return (light + 0.05) / (dark + 0.05)
}

export function averageRgb(data: Uint8ClampedArray | Uint8Array): { r: number; g: number; b: number } {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 16) continue
    const a = alpha / 255
    r += data[i] * a
    g += data[i + 1] * a
    b += data[i + 2] * a
    count += a
  }
  if (count < 0.001) return { r: 255, g: 254, b: 248 }
  return { r: r / count, g: g / count, b: b / count }
}

export function prefersWhiteInk(r: number, g: number, b: number): boolean {
  const background = relativeLuminance(r, g, b)
  const black = relativeLuminance(TEXT_INK_RGB[0], TEXT_INK_RGB[1], TEXT_INK_RGB[2])
  const white = 1
  return contrastRatio(background, white) > contrastRatio(background, black)
}

/** Pick black or white ink so type stays readable on a sampled page color. */
export function pickContrastInk(r: number, g: number, b: number): string {
  return prefersWhiteInk(r, g, b) ? TEXT_ON_DARK : TEXT_COLOR
}

export function pickContrastInkRgb(r: number, g: number, b: number): readonly [number, number, number] {
  return prefersWhiteInk(r, g, b) ? TEXT_ON_DARK_RGB : TEXT_INK_RGB
}
