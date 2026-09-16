import { describe, expect, it } from 'vitest'
import { addAnnotation, parseAnnotation, parseDocumentProject, serializeProject } from './serialize'
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
