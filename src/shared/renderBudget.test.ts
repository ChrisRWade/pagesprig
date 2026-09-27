import { describe, expect, it } from 'vitest'
import { bitmapMeetsWidth, quantizeRenderWidth } from './renderBudget'

describe('render budget', () => {
  it('snaps page widths so hover previews reuse the same cache slot', () => {
    expect(quantizeRenderWidth(421)).toBe(416)
    expect(quantizeRenderWidth(428)).toBe(432)
    expect(quantizeRenderWidth(8)).toBe(16)
  })

  it('treats a slightly smaller bitmap as sharp enough', () => {
    expect(bitmapMeetsWidth(600, 420, 1.5)).toBe(true)
    expect(bitmapMeetsWidth(126, 420, 1.5)).toBe(false)
  })
})
