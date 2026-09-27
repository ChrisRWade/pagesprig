import { describe, expect, it } from 'vitest'
import { addAnnotation, mergeDocumentCatalog, parseAnnotation, parseDocumentProject, serializeProject } from './serialize'
import type { DocumentProject, StrokeAnnotation, TextAnnotation } from './types'

function sampleProject(): DocumentProject {
  return {
    version: 1,
    id: 'doc-1',
    studentId: 'student-1',
    subjectId: 'math',
    date: '2026-09-16',
    title: 'Fractions Practice',
    originalFilename: 'Fractions Practice.pdf',
    sourcePdfPath: 'C:/school/original.pdf',
    projectDir: 'C:/school/project',
    exportPdfPath: 'C:/school/project/Fractions Practice.pdf',
    pages: [{ page: 1, source: 'original', originalPage: 1, width: 612, height: 792 }],
    annotations: [{ page: 1, annotations: [] }],
    dayRanges: [],
    overviewEndPage: 0,
    status: 'not_started',
    createdAt: '2026-09-16T12:00:00.000Z',
    updatedAt: '2026-09-16T12:00:00.000Z',
    lastOpenedAt: '2026-09-16T12:00:00.000Z',
    fingerprint: '1:1'
  }
}

describe('annotation serialization', () => {
  it('round-trips a freehand stroke', () => {
    const stroke: StrokeAnnotation = {
      id: 'a1',
      type: 'stroke',
      page: 1,
      createdAt: '2026-09-16T12:00:00.000Z',
      updatedAt: '2026-09-16T12:00:00.000Z',
      style: { color: '#1A1612', width: 1.6, opacity: 1 },
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.12, y: 0.22, p: 0.8 }
      ]
    }
    const parsed = parseAnnotation(JSON.parse(JSON.stringify(stroke)))
    expect(parsed).toEqual(stroke)
  })

  it('round-trips a full project including text', () => {
    const text: TextAnnotation = {
      id: 't1',
      type: 'text',
      page: 1,
      createdAt: '2026-09-16T12:00:00.000Z',
      updatedAt: '2026-09-16T12:00:00.000Z',
      style: { color: '#1A1612', width: 16, opacity: 1 },
      x: 0.2,
      y: 0.3,
      width: 0.4,
      height: 0.08,
      text: '12/4 = 3',
      fontSize: 16
    }
    const project = addAnnotation(sampleProject(), text)
    const parsed = parseDocumentProject(JSON.parse(serializeProject(project)))
    expect(parsed?.annotations[0].annotations[0]).toEqual(text)
    expect(parsed?.lastExportedAt).toBeNull()
  })

  it('keeps a finished-PDF timestamp when one exists', () => {
    const project = {
      ...sampleProject(),
      lastExportedAt: '2026-09-16T13:00:00.000Z'
    }
    const parsed = parseDocumentProject(JSON.parse(serializeProject(project)))
    expect(parsed?.lastExportedAt).toBe('2026-09-16T13:00:00.000Z')
  })

  it('fills missing day ranges from the first school day', () => {
    const parsed = parseDocumentProject({ ...sampleProject(), dayRanges: undefined, overviewEndPage: undefined })
    expect(parsed?.dayRanges).toEqual([{ date: '2026-09-16', startPage: 1, endPage: 1 }])
    expect(parsed?.overviewEndPage).toBe(0)
  })

  it('keeps a lesson overview ahead of the first school day', () => {
    const parsed = parseDocumentProject({
      ...sampleProject(),
      pages: [
        { page: 1, source: 'original', originalPage: 1, width: 612, height: 792 },
        { page: 2, source: 'original', originalPage: 2, width: 612, height: 792 },
        { page: 3, source: 'original', originalPage: 3, width: 612, height: 792 }
      ],
      overviewEndPage: 1,
      dayRanges: [{ date: '2026-09-16', startPage: 2, endPage: 3 }]
    })
    expect(parsed?.overviewEndPage).toBe(1)
    expect(parsed?.dayRanges).toEqual([{ date: '2026-09-16', startPage: 2, endPage: 3 }])
  })

  it('keeps parent review notes on a school day', () => {
    const parsed = parseDocumentProject({
      ...sampleProject(),
      dayRanges: [
        {
          date: '2026-09-16',
          startPage: 1,
          endPage: 1,
          reviewedAt: '2026-09-16T20:00:00.000Z',
          questionCount: 9,
          correctCount: 8
        }
      ]
    })
    expect(parsed?.dayRanges).toEqual([
      {
        date: '2026-09-16',
        startPage: 1,
        endPage: 1,
        reviewedAt: '2026-09-16T20:00:00.000Z',
        questionCount: 9,
        correctCount: 8
      }
    ])
  })

  it('rejects an unknown future project version', () => {
    const parsed = parseDocumentProject({ ...sampleProject(), version: 99 })
    expect(parsed).toBeNull()
  })

  it('drops malformed annotations instead of failing the whole page', () => {
    const parsed = parseDocumentProject({
      ...sampleProject(),
      annotations: [{ page: 1, annotations: [{ id: 'bad' }, { not: 'an annotation' }] }]
    })
    expect(parsed?.annotations[0].annotations).toEqual([])
  })
})

describe('document catalog', () => {
  it('keeps open worksheets even if they disappeared from the list', () => {
    const listed = [
      {
        id: 'visible',
        studentId: 'chris',
        subjectId: 'math',
        date: '2026-09-17',
        title: 'Shown',
        status: 'in_progress' as const,
        projectDir: '/shown',
        exportPdfPath: '/shown.pdf',
        sourcePdfPath: '/original.pdf',
        originalFilename: 'shown.pdf',
        updatedAt: '2026-09-17T12:00:00.000Z',
        lastOpenedAt: '2026-09-17T12:00:00.000Z',
        pageCount: 1,
        dayRanges: [],
        overviewEndPage: 0
      }
    ]
    const hidden = sampleProject()
    hidden.id = 'hidden'
    hidden.title = 'Still open'
    const merged = mergeDocumentCatalog(listed, [hidden])
    expect(merged.map((item) => item.id).sort()).toEqual(['hidden', 'visible'])
  })
})
