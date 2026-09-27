import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { APP_NAME } from '@shared/constants'
import { pdfProtocolUrl, toPdfBytes } from '@shared/pdfProtocol'
import { bitmapMeetsWidth, quantizeRenderWidth } from '@shared/renderBudget'
import type { PageSource } from '@shared/types'
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'

const cache = new Map<string, PDFDocumentProxy>()
let worker: Worker | null = null

function polyfillUint8Hex(): void {
  const proto = Uint8Array.prototype as Uint8Array & { toHex?: () => string }
  if (typeof proto.toHex === 'function') return
  proto.toHex = function toHex() {
    return Array.from(this, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
}

function ensureWorker(): void {
  polyfillUint8Hex()
  if (worker) return
  worker = new PdfWorker()
  pdfjs.GlobalWorkerOptions.workerPort = worker
}

function describePdfError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : ''
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/password|encrypt/i.test(message) || name === 'PasswordException') {
    return `This PDF is password protected. Unlock it before adding it to ${APP_NAME}.`
  }
  if (/worker/i.test(message)) {
    return `${APP_NAME} could not start the PDF reader. Restart the app and try again.`
  }
  if (name === 'MissingPDFException' || /missing pdf/i.test(message)) {
    return `${APP_NAME} could not find that worksheet in the schoolwork folder.`
  }
  if (
    name === 'UnexpectedResponseException' ||
    /network|fetch|403|404|failed to fetch/i.test(message)
  ) {
    return `${APP_NAME} could not read that worksheet from the schoolwork folder.`
  }
  if (name === 'InvalidPDFException' || /invalid pdf/i.test(message)) {
    return 'That file is not a readable PDF worksheet.'
  }
  if (/toHex is not a function/i.test(message)) {
    return `${APP_NAME} could not read that worksheet. Restart the app and try again.`
  }
  const detail = message.replace(/^Error:\s*/i, '').trim()
  if (detail && detail.length < 180 && !/undefined|null|\[object/i.test(detail)) {
    return `That worksheet could not be opened. ${detail}`
  }
  return 'That worksheet could not be opened. It may be damaged.'
}

async function loadFromProtocol(filePath: string): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({
    url: pdfProtocolUrl(filePath),
    useSystemFonts: true
  }).promise
}

async function loadFromBytes(filePath: string): Promise<PDFDocumentProxy> {
  const result = await window.studyApi.readPdf(filePath)
  if (!result.ok) throw new Error(result.error)
  return pdfjs.getDocument({
    data: toPdfBytes(result.data),
    useSystemFonts: true
  }).promise
}

export async function loadPdfDocument(id: string, filePath: string): Promise<PDFDocumentProxy> {
  ensureWorker()
  const existing = cache.get(id)
  if (existing) return existing
  try {
    let pdf: PDFDocumentProxy
    try {
      pdf = await loadFromProtocol(filePath)
    } catch {
      pdf = await loadFromBytes(filePath)
    }
    cache.set(id, pdf)
    return pdf
  } catch (error) {
    throw new Error(describePdfError(error))
  }
}

export function getLoadedPdf(id: string): PDFDocumentProxy | undefined {
  return cache.get(id)
}

export function forgetPdf(id: string): void {
  const pdf = cache.get(id)
  if (pdf) {
    void pdf.destroy()
    cache.delete(id)
  }
  forgetBitmaps(id)
}

const BITMAP_LIMIT = 64
const bitmaps = new Map<string, ImageBitmap>()
const pinnedKeys = new Set<string>()

export class RenderAbortedError extends Error {
  constructor() {
    super('render aborted')
    this.name = 'RenderAbortedError'
  }
}

function forgetBitmaps(documentId?: string): void {
  for (const [key, bitmap] of bitmaps) {
    if (!documentId || key.startsWith(`${documentId}:`)) {
      bitmap.close()
      bitmaps.delete(key)
    }
  }
}

function touchBitmap(key: string, bitmap: ImageBitmap): ImageBitmap {
  bitmaps.delete(key)
  bitmaps.set(key, bitmap)
  return bitmap
}

function rememberBitmap(key: string, bitmap: ImageBitmap): void {
  const previous = bitmaps.get(key)
  if (previous && previous !== bitmap) previous.close()
  bitmaps.delete(key)
  bitmaps.set(key, bitmap)
  while (bitmaps.size > BITMAP_LIMIT) {
    const victim = evictKey()
    if (!victim) break
    bitmaps.get(victim)?.close()
    bitmaps.delete(victim)
  }
}

