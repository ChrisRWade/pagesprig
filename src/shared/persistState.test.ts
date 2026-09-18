import { describe, expect, it } from 'vitest'
import { mergePersistedProject } from './persistState'
import type { DocumentProject } from './types'

const project = (overrides: Partial<DocumentProject> = {}): DocumentProject => ({
  id: 'doc-1',
  version: 1,
  studentId: 's1',
  subjectId: 'math',
  date: '2026-09-17',
  title: 'Checklist',
  originalFilename: 'list.pdf',
  sourcePdfPath: '/tmp/list.pdf',
  projectDir: '/tmp/doc',
  exportPdfPath: '/tmp/list-finished.pdf',
  pages: [],
  annotations: [],
  status: 'in_progress',
  createdAt: '2026-09-17T12:00:00.000Z',
  updatedAt: '2026-09-17T12:00:00.000Z',
  lastOpenedAt: '2026-09-17T12:00:00.000Z',
  fingerprint: 'old',
  ...overrides
})

describe('mergePersistedProject', () => {
  it('keeps marks added while a save was in flight', () => {
    const local = project({
      fingerprint: 'old',
      updatedAt: '2026-09-17T12:00:02.000Z',
      title: 'two checks'
    })
    const persisted = project({
      fingerprint: 'disk-a',
      updatedAt: '2026-09-17T12:00:01.000Z',
      title: 'one check'
    })

    const result = mergePersistedProject(local, persisted, 2, 1)

    expect(result.caughtUp).toBe(false)
    expect(result.project.title).toBe('two checks')
    expect(result.project.updatedAt).toBe(local.updatedAt)
    expect(result.project.fingerprint).toBe('disk-a')
  })

  it('takes the saved project once local edits are on disk', () => {
    const persisted = project({ fingerprint: 'disk-ab', updatedAt: '2026-09-17T12:00:02.000Z' })
    const result = mergePersistedProject(persisted, persisted, 2, 2)
    expect(result).toEqual({ caughtUp: true, project: persisted })
  })
})
