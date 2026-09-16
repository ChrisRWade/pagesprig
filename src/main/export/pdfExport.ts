import { copyFile, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, PDFPage, rgb, StandardFonts, type RGB } from 'pdf-lib'
import { ERROR_CODES, ORIGINAL_PDF_FILE } from '@shared/constants'
import { normalizedToPdf, normalizedBoxToPdf } from '@shared/coords'
import type { Annotation, DocumentProject, PageSpec, Point } from '@shared/types'
import { AppError } from '../storage/errors'
import { atomicWriteFile } from '../storage/atomic'

function parseHex(color: string): RGB {
  const value = color.replace('#', '')
  const normalized = value.length === 3 ? value.split('').map((c) => `${c}${c}`).join('') : value
  const int = Number.parseInt(normalized, 16)
  if (!Number.isFinite(int)) return rgb(0.1, 0.09, 0.07)
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255)
}

function toPdf(point: Point, page: PageSpec): Point {
  return normalizedToPdf(point, { width: page.width, height: page.height })
}

function winAnsi(text: string): string {
  return [...text]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) return ch
      return '?'
    })
    .join('')
}

function drawNoteBackground(pdfPage: PDFPage, spec: PageSpec): void {
  const { width, height } = spec
  pdfPage.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 0.996, 0.973) })
  const lineColor = rgb(0.82, 0.78, 0.7)
  if (spec.source === 'lined') {
    const top = height - 72
    for (let y = 72; y < top; y += 28) {
      pdfPage.drawLine({
        start: { x: 54, y },
        end: { x: width - 54, y },
        thickness: 0.6,
        color: lineColor
      })
    }
  } else if (spec.source === 'graph') {
    const step = 18
    for (let x = 36; x < width - 36; x += step) {
      pdfPage.drawLine({
        start: { x, y: 36 },
        end: { x, y: height - 36 },
        thickness: 0.4,
        color: lineColor
      })
    }
    for (let y = 36; y < height - 36; y += step) {
      pdfPage.drawLine({
        start: { x: 36, y },
        end: { x: width - 36, y },
        thickness: 0.4,
        color: lineColor
      })
    }
  } else if (spec.source === 'dot') {
    for (let x = 40; x < width - 40; x += 16) {
      for (let y = 40; y < height - 40; y += 16) {
        pdfPage.drawCircle({ x, y, size: 0.7, color: lineColor })
      }
    }
  }
}

function svgPath(points: Point[], spec: PageSpec): string {
  return points
    .map((point, index) => {
      const pdf = toPdf(point, spec)
      return `${index === 0 ? 'M' : 'L'} ${pdf.x.toFixed(2)} ${pdf.y.toFixed(2)}`
    })
    .join(' ')
}

async function drawAnnotation(
  pdfPage: PDFPage,
  spec: PageSpec,
  annotation: Annotation,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
): Promise<void> {
  const color = parseHex(annotation.style.color)
  const opacity = annotation.style.opacity
  const borderWidth = annotation.style.width

  switch (annotation.type) {
    case 'stroke':
    case 'highlight': {
      if (annotation.points.length < 2) return
      pdfPage.drawSvgPath(svgPath(annotation.points, spec), {
        borderColor: color,
        borderOpacity: opacity,
        borderWidth,
        borderLineCap: 1
      })
      return
    }
    case 'line': {
      const start = toPdf({ x: annotation.x1, y: annotation.y1 }, spec)
      const end = toPdf({ x: annotation.x2, y: annotation.y2 }, spec)
      pdfPage.drawLine({
        start,
        end,
        thickness: borderWidth,
        color,
        opacity
      })
      return
    }
    case 'arrow': {
      const start = toPdf({ x: annotation.x1, y: annotation.y1 }, spec)
      const end = toPdf({ x: annotation.x2, y: annotation.y2 }, spec)
      pdfPage.drawLine({ start, end, thickness: borderWidth, color, opacity })
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      const head = 12
      const left = {
        x: end.x - head * Math.cos(angle - Math.PI / 6),
        y: end.y - head * Math.sin(angle - Math.PI / 6)
      }
      const right = {
        x: end.x - head * Math.cos(angle + Math.PI / 6),
        y: end.y - head * Math.sin(angle + Math.PI / 6)
      }
      pdfPage.drawLine({ start: end, end: left, thickness: borderWidth, color, opacity })
      pdfPage.drawLine({ start: end, end: right, thickness: borderWidth, color, opacity })
      return
    }
    case 'rect': {
      const box = normalizedBoxToPdf(annotation, { width: spec.width, height: spec.height })
      pdfPage.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        borderColor: color,
        borderWidth,
        borderOpacity: opacity
      })
      return
    }
    case 'ellipse': {
      const box = normalizedBoxToPdf(annotation, { width: spec.width, height: spec.height })
      pdfPage.drawEllipse({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        xScale: Math.abs(box.width / 2),
        yScale: Math.abs(box.height / 2),
        borderColor: color,
        borderWidth,
        borderOpacity: opacity
      })
      return
    }
    case 'checkmark': {
      const origin = toPdf({ x: annotation.x, y: annotation.y }, spec)
      const size = annotation.size * spec.width
      pdfPage.drawSvgPath(
        `M ${origin.x} ${origin.y + size * 0.45} L ${origin.x + size * 0.28} ${origin.y} L ${origin.x + size} ${origin.y + size}`,
        {
          borderColor: color,
          borderWidth: Math.max(borderWidth, 1.8),
          borderOpacity: opacity,
          borderLineCap: 1
        }
      )
      return
    }
    case 'xmark': {
      const origin = toPdf({ x: annotation.x, y: annotation.y }, spec)
      const size = annotation.size * spec.width
      pdfPage.drawLine({
        start: origin,
        end: { x: origin.x + size, y: origin.y + size },
        thickness: borderWidth,
        color,
        opacity
      })
      pdfPage.drawLine({
        start: { x: origin.x, y: origin.y + size },
        end: { x: origin.x + size, y: origin.y },
        thickness: borderWidth,
        color,
        opacity
      })
      return
    }
    case 'text': {
      const topLeft = toPdf({ x: annotation.x, y: annotation.y }, spec)
      const lines = annotation.text.split(/\r?\n/)
      const lineHeight = annotation.fontSize * 1.25
      lines.forEach((line, index) => {
        pdfPage.drawText(winAnsi(line), {
          x: topLeft.x,
          y: topLeft.y - annotation.fontSize * 0.9 - index * lineHeight,
          size: annotation.fontSize,
          font,
          color,
          opacity,
          maxWidth: annotation.width * spec.width
        })
      })
    }
  }
}

