import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { INDEX_FILE, LEGACY_INDEX_FILE, PROJECT_VERSION } from '@shared/constants'
import { serializeProject } from '@shared/serialize'
import type { DocumentProject } from '@shared/types'
import { rebuildDocumentIndex } from './documentIndex'

function sample(dir: string, id: string, title: string): DocumentProject {
  const createdAt = '2026-09-17T12:00:00.000Z'
  return {
    version: PROJECT_VERSION,
    id,
    studentId: 'chris',
    subjectId: 'math',
    date: '2026-09-17',
    title,
    originalFilename: `${title}.pdf`,
    sourcePdfPath: path.join(dir, 'original.pdf'),
    projectDir: dir,
    exportPdfPath: path.join(dir, `${title}.pdf`),
    pages: [{ page: 1, source: 'original', originalPage: 1, width: 612, height: 792 }],
    annotations: [{ page: 1, annotations: [] }],
    status: 'in_progress',
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt,
    fingerprint: '0'
  }
}

describe('document index', () => {
  it('finds worksheets on disk even if the catalog file lost them', async () => {
    const root = path.join(tmpdir(), `pagesprig-index-${Date.now()}`)
    const kept = path.join(root, 'Chris', 'Math', 'kept')
    const lost = path.join(root, 'Chris', 'Math', 'lost')
    await mkdir(kept, { recursive: true })
    await mkdir(lost, { recursive: true })
    await writeFile(path.join(kept, 'annotations.study.json'), serializeProject(sample(kept, 'kept', 'Visible')))
    await writeFile(path.join(lost, 'annotations.study.json'), serializeProject(sample(lost, 'lost', 'Missing')))
    await writeFile(
      path.join(root, LEGACY_INDEX_FILE),
      JSON.stringify({ version: 1, documents: [{ id: 'kept', title: 'Visible', projectDir: kept }] })
    )

    const listed = await rebuildDocumentIndex(root)
    expect(listed.map((item) => item.id).sort()).toEqual(['kept', 'lost'])
    expect(listed.find((item) => item.id === 'lost')?.title).toBe('Missing')
    const catalog = JSON.parse(await readFile(path.join(root, INDEX_FILE), 'utf8')) as {
      documents: { id: string }[]
    }
    expect(catalog.documents.map((item) => item.id).sort()).toEqual(['kept', 'lost'])
    await expect(readFile(path.join(root, LEGACY_INDEX_FILE))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
