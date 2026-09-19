import { describe, expect, it } from 'vitest'
import { TEXT_COLOR } from './constants'
import { averageRgb, pickContrastInk, relativeLuminance, TEXT_ON_DARK } from './contrastInk'

describe('contrast ink', () => {
  it('uses black on cream paper and white on dark fills', () => {
    expect(pickContrastInk(255, 254, 248)).toBe(TEXT_COLOR)
    expect(pickContrastInk(255, 255, 255)).toBe(TEXT_COLOR)
    expect(pickContrastInk(26, 22, 18)).toBe(TEXT_ON_DARK)
    expect(pickContrastInk(31, 78, 121)).toBe(TEXT_ON_DARK)
    expect(relativeLuminance(255, 255, 255)).toBeGreaterThan(0.9)
  })

  it('averages opaque pixels and ignores holes', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 0,
      255, 255, 255, 255
    ])
    const rgb = averageRgb(data)
    expect(rgb.r).toBeGreaterThan(250)
    expect(rgb.g).toBeGreaterThan(250)
    expect(rgb.b).toBeGreaterThan(250)
  })
})
