import type { Annotation, Point } from './types'
import { distance } from './coords'

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function annotationBounds(annotation: Annotation): {
  x: number
  y: number
  width: number
  height: number
} {
  switch (annotation.type) {
    case 'stroke':
    case 'highlight': {
      if (annotation.points.length === 0) {
        return { x: 0, y: 0, width: 0.002, height: 0.002 }
      }
      const xs = annotation.points.map((p) => p.x)
      const ys = annotation.points.map((p) => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xs)
      const maxY = Math.max(...ys)
      const pad = 0.006
      const x = Math.max(0, minX - pad)
      const y = Math.max(0, minY - pad)
      const right = Math.min(1, maxX + pad)
      const bottom = Math.min(1, maxY + pad)
      return {
        x,
        y,
        width: Math.max(right - x, 0.002),
        height: Math.max(bottom - y, 0.002)
      }
    }
    case 'line':
    case 'arrow': {
      const minX = Math.min(annotation.x1, annotation.x2)
      const minY = Math.min(annotation.y1, annotation.y2)
      return {
        x: minX,
        y: minY,
        width: Math.abs(annotation.x2 - annotation.x1) || 0.002,
        height: Math.abs(annotation.y2 - annotation.y1) || 0.002
      }
    }
    case 'text':
    case 'rect':
    case 'ellipse':
      return { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height }
    case 'checkmark':
    case 'xmark':
      return { x: annotation.x, y: annotation.y, width: annotation.size, height: annotation.size }
  }
}

function pointNearSegment(point: Point, a: Point, b: Point, threshold: number): boolean {
  const length = distance(a, b)
  if (length === 0) return distance(point, a) <= threshold
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (length * length))
  )
  const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  return distance(point, projection) <= threshold
}

export function hitTestAnnotation(annotation: Annotation, point: Point, threshold = 0.018): boolean {
  const bounds = annotationBounds(annotation)
  const padded = {
    x: bounds.x - threshold,
    y: bounds.y - threshold,
    width: bounds.width + threshold * 2,
    height: bounds.height + threshold * 2
  }
  const insideBox =
    point.x >= padded.x &&
    point.x <= padded.x + padded.width &&
    point.y >= padded.y &&
    point.y <= padded.y + padded.height

  if (annotation.type === 'stroke' || annotation.type === 'highlight') {
    for (let i = 1; i < annotation.points.length; i += 1) {
      if (pointNearSegment(point, annotation.points[i - 1], annotation.points[i], threshold)) {
        return true
      }
    }
    return false
  }
  if (annotation.type === 'line' || annotation.type === 'arrow') {
    return pointNearSegment(
      point,
      { x: annotation.x1, y: annotation.y1 },
      { x: annotation.x2, y: annotation.y2 },
      threshold
    )
  }
  return insideBox
}

export function moveAnnotation(annotation: Annotation, dx: number, dy: number): Annotation {
  const updatedAt = nowIso()
  switch (annotation.type) {
    case 'stroke':
    case 'highlight':
      return {
        ...annotation,
        updatedAt,
        points: annotation.points.map((point) => ({
          ...point,
          x: point.x + dx,
          y: point.y + dy
        }))
      }
    case 'line':
    case 'arrow':
      return {
        ...annotation,
        updatedAt,
        x1: annotation.x1 + dx,
        y1: annotation.y1 + dy,
        x2: annotation.x2 + dx,
        y2: annotation.y2 + dy
      }
    case 'text':
    case 'rect':
    case 'ellipse':
      return { ...annotation, updatedAt, x: annotation.x + dx, y: annotation.y + dy }
    case 'checkmark':
    case 'xmark':
      return { ...annotation, updatedAt, x: annotation.x + dx, y: annotation.y + dy }
  }
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  const wrapped = ((...args: never[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }) as T & { cancel: () => void }
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer)
  }
  return wrapped
}

export function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    const now = new Date()
    const sameDay = date.toDateString() === now.toDateString()
    return new Intl.DateTimeFormat(undefined, {
      weekday: sameDay ? undefined : 'short',
      month: sameDay ? undefined : 'short',
      day: sameDay ? undefined : 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date)
  } catch {
    return iso
  }
}

export function localIsoDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  date.setDate(date.getDate() + days)
  return localIsoDate(date)
}

export function schoolDayWindow(dates: string[], selected: string, today: string, size = 7): string[] {
  const unique = [...new Set([...dates, selected, today])].filter(Boolean).sort()
  if (unique.length <= size) return unique
  const index = Math.max(0, unique.indexOf(selected))
  const start = Math.max(0, Math.min(index - Math.floor(size / 2), unique.length - size))
  return unique.slice(start, start + size)
}

export function formatDate(isoDate: string): string {
  try {
    const date = new Date(`${isoDate}T00:00:00`)
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(date)
  } catch {
    return isoDate
  }
}

export function formatShortDate(isoDate: string): string {
  try {
    const date = new Date(`${isoDate}T00:00:00`)
    if (Number.isNaN(date.getTime())) return isoDate
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date)
  } catch {
    return isoDate
  }
}

export function formatDayChip(isoDate: string): { weekday: string; day: string } {
  try {
    const date = new Date(`${isoDate}T00:00:00`)
    if (Number.isNaN(date.getTime())) return { weekday: isoDate, day: isoDate }
    return {
      weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
      day: String(date.getDate())
    }
  } catch {
    return { weekday: isoDate, day: isoDate }
  }
}
