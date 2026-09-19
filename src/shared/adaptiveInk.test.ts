import { describe, expect, it } from 'vitest'
import { TEXT_INK_RGB, TEXT_ON_DARK_RGB } from './contrastInk'
import { compositeGlyphInk, fillPaperPixels, inkMapFromBackground } from './adaptiveInk'

function rgba(width: number, height: number, fill: [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0]
    data[i + 1] = fill[1]
    data[i + 2] = fill[2]
    data[i + 3] = fill[3]
  }
  return data
}

describe('adaptive ink', () => {
  it('fills missing samples with cream paper', () => {
    const data = new Uint8ClampedArray(8)
    fillPaperPixels(data)
    expect([...data.slice(0, 4)]).toEqual([255, 254, 248, 255])
  })

  it('switches ink at a navy/paper cut so a glyph can be two colors', () => {
    const width = 4
    const height = 1
    const bg = new Uint8ClampedArray(width * height * 4)
    const navy = [31, 78, 121, 255] as const
    const paper = [255, 255, 255, 255] as const
    for (let x = 0; x < width; x++) {
      const color = x < 2 ? navy : paper
      bg.set(color, x * 4)
    }
    const ink = inkMapFromBackground(bg, width, height, 0)
    expect([...ink.slice(0, 3)]).toEqual([...TEXT_ON_DARK_RGB])
    expect([...ink.slice(4, 7)]).toEqual([...TEXT_ON_DARK_RGB])
    expect([...ink.slice(8, 11)]).toEqual([...TEXT_INK_RGB])
    expect([...ink.slice(12, 15)]).toEqual([...TEXT_INK_RGB])

    const blurred = inkMapFromBackground(bg, width, height, 1)
    expect([...blurred.slice(0, 3)]).toEqual([...TEXT_ON_DARK_RGB])
    expect([...blurred.slice(12, 15)]).toEqual([...TEXT_INK_RGB])

    const glyph = rgba(width, height, [255, 255, 255, 255])
    const out = new Uint8ClampedArray(width * height * 4)
    compositeGlyphInk(glyph, ink, out)
    expect(out[3]).toBe(255)
    expect([...out.slice(0, 3)]).toEqual([...TEXT_ON_DARK_RGB])
    expect([...out.slice(12, 15)]).toEqual([...TEXT_INK_RGB])
  })

  it('keeps glyph holes empty', () => {
    const ink = inkMapFromBackground(rgba(1, 1, [255, 255, 255, 255]), 1, 1, 0)
    const glyph = rgba(1, 1, [255, 255, 255, 0])
    const out = new Uint8ClampedArray(4)
    compositeGlyphInk(glyph, ink, out)
    expect(out[3]).toBe(0)
  })
})
