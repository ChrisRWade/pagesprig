import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { INDEX_FILE, LEGACY_INDEX_FILE, PROJECT_VERSION } from '@shared/constants'
import { fingerprintFromFile, serializeProject, toSummary } from '@shared/serialize'
import type { DocumentProject } from '@shared/types'
import { refreshDocumentIndex } from './documentIndex'

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
    dayRanges: [],
    overviewEndPage: 0,
    status: 'in_progress',
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt,
    fingerprint: '0'
  }
}

describe('document index', () => {
  it('finds worksheets on disk without rewriting the shared catalog', async () => {
    const root = path.join(tmpdir(), `pagesprig-index-${Date.now()}`)
    const kept = path.join(root, 'Chris', 'Math', 'kept')
    const lost = path.join(root, 'Chris', 'Math', 'lost')
    await mkdir(kept, { recursive: true })
    await mkdir(lost, { recursive: true })
    const keptNotes = serializeProject(sample(kept, 'kept', 'Visible'))
    await writeFile(path.join(kept, 'annotations.study.json'), keptNotes)
    await writeFile(path.join(lost, 'annotations.study.json'), serializeProject(sample(lost, 'lost', 'Missing')))
    const legacy = JSON.stringify({ version: 1, documents: [{ id: 'kept', title: 'Visible', projectDir: kept }] })
    await writeFile(path.join(root, LEGACY_INDEX_FILE), legacy)

    const listed = await refreshDocumentIndex(root)
    expect(listed?.map((item) => item.summary.id).sort()).toEqual(['kept', 'lost'])
    expect(listed?.find((item) => item.summary.id === 'lost')?.summary.title).toBe('Missing')
    expect(await readFile(path.join(kept, 'annotations.study.json'), 'utf8')).toBe(keptNotes)
    expect(await readFile(path.join(root, LEGACY_INDEX_FILE), 'utf8')).toBe(legacy)
    await expect(readFile(path.join(root, INDEX_FILE), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reuses a cached summary when the notes file has not changed', async () => {
    const root = path.join(tmpdir(), `pagesprig-index-cache-${Date.now()}`)
    const kept = path.join(root, 'kept')
    await mkdir(kept, { recursive: true })
    const notesPath = path.join(kept, 'annotations.study.json')
    const notes = serializeProject(sample(kept, 'kept', 'Visible'))
    await writeFile(notesPath, notes)
    const info = await stat(notesPath)

    const listed = await refreshDocumentIndex(root, [
      {
        fingerprint: fingerprintFromFile(info.mtimeMs, info.size),
        summary: { ...toSummary(sample(kept, 'kept', 'Visible')), title: 'Cached' }
      }
    ])

    expect(listed?.find((item) => item.summary.id === 'kept')?.summary.title).toBe('Cached')
    expect(await readFile(notesPath, 'utf8')).toBe(notes)
  })

  it('reads again after the notes file changes and drops a deleted worksheet', async () => {
    const root = path.join(tmpdir(), `pagesprig-index-change-${Date.now()}`)
    const kept = path.join(root, 'kept')
    const gone = path.join(root, 'gone')
    await mkdir(kept, { recursive: true })
    await mkdir(gone, { recursive: true })
    await writeFile(path.join(kept, 'annotations.study.json'), serializeProject(sample(kept, 'kept', 'Visible')))
    await writeFile(path.join(gone, 'annotations.study.json'), serializeProject(sample(gone, 'gone', 'Old')))

    const first = await refreshDocumentIndex(root)
    expect(first?.map((item) => item.summary.id).sort()).toEqual(['gone', 'kept'])

    await writeFile(path.join(kept, 'annotations.study.json'), serializeProject(sample(kept, 'kept', 'Updated')))
    await rm(gone, { recursive: true, force: true })
    const second = await refreshDocumentIndex(root, first ?? [])
    expect(second?.map((item) => item.summary.id)).toEqual(['kept'])
    expect(second?.find((item) => item.summary.id === 'kept')?.summary.title).toBe('Updated')
    expect(await readFile(path.join(kept, 'annotations.study.json'), 'utf8')).toContain('Updated')
  })

  it('leaves the previous catalog alone when the folder cannot be listed', async () => {
    const missing = path.join(tmpdir(), `pagesprig-index-missing-${Date.now()}`, 'absent')
    const listed = await refreshDocumentIndex(missing, [])
    expect(listed).toBeNull()
  })
})
