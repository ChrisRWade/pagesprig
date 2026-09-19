import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { ANNOTATIONS_FILE, ORIGINAL_PDF_FILE, PROJECT_VERSION } from '@shared/constants'
import { normalizedToPdf } from '@shared/coords'
import { emptyPageAnnotations } from '@shared/serialize'
import type { DocumentProject, TextAnnotation } from '@shared/types'
import { nowIso } from '@shared/utils'
import { exportAnnotatedPdf } from './pdfExport'

function project(dir: string, sourcePdfPath: string, extra?: Partial<DocumentProject>): DocumentProject {
  const createdAt = nowIso()
  const text: TextAnnotation = {
    id: 'text-1',
    type: 'text',
    page: 1,
    createdAt,
    updatedAt: createdAt,
    style: { color: '#1A1612', width: 16, opacity: 1 },
    x: 0.2,
    y: 0.25,
    width: 0.5,
    height: 0.08,
    text: 'Answer: 42',
    fontSize: 16
  }
  return {
    version: PROJECT_VERSION,
    id: 'doc-export',
    studentId: 's1',
    subjectId: 'math',
    date: '2026-09-16',
    title: 'Export Sample',
    originalFilename: 'export-sample.pdf',
    sourcePdfPath,
    projectDir: dir,
    exportPdfPath: path.join(dir, 'Export Sample.pdf'),
    pages: [{ page: 1, source: 'original', originalPage: 1, width: 612, height: 792 }],
    annotations: emptyPageAnnotations(1).map((page) => ({ ...page, annotations: [text] })),
    status: 'completed',
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt,
    fingerprint: '0',
    ...extra
  }
}

describe('PDF export coordinates', () => {
  it('places normalized text using PDF user space', () => {
    const pdf = normalizedToPdf({ x: 0.2, y: 0.25 }, { width: 612, height: 792 })
    expect(pdf.x).toBeCloseTo(122.4)
    expect(pdf.y).toBeCloseTo(594)
  })
})

describe('PDF export', () => {
  it('writes a portable PDF without modifying the original bytes', async () => {
    const dir = path.join(tmpdir(), `pagesprig-export-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const originalPath = path.join(dir, ORIGINAL_PDF_FILE)
    const source = await PDFDocument.create()
    const page = source.addPage([612, 792])
    const font = await source.embedFont(StandardFonts.Helvetica)
    page.drawText('Original worksheet', { x: 72, y: 720, size: 18, font, color: rgb(0, 0, 0) })
    const originalBytes = await source.save()
    await writeFile(originalPath, originalBytes)
    await writeFile(path.join(dir, ANNOTATIONS_FILE), '{}')

    const exportedPath = await exportAnnotatedPdf(project(dir, originalPath))
    const exported = await readFile(exportedPath)
    const rereadOriginal = await readFile(originalPath)
    expect(Buffer.compare(Buffer.from(originalBytes), rereadOriginal)).toBe(0)
    expect(exported.length).toBeGreaterThan(originalBytes.length)
    const exportedDoc = await PDFDocument.load(exported)
    expect(exportedDoc.getPageCount()).toBe(1)
  })

  it('stamps mixed-background type as a PNG so a letter can split colors', async () => {
    const dir = path.join(tmpdir(), `pagesprig-export-raster-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const originalPath = path.join(dir, ORIGINAL_PDF_FILE)
    const source = await PDFDocument.create()
    source.addPage([612, 792])
    const originalBytes = await source.save()
    await writeFile(originalPath, originalBytes)
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const exportedPath = await exportAnnotatedPdf(project(dir, originalPath), [
      { annotationId: 'text-1', pngBase64 }
    ])
    const exported = await readFile(exportedPath)
    expect(exported.length).toBeGreaterThan(originalBytes.length)
  })

  it('keeps check and x marks on the page instead of drawing them above it', () => {
    const spec = { width: 612, height: 792 }
    const mark = { x: 0.5, y: 0.4, size: 0.04 }
    const topLeft = normalizedToPdf({ x: mark.x, y: mark.y }, spec)
    const bottom = normalizedToPdf({ x: mark.x + mark.size, y: mark.y + mark.size }, spec)
    expect(topLeft.y).toBeLessThan(spec.height)
    expect(bottom.y).toBeGreaterThan(0)
    expect(topLeft.y).toBeGreaterThan(bottom.y)
    expect(topLeft.x).toBeLessThan(bottom.x)
  })

  it('exports check marks and x marks onto the finished PDF', async () => {
    const dir = path.join(tmpdir(), `pagesprig-marks-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const originalPath = path.join(dir, ORIGINAL_PDF_FILE)
    const source = await PDFDocument.create()
    source.addPage([612, 792])
    const originalBytes = await source.save()
    await writeFile(originalPath, originalBytes)
    const createdAt = nowIso()
    const exportedPath = await exportAnnotatedPdf(
      project(dir, originalPath, {
        annotations: emptyPageAnnotations(1).map((page) => ({
          ...page,
          annotations: [
            {
              id: 'check-1',
              type: 'checkmark',
              page: 1,
              createdAt,
              updatedAt: createdAt,
              style: { color: '#1F4E79', width: 2, opacity: 1 },
              x: 0.2,
              y: 0.3,
              size: 0.04
            },
            {
              id: 'x-1',
              type: 'xmark',
              page: 1,
              createdAt,
              updatedAt: createdAt,
              style: { color: '#1F4E79', width: 2, opacity: 1 },
              x: 0.5,
              y: 0.3,
              size: 0.04
            }
          ]
        }))
      })
    )
    const exported = await readFile(exportedPath)
    expect(exported.length).toBeGreaterThan(originalBytes.length)
  })
})
