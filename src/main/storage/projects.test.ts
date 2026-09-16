import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_VERSION } from '@shared/constants'
import { serializeProject } from '@shared/serialize'
import type { DocumentProject } from '@shared/types'
import { loadProjectFromDisk, writeCheckpoint } from './projectIo'

function sample(dir: string): DocumentProject {
  const createdAt = '2026-09-16T12:00:00.000Z'
  return {
    version: PROJECT_VERSION,
    id: 'doc-load',
    studentId: 's1',
    subjectId: 'math',
    date: '2026-09-16',
    title: 'Saved Worksheet',
    originalFilename: 'saved.pdf',
    sourcePdfPath: path.join(dir, 'original.pdf'),
    projectDir: dir,
    exportPdfPath: path.join(dir, 'Saved Worksheet.pdf'),
    pages: [{ page: 1, source: 'original', originalPage: 1, width: 612, height: 792 }],
    annotations: [
      {
        page: 1,
        annotations: [
          {
            id: 'stroke-1',
            type: 'stroke',
            page: 1,
            createdAt,
            updatedAt: createdAt,
            style: { color: '#1A1612', width: 1.6, opacity: 1 },
            points: [
              { x: 0.2, y: 0.3 },
              { x: 0.25, y: 0.35 }
            ]
          }
        ]
      }
    ],
    status: 'in_progress',
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt,
    fingerprint: '0'
  }
}

describe('project loading and checkpoints', () => {
  it('reloads annotations from disk', async () => {
    const dir = path.join(tmpdir(), `studypdf-load-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const project = sample(dir)
    await writeFile(path.join(dir, 'annotations.study.json'), serializeProject(project))
    const loaded = await loadProjectFromDisk(dir)
    expect(loaded.annotations[0].annotations[0].id).toBe('stroke-1')
    expect(loaded.fingerprint).toBeTruthy()
  })

  it('keeps a rolling window of recovery checkpoints', async () => {
    const dir = path.join(tmpdir(), `studypdf-check-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const project = sample(dir)
    for (let i = 0; i < 10; i += 1) {
      await writeCheckpoint({ ...project, title: `n${i}` }, 5)
    }
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(path.join(dir, '.recovery'))
    expect(files.length).toBe(5)
  })
})