export async function exportAnnotatedPdf(project: DocumentProject): Promise<string> {
  const originalPath = project.sourcePdfPath || path.join(project.projectDir, ORIGINAL_PDF_FILE)
  let sourceBytes: Buffer
  try {
    sourceBytes = await readFile(originalPath)
  } catch {
    throw new AppError(
      'The original worksheet is missing, so a finished PDF cannot be created.',
      ERROR_CODES.MISSING_SOURCE
    )
  }

  let sourceDoc: PDFDocument
  try {
    sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false })
  } catch {
    throw new AppError('The original worksheet could not be read.', ERROR_CODES.CORRUPT_PDF)
  }

  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)

  for (const spec of project.pages) {
    let pdfPage: PDFPage
    if (spec.source === 'original' && spec.originalPage) {
      const [copied] = await out.copyPages(sourceDoc, [spec.originalPage - 1])
      pdfPage = out.addPage(copied)
    } else {
      pdfPage = out.addPage([spec.width, spec.height])
      drawNoteBackground(pdfPage, spec)
    }
    const pageAnnotations = project.annotations.find((item) => item.page === spec.page)?.annotations ?? []
    for (const annotation of pageAnnotations) {
      await drawAnnotation(pdfPage, spec, annotation, font)
    }
  }

  const bytes = await out.save()
  await atomicWriteFile(project.exportPdfPath, bytes)
  return project.exportPdfPath
}

export async function inspectPdf(filePath: string): Promise<{ pageCount: number; pages: { width: number; height: number }[] }> {
  let bytes: Buffer
  try {
    bytes = await readFile(filePath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw new AppError('That PDF could not be found.', ERROR_CODES.MISSING_SOURCE)
    }
    throw error
  }

  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
    if (pdf.isEncrypted) {
      throw new AppError(
        'This PDF is password protected. Unlock it before adding it to StudyPDF.',
        ERROR_CODES.PASSWORD_PROTECTED
      )
    }
    const pages = pdf.getPages().map((page) => page.getSize())
    return { pageCount: pages.length, pages }
  } catch (error) {
    if (error instanceof AppError) throw error
    const message = error instanceof Error ? error.message : ''
    if (/password|encrypt/i.test(message)) {
      throw new AppError(
        'This PDF is password protected. Unlock it before adding it to StudyPDF.',
        ERROR_CODES.PASSWORD_PROTECTED
      )
    }
    throw new AppError('That file is not a readable PDF worksheet.', ERROR_CODES.INVALID_PDF)
  }
}

export async function copyOriginalPdf(sourcePath: string, projectDir: string): Promise<string> {
  const destination = path.join(projectDir, ORIGINAL_PDF_FILE)
  await copyFile(sourcePath, destination)
  return destination
}

export async function fileFingerprint(filePath: string): Promise<string> {
  const info = await stat(filePath)
  return `${info.mtimeMs}:${info.size}`
}
