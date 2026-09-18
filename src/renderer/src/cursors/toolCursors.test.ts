import { describe, expect, it } from 'vitest'
import type { ToolId } from '@shared/types'
import {
  CENTER_ALIGNED_TOOLS,
  cssCursorForTool,
  CURSOR_SPECS,
  TIP_ALIGNED_TOOLS,
  TOOL_CURSORS
} from './toolCursors'

const TOOLS: ToolId[] = [
  'select',
  'pencil',
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

function hotspotOf(tool: ToolId): [number, number] {
  const match = cssCursorForTool(tool).match(/ 2x\) (\d+) (\d+), /)
  if (!match) throw new Error(`No hotspot in cursor CSS for ${tool}`)
  return [Number(match[1]), Number(match[2])]
}

describe('tool cursors', () => {
  it('gives every tool a unique HiDPI cursor with a hotspot and fallback', () => {
    const values = TOOLS.map(cssCursorForTool)
    expect(new Set(values).size).toBe(TOOLS.length)
    expect(Object.keys(TOOL_CURSORS)).toHaveLength(TOOLS.length)
    for (const value of values) {
      expect(value.startsWith('image-set(')).toBe(true)
      expect(value).toContain(' 1x, ')
      expect(value).toContain(' 2x) ')
      expect(value).toMatch(/ \d+ \d+, [a-z]+$/)
      expect(value).toContain(encodeURIComponent('xmlns="http://www.w3.org/2000/svg"'))
    }
  })

  it('puts the hotspot on the tip of pointing tools', () => {
    expect(CURSOR_SPECS.select.hotspot).toEqual([1, 1])
    expect(CURSOR_SPECS.pencil.hotspot).toEqual([1, 30])
    for (const tool of TIP_ALIGNED_TOOLS) {
      expect(hotspotOf(tool)).toEqual([...CURSOR_SPECS[tool].hotspot])
    }
  })

  it('puts the hotspot at the 32px canvas center for precision, stamp, and nib tools', () => {
    for (const tool of CENTER_ALIGNED_TOOLS) {
      expect(CURSOR_SPECS[tool].hotspot).toEqual([16, 16])
      expect(hotspotOf(tool)).toEqual([16, 16])
    }
  })
})
