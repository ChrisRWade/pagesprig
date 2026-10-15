import { mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_VERSION } from '@shared/constants'
import { toSummary } from '@shared/serialize'
import type { DocumentProject } from '@shared/types'
import { catalogFilePath, readLocalCatalog, writeLocalCatalog } from './localCatalog'

function sample(dir: string): DocumentProject {
  const createdAt = '2026-09-17T12:00:00.000Z'
  return {
    version: PROJECT_VERSION,
    id: 'kept',
    studentId: 'chris',
    subjectId: 'math',
    date: '2026-09-17',
    title: 'Visible',
    originalFilename: 'Visible.pdf',
    sourcePdfPath: path.join(dir, 'original.pdf'),
    projectDir: dir,
    exportPdfPath: path.join(dir, 'Visible.pdf'),
    pages: [{ page: 1, source: 'original', originalPage: 1, width: 612, height: 792 }],
    annotations: [{ page: 1, annotations: [] }],
    dayRanges: [],
    overviewEndPage: 0,
    status: 'in_progress',
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt,
    fingerprint: '1:2'
  }
}

describe('local catalog', () => {
  it('stores the worksheet list on this computer and does not write the schoolwork folder', async () => {
    const userData = path.join(tmpdir(), `pagesprig-userdata-${Date.now()}`)
    const storage = path.join(tmpdir(), `pagesprig-storage-${Date.now()}`)
    await mkdir(storage, { recursive: true })
    const filePath = catalogFilePath(userData, storage)
    const summary = toSummary(sample(path.join(storage, 'kept')))

    await writeLocalCatalog(filePath, storage, [{ fingerprint: '1:2', summary }])

    expect(await readdir(storage)).toEqual([])
    expect(filePath.startsWith(userData)).toBe(true)
    const read = await readLocalCatalog(filePath)
    expect(read).toEqual([{ fingerprint: '1:2', summary }])
  })
})
