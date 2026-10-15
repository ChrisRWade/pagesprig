import { copyFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { PROJECT_VERSION } from '@shared/constants'
import { sanitizePathSegment, uniqueName } from '@shared/pathTemplate'
import { annotationsForPage } from '@shared/serialize'
import type { Annotation, DocumentProject, PacketDay, PageAnnotations, PageSpec } from '@shared/types'
import { createId, nowIso } from '@shared/utils'
import { atomicWriteFile, ensureDir } from '../storage/atomic'

export interface MaterializedPacket {
  packet: DocumentProject
  days: DocumentProject[]
  packetRoot: string
  /** Previous project folder, when it does not contain the new files. */
  removeDir: string | null
}

export function canRemoveReplacedProject(oldDir: string, packetRoot: string): boolean {
  const old = path.resolve(oldDir)
  const root = path.resolve(packetRoot)
  if (old === root) return false
  if (root.startsWith(`${old}${path.sep}`) || old.startsWith(`${root}${path.sep}`)) return false
  return true
}

export async function materializePacketFiles(input: {
  storageRoot: string
  studentName: string
  project: DocumentProject
  ranges: PacketDay[]
  overviewEndPage: number
}): Promise<MaterializedPacket> {
  const { project, ranges } = input
  const overviewEnd = Math.max(0, input.overviewEndPage)
  const firstDate = ranges[0]?.date ?? project.date
  const [year, month] = firstDate.split('-')
  const studentDir = path.join(input.storageRoot, sanitizePathSegment(input.studentName, 'Student'), year, month)
  await ensureDir(studentDir)
  const taken = new Set((await readdir(studentDir).catch(() => [] as string[])).map((name) => name.toLowerCase()))
  const packetRoot = path.join(studentDir, uniqueName(taken, sanitizePathSegment(project.title, 'Packet')))
  const packetDir = path.join(packetRoot, 'packet')
  await ensureDir(packetDir)
  const fullPdf = path.join(packetDir, 'original.pdf')
  await copyFile(project.sourcePdfPath || path.join(project.projectDir, 'original.pdf'), fullPdf)

  const sourceBytes = await (await import('node:fs/promises')).readFile(fullPdf)
  const source = await PDFDocument.load(sourceBytes)
  const overviewPdf = path.join(packetDir, 'overview.pdf')

  if (overviewEnd > 0) {
    const overviewSpecs = project.pages.filter((item) => item.page >= 1 && item.page <= overviewEnd)
    await writeSlice(source, overviewSpecs, overviewPdf)
  }

  const stamp = nowIso()
  const packet: DocumentProject = {
    ...project,
    version: PROJECT_VERSION,
    projectDir: packetDir,
    sourcePdfPath: fullPdf,
    exportPdfPath: path.join(packetDir, `${sanitizePathSegment(project.title, 'Packet')}.pdf`),
    pages: project.pages,
    annotations: project.pages.map((page) => ({
      page: page.page,
      annotations: page.page <= overviewEnd ? retarget(annotationsForPage(project, page.page), page.page) : []
    })),
    dayRanges: [{ date: firstDate, startPage: 1, endPage: Math.max(1, project.pages.length) }],
    overviewEndPage: overviewEnd,
    role: 'packet',
    packetId: project.id,
    overviewPdfPath: null,
    overviewPageCount: 0,
    updatedAt: stamp,
    fingerprint: '0'
  }

  const days: DocumentProject[] = []
  for (const range of ranges) {
    const specs = project.pages.filter((item) => item.page >= range.startPage && item.page <= range.endPage)
    const dayDir = path.join(packetRoot, range.date)
    await ensureDir(dayDir)
    const dayPdf = path.join(dayDir, 'original.pdf')
    const pages = await writeSlice(source, specs, dayPdf)
    const annotations = specs.map((spec, index) => ({
      page: index + 1,
      annotations: retarget(annotationsForPage(project, spec.page), index + 1)
    }))
    days.push({
      version: PROJECT_VERSION,
      id: createId(),
      studentId: project.studentId,
      subjectId: project.subjectId,
      date: range.date,
      title: project.title,
      originalFilename: project.originalFilename,
      sourcePdfPath: dayPdf,
      projectDir: dayDir,
      exportPdfPath: path.join(dayDir, `${range.date} - ${sanitizePathSegment(project.title, 'Packet')}.pdf`),
      pages,
      annotations,
      dayRanges: [
        {
          date: range.date,
          startPage: 1,
          endPage: Math.max(1, pages.length),
          ...(range.reviewedAt ? { reviewedAt: range.reviewedAt } : {}),
          ...(range.questionCount != null ? { questionCount: range.questionCount } : {}),
          ...(range.correctCount != null ? { correctCount: range.correctCount } : {})
        }
      ],
      overviewEndPage: 0,
      role: 'day',
      overviewPdfPath: overviewEnd > 0 ? overviewPdf : null,
      overviewPageCount: overviewEnd,
      packetId: project.id,
      status: annotations.some((page) => page.annotations.length > 0) ? 'in_progress' : 'not_started',
      createdAt: project.createdAt,
      updatedAt: stamp,
      lastOpenedAt: stamp,
      lastExportedAt: null,
      fingerprint: '0'
    })
  }

  return {
    packet,
    days,
    packetRoot,
    removeDir: canRemoveReplacedProject(project.projectDir, packetRoot) ? project.projectDir : null
  }
}

async function writeSlice(source: PDFDocument, specs: PageSpec[], dest: string): Promise<PageSpec[]> {
  const out = await PDFDocument.create()
  const pages: PageSpec[] = []
  for (const spec of specs) {
    const pageNumber = pages.length + 1
    if (spec.source === 'original' && spec.originalPage && spec.originalPage <= source.getPageCount()) {
      const [copied] = await out.copyPages(source, [spec.originalPage - 1])
      out.addPage(copied)
      const size = copied.getSize()
      pages.push({
        page: pageNumber,
        source: 'original',
        originalPage: pageNumber,
        width: size.width,
        height: size.height
      })
      continue
    }
    out.addPage([spec.width || 612, spec.height || 792])
    pages.push({
      page: pageNumber,
      source: spec.source === 'original' ? 'blank' : spec.source,
      width: spec.width || 612,
      height: spec.height || 792
    })
  }
  if (pages.length === 0) out.addPage([612, 792])
  await atomicWriteFile(dest, await out.save())
  return pages.length > 0
    ? pages
    : [{ page: 1, source: 'blank', width: 612, height: 792 }]
}

function retarget(annotations: Annotation[], page: number): Annotation[] {
  return annotations.map((item) => ({ ...item, page }))
}

export function sliceAnnotations(project: DocumentProject, start: number, end: number): PageAnnotations[] {
  return project.pages
    .filter((item) => item.page >= start && item.page <= end)
    .map((spec, index) => ({
      page: index + 1,
      annotations: retarget(annotationsForPage(project, spec.page), index + 1)
    }))
}
