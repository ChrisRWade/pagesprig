export function quantizeRenderWidth(width: number, step = 16): number {
  if (!Number.isFinite(width) || width <= 0) return step
  return Math.max(step, Math.round(width / step) * step)
}

export function bitmapMeetsWidth(bitmapWidth: number, cssWidth: number, dpr: number, ratio = 0.9): boolean {
  return bitmapWidth >= cssWidth * dpr * ratio
}
