import type { Size } from '@shared/types'
import type { PageSample } from './adaptiveText'

const livePages = new Map<string, PageSample>()

export function pageSampleKey(documentId: string, page: number): string {
  return `${documentId}:${page}`
}

export function registerPageSample(
  documentId: string,
  page: number,
  canvas: HTMLCanvasElement,
  rendered: Size
): void {
  livePages.set(pageSampleKey(documentId, page), { canvas, rendered: { ...rendered } })
}

export function unregisterPageSample(documentId: string, page: number, canvas?: HTMLCanvasElement): void {
  const key = pageSampleKey(documentId, page)
  const current = livePages.get(key)
  if (canvas && current && current.canvas !== canvas) return
  livePages.delete(key)
}

export function getLivePageSample(documentId: string, page: number): PageSample | undefined {
  return livePages.get(pageSampleKey(documentId, page))
}
