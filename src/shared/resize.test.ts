import { describe, expect, it } from 'vitest'
import {
  annotationGeometryChanged,
  cursorForHandle,
  hitResizeHandle,
  isResizableAnnotation,
  resizeAnnotation,
  resizeHandles
} from './resize'
import type { LineAnnotation, ShapeAnnotation, StrokeAnnotation } from './types'

const rendered = { width: 800, height: 1000 }

const box = (): ShapeAnnotation => ({
  id: 'box',
  type: 'rect',
  page: 1,
  createdAt: '2026-09-18T12:00:00.000Z',
  updatedAt: '2026-09-18T12:00:00.000Z',
  style: { color: '#1F4E79', width: 2, opacity: 1 },
  x: 0.2,
  y: 0.2,
  width: 0.2,
  height: 0.1
})

const line = (): LineAnnotation => ({
  id: 'line',
  type: 'line',
  page: 1,
  createdAt: '2026-09-18T12:00:00.000Z',
  updatedAt: '2026-09-18T12:00:00.000Z',
  style: { color: '#1F4E79', width: 2, opacity: 1 },
  x1: 0.1,
  y1: 0.1,
  x2: 0.4,
  y2: 0.3
})

const stroke = (): StrokeAnnotation => ({
  id: 's',
  type: 'stroke',
  page: 1,
  createdAt: '2026-09-18T12:00:00.000Z',
  updatedAt: '2026-09-18T12:00:00.000Z',
  style: { color: '#000', width: 1.6, opacity: 1 },
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.3, y: 0.3 }
  ]
})

describe('shape resize', () => {
  it('only offers handles for boxes, circles, lines, and arrows', () => {
    expect(isResizableAnnotation(box())).toBe(true)
    expect(isResizableAnnotation(line())).toBe(true)
    expect(isResizableAnnotation({ ...line(), type: 'arrow' })).toBe(true)
    expect(isResizableAnnotation({ ...box(), type: 'ellipse' })).toBe(true)
    expect(isResizableAnnotation(stroke())).toBe(false)
    expect(resizeHandles(stroke())).toEqual([])
    expect(resizeHandles(box()).map((item) => item.id)).toEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'])
    expect(resizeHandles(line()).map((item) => item.id)).toEqual(['start', 'end'])
  })

  it('grows a box from the south-east corner', () => {
    const next = resizeAnnotation(box(), 'se', { x: 0.5, y: 0.45 })
    expect(next.type).toBe('rect')
    if (next.type !== 'rect') return
    expect(next.x).toBeCloseTo(0.2)
    expect(next.y).toBeCloseTo(0.2)
    expect(next.width).toBeCloseTo(0.3)
    expect(next.height).toBeCloseTo(0.25)
  })

  it('keeps the opposite corner when dragging north-west, including a flip', () => {
    const next = resizeAnnotation(box(), 'nw', { x: 0.5, y: 0.4 })
    expect(next.type).toBe('rect')
    if (next.type !== 'rect') return
    expect(next.x).toBeCloseTo(0.4)
    expect(next.y).toBeCloseTo(0.3)
    expect(next.width).toBeCloseTo(0.1)
    expect(next.height).toBeCloseTo(0.1)
  })

  it('moves a line by one endpoint', () => {
    const next = resizeAnnotation(line(), 'end', { x: 0.8, y: 0.9 })
    expect(next.type).toBe('line')
    if (next.type !== 'line') return
    expect(next.x1).toBeCloseTo(0.1)
    expect(next.y1).toBeCloseTo(0.1)
    expect(next.x2).toBeCloseTo(0.8)
    expect(next.y2).toBeCloseTo(0.9)
  })

  it('hits the nearest handle in screen space', () => {
    expect(hitResizeHandle(box(), { x: 0.4, y: 0.3 }, rendered)).toBe('se')
    expect(hitResizeHandle(box(), { x: 0.2, y: 0.2 }, rendered)).toBe('nw')
    expect(hitResizeHandle(line(), { x: 0.1, y: 0.1 }, rendered)).toBe('start')
    expect(hitResizeHandle(box(), { x: 0.7, y: 0.7 }, rendered)).toBeNull()
  })

  it('uses resize cursors for box handles', () => {
    expect(cursorForHandle('se')).toBe('nwse-resize')
    expect(cursorForHandle('n')).toBe('ns-resize')
    expect(cursorForHandle('end')).toBe('move')
  })

  it('notices when geometry actually changed', () => {
    expect(annotationGeometryChanged(box(), box())).toBe(false)
    expect(annotationGeometryChanged(box(), resizeAnnotation(box(), 'se', { x: 0.55, y: 0.4 }))).toBe(true)
  })
})
