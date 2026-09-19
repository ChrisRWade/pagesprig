import { describe, expect, it } from 'vitest'
import { PROJECT_VERSION } from './constants'
import { removeNotePageFromProject } from './notePages'
import type { DocumentProject, StrokeAnnotation } from './types'

function stroke(page: number, id: string): StrokeAnnotation {
  return {
    id,
    type: 'stroke',
    page,
    createdAt: '2026-09-18T12:00:00.000Z',
    updatedAt: '2026-09-18T12:00:00.000Z',
    style: { color: '#1A1612', width: 1.6, opacity: 1 },
    points: [
      { x: 0.2, y: 0.2 },
      { x: 0.3, y: 0.3 }
    ]
  }
}

function project(): DocumentProject {
  const createdAt = '2026-09-18T12:00:00.000Z'
  return {
    version: PROJECT_VERSION,
    id: 'doc-notes',
    studentId: 's1',
    subjectId: 'math',
    date: '2026-09-18',
    title: 'Notes',
    originalFilename: 'notes.pdf',
    sourcePdfPath: '/tmp/original.pdf',
    projectDir: '/tmp/notes',
    exportPdfPath: '/tmp/Notes.pdf',
    pages: [
      { page: 1, source: 'original', originalPage: 1, width: 612, height: 792 },
      { page: 2, source: 'lined', width: 612, height: 792 },
      { page: 3, source: 'graph', width: 612, height: 792 }
    ],
    annotations: [
      { page: 1, annotations: [stroke(1, 'on-original')] },
      { page: 2, annotations: [stroke(2, 'on-lined')] },
      { page: 3, annotations: [stroke(3, 'on-graph')] }
    ],
    status: 'in_progress',
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt,
    fingerprint: '0'
  }
}

describe('notes pages', () => {
  it('drops a notes page and renumbers later pages and marks', () => {
    const next = removeNotePageFromProject(project(), 2)
    expect(next.pages.map((item) => [item.page, item.source])).toEqual([
      [1, 'original'],
      [2, 'graph']
    ])
    expect(next.pages[0].originalPage).toBe(1)
    expect(next.annotations.map((group) => group.page)).toEqual([1, 2])
    expect(next.annotations[0].annotations[0].id).toBe('on-original')
    expect(next.annotations[1].annotations[0].id).toBe('on-graph')
    expect(next.annotations[1].annotations[0].page).toBe(2)
  })

  it('keeps the original worksheet', () => {
    expect(() => removeNotePageFromProject(project(), 1)).toThrow(/original worksheet/)
  })
})
