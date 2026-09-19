import { clamp, distance } from './coords'
import type { Annotation, LineAnnotation, Point, ShapeAnnotation, Size } from './types'
import { nowIso } from './utils'

export const MIN_SHAPE_SIZE = 0.008

export type BoxHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export type LineHandle = 'start' | 'end'
export type ResizeHandle = BoxHandle | LineHandle

export interface HandlePoint {
  id: ResizeHandle
  x: number
  y: number
}

export function isResizableAnnotation(
  annotation: Annotation
): annotation is ShapeAnnotation | LineAnnotation {
  return (
    annotation.type === 'rect' ||
    annotation.type === 'ellipse' ||
    annotation.type === 'line' ||
    annotation.type === 'arrow'
  )
}

export function handleHitRadius(rendered: Size): Point {
  const px = 12
  return {
    x: px / Math.max(rendered.width, 1),
    y: px / Math.max(rendered.height, 1)
  }
}

export function resizeHandles(annotation: Annotation): HandlePoint[] {
  if (annotation.type === 'line' || annotation.type === 'arrow') {
    return [
      { id: 'start', x: annotation.x1, y: annotation.y1 },
      { id: 'end', x: annotation.x2, y: annotation.y2 }
    ]
  }
  if (annotation.type !== 'rect' && annotation.type !== 'ellipse') return []
  const left = annotation.x
  const top = annotation.y
  const right = annotation.x + annotation.width
  const bottom = annotation.y + annotation.height
  const cx = left + annotation.width / 2
  const cy = top + annotation.height / 2
  return [
    { id: 'nw', x: left, y: top },
    { id: 'n', x: cx, y: top },
    { id: 'ne', x: right, y: top },
    { id: 'e', x: right, y: cy },
    { id: 'se', x: right, y: bottom },
    { id: 's', x: cx, y: bottom },
    { id: 'sw', x: left, y: bottom },
    { id: 'w', x: left, y: cy }
  ]
}

export function hitResizeHandle(
  annotation: Annotation,
  point: Point,
  rendered: Size
): ResizeHandle | null {
  const radius = handleHitRadius(rendered)
  let best: { id: ResizeHandle; dist: number } | null = null
  for (const handle of resizeHandles(annotation)) {
    const dx = (point.x - handle.x) / radius.x
    const dy = (point.y - handle.y) / radius.y
    const dist = Math.hypot(dx, dy)
    if (dist <= 1 && (!best || dist < best.dist)) best = { id: handle.id, dist }
  }
  return best?.id ?? null
}

export function cursorForHandle(handle: ResizeHandle): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'start':
    case 'end':
      return 'move'
  }
}

export function resizeAnnotation(
  annotation: Annotation,
  handle: ResizeHandle,
  point: Point
): Annotation {
  const updatedAt = nowIso()
  const x = clamp(point.x, 0, 1)
  const y = clamp(point.y, 0, 1)
  if (annotation.type === 'line' || annotation.type === 'arrow') {
    if (handle === 'start') return { ...annotation, updatedAt, x1: x, y1: y }
    if (handle === 'end') return { ...annotation, updatedAt, x2: x, y2: y }
    return annotation
  }
  if (annotation.type !== 'rect' && annotation.type !== 'ellipse') return annotation
  if (handle === 'start' || handle === 'end') return annotation
  return { ...annotation, updatedAt, ...resizeBox(annotation, handle, x, y) }
}

export function annotationGeometryChanged(before: Annotation, after: Annotation): boolean {
  if (before.type !== after.type) return true
  switch (before.type) {
    case 'line':
    case 'arrow':
      if (after.type !== 'line' && after.type !== 'arrow') return true
      return (
        distance({ x: before.x1, y: before.y1 }, { x: after.x1, y: after.y1 }) > 0.002 ||
        distance({ x: before.x2, y: before.y2 }, { x: after.x2, y: after.y2 }) > 0.002
      )
    case 'rect':
    case 'ellipse':
    case 'text':
      if (after.type !== 'rect' && after.type !== 'ellipse' && after.type !== 'text') return true
      return (
        distance({ x: before.x, y: before.y }, { x: after.x, y: after.y }) > 0.002 ||
        Math.abs(before.width - after.width) > 0.002 ||
        Math.abs(before.height - after.height) > 0.002
      )
    default:
      return before !== after
  }
}

function resizeBox(
  annotation: ShapeAnnotation,
  handle: BoxHandle,
  x: number,
  y: number
): Pick<ShapeAnnotation, 'x' | 'y' | 'width' | 'height'> {
  let left = annotation.x
  let top = annotation.y
  let right = annotation.x + annotation.width
  let bottom = annotation.y + annotation.height
  if (handle.includes('w')) left = x
  if (handle.includes('e')) right = x
  if (handle.includes('n')) top = y
  if (handle.includes('s')) bottom = y
  const nextX = Math.min(left, right)
  const nextY = Math.min(top, bottom)
  return {
    x: nextX,
    y: nextY,
    width: Math.max(Math.abs(right - left), MIN_SHAPE_SIZE),
    height: Math.max(Math.abs(bottom - top), MIN_SHAPE_SIZE)
  }
}
