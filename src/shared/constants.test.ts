import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOOL_COLORS,
  HIGHLIGHT_COLOR,
  HIGHLIGHT_SWATCHES,
  INK_SWATCHES,
  PENCIL_COLOR,
  SHAPE_COLOR,
  isColorableTool,
  swatchesForTool
} from './constants'

describe('tool color palettes', () => {
  it('keeps a short crayon box of unique ink and highlight colors', () => {
    expect(INK_SWATCHES).toHaveLength(6)
    expect(HIGHLIGHT_SWATCHES).toHaveLength(6)
    expect(new Set(INK_SWATCHES.map((item) => item.value)).size).toBe(6)
    expect(new Set(HIGHLIGHT_SWATCHES.map((item) => item.value)).size).toBe(6)
    for (const swatch of [...INK_SWATCHES, ...HIGHLIGHT_SWATCHES]) {
      expect(swatch.value).toMatch(/^#[0-9A-F]{6}$/i)
      expect(swatch.name.length).toBeGreaterThan(2)
    }
  })

  it('defaults each drawing tool to its original ink', () => {
    expect(DEFAULT_TOOL_COLORS.pencil).toBe(PENCIL_COLOR)
    expect(DEFAULT_TOOL_COLORS.highlighter).toBe(HIGHLIGHT_COLOR)
    expect(DEFAULT_TOOL_COLORS.line).toBe(SHAPE_COLOR)
    expect(swatchesForTool('highlighter')[0].value).toBe(HIGHLIGHT_COLOR)
    expect(swatchesForTool('pencil')[0].value).toBe(PENCIL_COLOR)
    expect(isColorableTool('pencil')).toBe(true)
    expect(isColorableTool('eraser')).toBe(false)
  })
})
