import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PENCIL_WIDTH_PT,
  DEFAULT_TOOL_COLORS,
  HIGHLIGHT_COLOR,
  HIGHLIGHT_SWATCHES,
  INK_SWATCHES,
  MAX_PENCIL_WIDTH_PT,
  MAX_TEXT_SIZE_PT,
  MIN_PENCIL_WIDTH_PT,
  MIN_TEXT_SIZE_PT,
  PENCIL_COLOR,
  SHAPE_COLOR,
  clampPencilWidth,
  clampTextSize,
  isColorableTool,
  pencilWidthLabel,
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

  it('lets the pencil go fine enough for small math marks', () => {
    expect(clampPencilWidth(0.5)).toBe(0.5)
    expect(clampPencilWidth(0.1)).toBe(MIN_PENCIL_WIDTH_PT)
    expect(clampPencilWidth(12)).toBe(MAX_PENCIL_WIDTH_PT)
    expect(pencilWidthLabel(0.6)).toBe('Fine')
    expect(pencilWidthLabel(DEFAULT_PENCIL_WIDTH_PT)).toBe('Medium')
  })

  it('keeps typed text between a small-blank size and a heading size', () => {
    expect(clampTextSize(8)).toBe(8)
    expect(clampTextSize(3)).toBe(MIN_TEXT_SIZE_PT)
    expect(clampTextSize(80)).toBe(MAX_TEXT_SIZE_PT)
  })
})
