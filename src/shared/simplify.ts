import type { Point } from './types'
import { distance } from './coords'

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    return distance(point, start)
  }
  const numerator = Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x)
  const denominator = Math.hypot(dx, dy)
  return numerator / denominator
}

function simplifyRange(points: Point[], start: number, end: number, epsilon: number, keep: boolean[]): void {
  if (end <= start + 1) return
  let maxDistance = 0
  let index = start
  for (let i = start + 1; i < end; i += 1) {
    const d = perpendicularDistance(points[i], points[start], points[end])
    if (d > maxDistance) {
      index = i
      maxDistance = d
    }
  }
  if (maxDistance > epsilon) {
    keep[index] = true
    simplifyRange(points, start, index, epsilon, keep)
    simplifyRange(points, index, end, epsilon, keep)
  }
}

/**
 * Ramer–Douglas–Peucker simplification in normalized page space.
 * Epsilon of ~0.001 keeps handwriting readable while dropping noisy pointer jitter.
 */
export function simplifyStroke(points: Point[], epsilon = 0.0012): Point[] {
  if (points.length <= 2) return points.slice()
  const keep = points.map((_, i) => i === 0 || i === points.length - 1)
  simplifyRange(points, 0, points.length - 1, epsilon, keep)
  return points.filter((_, i) => keep[i])
}

/** Drop micro-movements while the pointer is still down. */
export function appendIfMoved(points: Point[], next: Point, minDistance = 0.0015): Point[] {
  const last = points[points.length - 1]
  if (!last || distance(last, next) >= minDistance) {
    return [...points, next]
  }
  return points
}
