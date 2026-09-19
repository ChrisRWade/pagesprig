import { DEFAULT_TEXT_SIZE_PT } from '@shared/constants'
import type { TextRaster } from '@shared/ipc'
import type { DocumentProject, PageSpec, TextAnnotation } from '@shared/types'
import {
  canvasPngBase64,
  rasterizeAdaptiveTextInto,
  samplePageRegion,
  waitForTextFont,
  type PageSample
} from './adaptiveText'
import { getLivePageSample } from './pageCanvasRegistry'
import { getLoadedPdf, renderNotePage, renderPdfPage } from './pdfRenderer'

const EXPORT_PX_PER_PT = 2

async function pageSampleForExport(project: DocumentProject, spec: PageSpec): Promise<PageSample | null> {
  const live = getLivePageSample(project.id, spec.page)
  if (live) return live

  const cssWidth = Math.max(320, spec.width * EXPORT_PX_PER_PT)
  const canvas = document.createElement('canvas')
  if (spec.source === 'original') {
    if (!spec.originalPage || !project.sourcePdfPath) return null
    const pdf = getLoadedPdf(project.id)
    if (!pdf) return null
    try {
      const rendered = await renderPdfPage(pdf, spec.originalPage, canvas, cssWidth, {
        priority: 0,
        cacheId: `${project.id}:export:${spec.originalPage}`
      })
      return { canvas, rendered }
    } catch {
      return null
    }
  }
  const cssHeight = cssWidth * (spec.height / spec.width)
  renderNotePage(canvas, spec.source, cssWidth, cssHeight)
  return { canvas, rendered: { width: cssWidth, height: cssHeight } }
}

export async function collectTextRasters(project: DocumentProject): Promise<TextRaster[]> {
  const rasters: TextRaster[] = []
  const textsByPage = new Map<number, TextAnnotation[]>()
  for (const group of project.annotations) {
    const texts = group.annotations.filter(
      (item): item is TextAnnotation => item.type === 'text' && item.text.trim().length > 0
    )
    if (texts.length > 0) textsByPage.set(group.page, texts)
  }
  if (textsByPage.size === 0) return rasters

  const samples = new Map<number, PageSample>()
  for (const spec of project.pages) {
    if (!textsByPage.has(spec.page)) continue
    const sample = await pageSampleForExport(project, spec)
    if (sample) samples.set(spec.page, sample)
  }

  await waitForTextFont(DEFAULT_TEXT_SIZE_PT * EXPORT_PX_PER_PT)

  const canvas = document.createElement('canvas')
  for (const spec of project.pages) {
    const sample = samples.get(spec.page)
    const texts = textsByPage.get(spec.page)
    if (!sample || !texts) continue
    for (const annotation of texts) {
      const pixelW = Math.max(1, Math.round(annotation.width * spec.width * EXPORT_PX_PER_PT))
      const pixelH = Math.max(1, Math.round(annotation.height * spec.height * EXPORT_PX_PER_PT))
      const fontSizePx = (annotation.fontSize || DEFAULT_TEXT_SIZE_PT) * EXPORT_PX_PER_PT
      const background = samplePageRegion(
        sample,
        { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
        pixelW,
        pixelH
      )
      if (!rasterizeAdaptiveTextInto(canvas, annotation.text, fontSizePx, pixelW, pixelH, background)) continue
      const pngBase64 = canvasPngBase64(canvas)
      if (!pngBase64) continue
      rasters.push({ annotationId: annotation.id, pngBase64 })
    }
  }
  return rasters
}
