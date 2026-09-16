import type { Point, Size } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function screenToNormalized(offsetX: number, offsetY: number, rendered: Size): Point {
  if (rendered.width <= 0 || rendered.height <= 0) {
    return { x: 0, y: 0 }
  }
  return {
    x: clamp(offsetX / rendered.width, 0, 1),
    y: clamp(offsetY / rendered.height, 0, 1)
  }
}

export function normalizedToScreen(point: Point, rendered: Size): Point {
  return {
    x: point.x * rendered.width,
    y: point.y * rendered.height,
    ...(point.p !== undefined ? { p: point.p } : {})
  }
}

/** Convert top-left normalized coordinates to PDF user space (origin bottom-left, points). */
export function normalizedToPdf(point: Point, page: Size): Point {
  return {
    x: point.x * page.width,
    y: (1 - point.y) * page.height
  }
}

export function pdfToNormalized(point: Point, page: Size): Point {
  if (page.width <= 0 || page.height <= 0) {
    return { x: 0, y: 0 }
  }
  return {
    x: point.x / page.width,
    y: 1 - point.y / page.height
  }
}

export function pdfLengthToScreen(lengthPdf: number, page: Size, rendered: Size): number {
  if (page.width <= 0) return lengthPdf
  return lengthPdf * (rendered.width / page.width)
}

export function screenLengthToPdf(lengthScreen: number, page: Size, rendered: Size): number {
  if (rendered.width <= 0) return lengthScreen
  return lengthScreen * (page.width / rendered.width)
}

export function normalizedBoxToPdf(
  box: { x: number; y: number; width: number; height: number },
  page: Size
): { x: number; y: number; width: number; height: number } {
  const topLeft = normalizedToPdf({ x: box.x, y: box.y }, page)
  const width = box.width * page.width
  const height = box.height * page.height
  return {
    x: topLeft.x,
    y: topLeft.y - height,
    width,
    height
  }
}

export function translateNormalized(point: Point, dx: number, dy: number): Point {
  return {
    x: clamp(point.x + dx, 0, 1),
    y: clamp(point.y + dy, 0, 1),
    ...(point.p !== undefined ? { p: point.p } : {})
  }
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}
