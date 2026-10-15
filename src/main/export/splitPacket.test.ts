import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { PROJECT_VERSION } from '@shared/constants'
import { emptyPageAnnotations } from '@shared/serialize'
import type { DocumentProject, StrokeAnnotation } from '@shared/types'
import { nowIso } from '@shared/utils'
import { canRemoveReplacedProject, materializePacketFiles } from './splitPacket'

describe('packet day files', () => {
  it('keeps the full packet and writes one worksheet per confirmed day', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pagesprig-split-'))
    const sourcePdf = path.join(root, 'incoming.pdf')
    const pdf = await PDFDocument.create()
    for (let index = 0; index < 6; index += 1) pdf.addPage([612, 792])
    await (await import('node:fs/promises')).writeFile(sourcePdf, await pdf.save())

    const createdAt = nowIso()
    const stroke: StrokeAnnotation = {
      id: 'stroke-1',
      type: 'stroke',
      page: 5,
      createdAt,
      updatedAt: createdAt,
      style: { color: '#1A1612', width: 1.6, opacity: 1 },
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.3 }
      ]
    }
    const pages = Array.from({ length: 6 }, (_, index) => ({
      page: index + 1,
      source: 'original' as const,
      originalPage: index + 1,
      width: 612,
      height: 792
    }))
    const project: DocumentProject = {
      version: PROJECT_VERSION,
      id: 'packet-1',
      studentId: 'abel-id',
      subjectId: 'math',
      date: '2026-10-12',
      title: 'Fractions',
      originalFilename: 'fractions.pdf',
      sourcePdfPath: sourcePdf,
      projectDir: path.join(root, 'inbox'),
      exportPdfPath: path.join(root, 'inbox', 'Fractions.pdf'),
      pages,
      annotations: emptyPageAnnotations(6).map((page) =>
        page.page === 5 ? { ...page, annotations: [stroke] } : page
      ),
      dayRanges: [
        { date: '2026-10-12', startPage: 3, endPage: 4 },
        { date: '2026-10-13', startPage: 5, endPage: 6, questionCount: 9, correctCount: 8 }
      ],
      overviewEndPage: 2,
      status: 'in_progress',
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: createdAt,
      fingerprint: '0'
    }

    const result = await materializePacketFiles({
      storageRoot: root,
      studentName: 'Abel',
      project,
      ranges: project.dayRanges,
      overviewEndPage: 2
    })

    const packetPdf = await PDFDocument.load(await readFile(path.join(result.packet.projectDir, 'original.pdf')))
    const overviewPdf = await PDFDocument.load(await readFile(path.join(result.packet.projectDir, 'overview.pdf')))
    expect(packetPdf.getPageCount()).toBe(6)
    expect(overviewPdf.getPageCount()).toBe(2)
    expect(result.packet.role).toBe('packet')
    expect(result.packet.id).toBe('packet-1')
    expect(result.packet.annotations.find((page) => page.page === 5)?.annotations).toEqual([])
    expect(result.days).toHaveLength(2)

    const dayOnePdf = await PDFDocument.load(await readFile(result.days[0].sourcePdfPath))
    const dayTwoPdf = await PDFDocument.load(await readFile(result.days[1].sourcePdfPath))
    expect(dayOnePdf.getPageCount()).toBe(2)
    expect(dayTwoPdf.getPageCount()).toBe(2)
    expect(result.days[1].annotations[0].page).toBe(1)
    expect(result.days[1].annotations[0].annotations[0]).toMatchObject({ type: 'stroke', page: 1 })
    expect(result.days[1].overviewPageCount).toBe(2)
    expect(result.days[1].overviewPdfPath).toBe(path.join(result.packet.projectDir, 'overview.pdf'))
    expect(result.days[1].dayRanges[0]).toMatchObject({ questionCount: 9, correctCount: 8, startPage: 1, endPage: 2 })
    expect(result.removeDir).toBe(project.projectDir)
    expect(canRemoveReplacedProject(result.packet.projectDir, result.packetRoot)).toBe(false)
  })
})