function evictKey(): string | undefined {
  const keys = [...bitmaps.keys()]
  return (
    keys.find((key) => !pinnedKeys.has(key) && !key.includes(':page:')) ??
    keys.find((key) => !pinnedKeys.has(key))
  )
}

export function pinCachedPage(cacheId: string, cssWidth: number): void {
  const width = quantizeRenderWidth(cssWidth)
  const dpr = window.devicePixelRatio || 1
  const cached = findCachedBitmap(cacheId, width, dpr)
  if (cached) pinnedKeys.add(cached.key)
}

export function unpinCachedPages(): void {
  pinnedKeys.clear()
}

function blitBitmap(canvas: HTMLCanvasElement, bitmap: ImageBitmap, cssWidth: number, cssHeight: number): void {
  const dpr = window.devicePixelRatio || 1
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`
  canvas.width = Math.max(1, Math.round(cssWidth * dpr))
  canvas.height = Math.max(1, Math.round(cssHeight * dpr))
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  canvas.dataset.rendered = '1'
}

function findCachedBitmap(
  cacheId: string,
  cssWidth: number,
  dpr: number
): { key: string; bitmap: ImageBitmap; width: number } | null {
  const exactKey = `${cacheId}:${Math.round(cssWidth)}:${dpr}`
  const exact = bitmaps.get(exactKey)
  if (exact) return { key: exactKey, bitmap: touchBitmap(exactKey, exact), width: Math.round(cssWidth) }

  let best: { key: string; bitmap: ImageBitmap; width: number } | null = null
  const prefix = `${cacheId}:`
  const suffix = `:${dpr}`
  for (const [key, bitmap] of bitmaps) {
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue
    const width = Number(key.slice(prefix.length, key.length - suffix.length))
    if (!Number.isFinite(width)) continue
    if (!best || width > best.width) best = { key, bitmap, width }
  }
  if (!best) return null
  touchBitmap(best.key, best.bitmap)
  return best
}

export function hasCachedPage(cacheId: string, cssWidth: number): boolean {
  const width = quantizeRenderWidth(cssWidth)
  const dpr = window.devicePixelRatio || 1
  const cached = findCachedBitmap(cacheId, width, dpr)
  return Boolean(cached && bitmapMeetsWidth(cached.bitmap.width, width, dpr))
}

export function paintCachedPage(
  canvas: HTMLCanvasElement,
  cacheId: string,
  cssWidth: number,
  cssHeight: number
): boolean {
  const dpr = window.devicePixelRatio || 1
  const cached = findCachedBitmap(cacheId, cssWidth, dpr)
  if (!cached) return false
  blitBitmap(canvas, cached.bitmap, cssWidth, cssHeight)
  return true
}

type RenderTask<T> = {
  priority: number
  seq: number
  cacheId?: string
  signal?: AbortSignal
  work: (signal: AbortSignal) => Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

let renderSeq = 0
const renderQueue: RenderTask<unknown>[] = []
let rendering = false
let running: { priority: number; abort: () => void } | null = null

function enqueueRender<T>(
  priority: number,
  work: (signal: AbortSignal) => Promise<T>,
  extra?: { cacheId?: string; signal?: AbortSignal }
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (extra?.signal?.aborted) {
      reject(new RenderAbortedError())
      return
    }
    if (extra?.cacheId) {
      for (let index = renderQueue.length - 1; index >= 0; index -= 1) {
        const task = renderQueue[index]
        if (task.cacheId === extra.cacheId && task.priority === priority) {
          renderQueue.splice(index, 1)
          task.reject(new RenderAbortedError())
        }
      }
    }
    renderQueue.push({
      priority,
      seq: renderSeq += 1,
      cacheId: extra?.cacheId,
      signal: extra?.signal,
      work,
      resolve: resolve as (value: unknown) => void,
      reject
    })
    renderQueue.sort((a, b) => a.priority - b.priority || a.seq - b.seq)
    if (running && priority < running.priority) running.abort()
    void pumpRender()
  })
}

function takeNextTask(): RenderTask<unknown> | undefined {
  while (renderQueue.length > 0) {
    const next = renderQueue.shift()
    if (!next) return undefined
    if (next.signal?.aborted) {
      next.reject(new RenderAbortedError())
      continue
    }
    return next
  }
  return undefined
}

async function pumpRender(): Promise<void> {
  if (rendering) return
  const next = takeNextTask()
  if (!next) return
  rendering = true
  const inner = new AbortController()
  running = { priority: next.priority, abort: () => inner.abort() }
  const onParentAbort = () => inner.abort()
  next.signal?.addEventListener('abort', onParentAbort)
  try {
    next.resolve(await next.work(inner.signal))
  } catch (error) {
    const parentAborted = Boolean(next.signal?.aborted)
    if (inner.signal.aborted && !parentAborted) {
      renderQueue.push(next)
      renderQueue.sort((a, b) => a.priority - b.priority || a.seq - b.seq)
    } else if (parentAborted || error instanceof RenderAbortedError) {
      next.reject(new RenderAbortedError())
    } else {
      next.reject(error)
    }
  } finally {
    next.signal?.removeEventListener('abort', onParentAbort)
    rendering = false
    running = null
    void pumpRender()
  }
}

export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  options?: { priority?: number; cacheId?: string; signal?: AbortSignal }
): Promise<{ width: number; height: number }> {
  const width = quantizeRenderWidth(cssWidth)
  const dpr = window.devicePixelRatio || 1
  const cacheId = options?.cacheId
  const cacheKey = cacheId ? `${cacheId}:${width}:${dpr}` : null

  const cached = cacheId ? findCachedBitmap(cacheId, width, dpr) : null
  if (cached) {
    const height = width * (cached.bitmap.height / Math.max(cached.bitmap.width, 1))
    blitBitmap(canvas, cached.bitmap, width, height)
    if (bitmapMeetsWidth(cached.bitmap.width, width, dpr)) {
      return { width, height }
    }
  }

  if (options?.signal?.aborted) throw new RenderAbortedError()

  return enqueueRender(
    options?.priority ?? 2,
    async (signal) => {
      if (signal.aborted) throw new RenderAbortedError()
      const again = cacheKey ? bitmaps.get(cacheKey) : undefined
      if (again) {
        const height = width * (again.height / Math.max(again.width, 1))
        if (!signal.aborted) blitBitmap(canvas, touchBitmap(cacheKey!, again), width, height)
        return { width, height }
      }

      const page = await pdf.getPage(pageNumber)
      if (signal.aborted) throw new RenderAbortedError()
      const unscaled = page.getViewport({ scale: 1 })
      const scale = width / unscaled.width
      const viewport = page.getViewport({ scale })
      const ctx = canvas.getContext('2d')
      if (!ctx) return { width: viewport.width, height: viewport.height }
      if (signal.aborted) throw new RenderAbortedError()
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const task = page.render({ canvasContext: ctx, viewport, canvas })
      const cancel = () => task.cancel()
      signal.addEventListener('abort', cancel)
      try {
        await task.promise
      } catch (error) {
        if (signal.aborted) throw new RenderAbortedError()
        throw error
      } finally {
        signal.removeEventListener('abort', cancel)
      }
      if (signal.aborted) throw new RenderAbortedError()
      canvas.dataset.rendered = '1'
      if (cacheKey && typeof createImageBitmap === 'function') {
        rememberBitmap(cacheKey, await createImageBitmap(canvas))
      }
      return { width: viewport.width, height: viewport.height }
    },
    { cacheId, signal: options?.signal }
  )
}

export async function warmPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  cssWidth: number,
  options: { cacheId: string; priority?: number; signal?: AbortSignal }
): Promise<void> {
  const canvas = document.createElement('canvas')
  await renderPdfPage(pdf, pageNumber, canvas, cssWidth, options)
}

export function renderNotePage(
  canvas: HTMLCanvasElement,
  source: PageSource,
  cssWidth: number,
  cssHeight: number
): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(cssWidth * dpr)
  canvas.height = Math.floor(cssHeight * dpr)
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#fffef8'
  ctx.fillRect(0, 0, cssWidth, cssHeight)
  ctx.strokeStyle = '#d8ccb6'
  ctx.lineWidth = 1
  if (source === 'lined') {
    for (let y = 56; y < cssHeight - 24; y += 32) {
      ctx.beginPath()
      ctx.moveTo(36, y)
      ctx.lineTo(cssWidth - 36, y)
      ctx.stroke()
    }
  } else if (source === 'graph') {
    const step = 22
    for (let x = 28; x < cssWidth - 28; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, 28)
      ctx.lineTo(x, cssHeight - 28)
      ctx.stroke()
    }
    for (let y = 28; y < cssHeight - 28; y += step) {
      ctx.beginPath()
      ctx.moveTo(28, y)
      ctx.lineTo(cssWidth - 28, y)
      ctx.stroke()
    }
  } else if (source === 'dot') {
    ctx.fillStyle = '#c8bba4'
    for (let x = 28; x < cssWidth - 28; x += 18) {
      for (let y = 28; y < cssHeight - 28; y += 18) {
        ctx.beginPath()
        ctx.arc(x, y, 1.1, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
