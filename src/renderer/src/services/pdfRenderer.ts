import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { pdfProtocolUrl, toPdfBytes } from '@shared/pdfProtocol'
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
    return 'This PDF is password protected. Unlock it before adding it to StudyPDF.'
  }
  if (/worker/i.test(message)) {
    return 'StudyPDF could not start the PDF reader. Restart the app and try again.'
  }
  if (name === 'MissingPDFException' || /missing pdf/i.test(message)) {
    return 'StudyPDF could not find that worksheet in the schoolwork folder.'
  }
  if (
    name === 'UnexpectedResponseException' ||
    /network|fetch|403|404|failed to fetch/i.test(message)
  ) {
    return 'StudyPDF could not read that worksheet from the schoolwork folder.'
  }
  if (name === 'InvalidPDFException' || /invalid pdf/i.test(message)) {
    return 'That file is not a readable PDF worksheet.'
  }
  if (/toHex is not a function/i.test(message)) {
    return 'StudyPDF could not read that worksheet. Restart the app and try again.'
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

export function forgetPdf(id: string): void {
  const pdf = cache.get(id)
  if (pdf) {
    void pdf.destroy()
    cache.delete(id)
  }
  forgetBitmaps(id)
}

const BITMAP_LIMIT = 16
const bitmaps = new Map<string, ImageBitmap>()

function forgetBitmaps(documentId?: string): void {
  for (const [key, bitmap] of bitmaps) {
    if (!documentId || key.startsWith(`${documentId}:`)) {
      bitmap.close()
      bitmaps.delete(key)
    }
  }
}

function rememberBitmap(key: string, bitmap: ImageBitmap): void {
  const previous = bitmaps.get(key)
  if (previous) previous.close()
  bitmaps.set(key, bitmap)
  while (bitmaps.size > BITMAP_LIMIT) {
    const oldest = bitmaps.keys().next().value
    if (!oldest) break
    bitmaps.get(oldest)?.close()
    bitmaps.delete(oldest)
  }
}

type RenderTask<T> = {
  priority: number
  seq: number
  work: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

let renderSeq = 0
const renderQueue: RenderTask<unknown>[] = []
let rendering = false

function enqueueRender<T>(priority: number, work: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    renderQueue.push({
      priority,
      seq: renderSeq += 1,
      work,
      resolve: resolve as (value: unknown) => void,
      reject
    })
    renderQueue.sort((a, b) => a.priority - b.priority || a.seq - b.seq)
    void pumpRender()
  })
}

async function pumpRender(): Promise<void> {
  if (rendering) return
  const next = renderQueue.shift()
  if (!next) return
  rendering = true
  try {
    next.resolve(await next.work())
  } catch (error) {
    next.reject(error)
  } finally {
    rendering = false
    void pumpRender()
  }
}

export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  options?: { priority?: number; cacheId?: string }
): Promise<{ width: number; height: number }> {
  const priority = options?.priority ?? 2
  return enqueueRender(priority, async () => {
    const dpr = window.devicePixelRatio || 1
    const cacheKey = options?.cacheId ? `${options.cacheId}:${Math.round(cssWidth)}:${dpr}` : null
    const cached = cacheKey ? bitmaps.get(cacheKey) : undefined
    if (cached) {
      canvas.style.width = `${cached.width / dpr}px`
      canvas.style.height = `${cached.height / dpr}px`
      canvas.width = cached.width
      canvas.height = cached.height
      const cachedCtx = canvas.getContext('2d')
      if (cachedCtx) {
        cachedCtx.setTransform(1, 0, 0, 1, 0, 0)
        cachedCtx.clearRect(0, 0, canvas.width, canvas.height)
        cachedCtx.drawImage(cached, 0, 0)
      }
      canvas.dataset.rendered = '1'
      return { width: cached.width / dpr, height: cached.height / dpr }
    }

    const page = await pdf.getPage(pageNumber)
    const unscaled = page.getViewport({ scale: 1 })
    const scale = cssWidth / unscaled.width
    const viewport = page.getViewport({ scale })
    const nextWidth = Math.floor(viewport.width * dpr)
    const nextHeight = Math.floor(viewport.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { width: viewport.width, height: viewport.height }
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    canvas.width = nextWidth
    canvas.height = nextHeight
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    canvas.dataset.rendered = '1'
    if (cacheKey && typeof createImageBitmap === 'function') {
      rememberBitmap(cacheKey, await createImageBitmap(canvas))
    }
    return { width: viewport.width, height: viewport.height }
  })
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
