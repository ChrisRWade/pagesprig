import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageSource } from '@shared/types'

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const cache = new Map<string, PDFDocumentProxy>()

export async function loadPdfDocument(id: string, data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const existing = cache.get(id)
  if (existing) return existing
  try {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(data), disableRange: true }).promise
    cache.set(id, pdf)
    return pdf
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/password/i.test(message)) {
      throw new Error('This PDF is password protected. Unlock it before adding it to StudyPDF.')
    }
    throw new Error('That worksheet could not be opened. It may be damaged.')
  }
}

export function forgetPdf(id: string): void {
  const pdf = cache.get(id)
  if (pdf) {
    void pdf.destroy()
    cache.delete(id)
  }
}

export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNumber)
  const unscaled = page.getViewport({ scale: 1 })
  const scale = cssWidth / unscaled.width
  const viewport = page.getViewport({ scale })
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width: viewport.width, height: viewport.height }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, viewport.width, viewport.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return { width: viewport.width, height: viewport.height }
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
