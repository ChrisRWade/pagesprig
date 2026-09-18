import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { ANNOTATIONS_FILE, INDEX_FILE, RECOVERY_DIR } from '@shared/constants'
import { toSummary } from '@shared/serialize'
import type { DocumentProject, DocumentSummary } from '@shared/types'
import { atomicWriteFile, readTextIfExists } from './atomic'
import { loadProjectFromDisk } from './projectIo'

export function indexPath(storageRoot: string): string {
  return path.join(storageRoot, INDEX_FILE)
}

let indexLock: Promise<unknown> = Promise.resolve()

async function withIndexLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = indexLock
  let release!: () => void
  indexLock = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await previous
  } catch {
    // A failed index write must not block the next one.
  }
  try {
    return await work()
  } finally {
    release()
  }
}

export async function readIndex(storageRoot: string): Promise<DocumentSummary[]> {
  const raw = await readTextIfExists(indexPath(storageRoot))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { documents?: DocumentSummary[] }
    return Array.isArray(parsed.documents) ? parsed.documents : []
  } catch {
    return []
  }
}

export async function writeIndex(storageRoot: string, documents: DocumentSummary[]): Promise<void> {
  await atomicWriteFile(indexPath(storageRoot), `${JSON.stringify({ version: 1, documents }, null, 2)}\n`)
}

export async function findProjectDirs(storageRoot: string): Promise<string[]> {
  const found: string[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 10) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    if (entries.some((entry) => entry.isFile() && entry.name === ANNOTATIONS_FILE)) {
      found.push(dir)
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === RECOVERY_DIR) continue
      await walk(path.join(dir, entry.name), depth + 1)
    }
  }
  await walk(storageRoot, 0)
  return found
}

async function summaryFromDir(projectDir: string): Promise<DocumentSummary | null> {
  try {
    const project = await loadProjectFromDisk(projectDir, { touchOpened: false })
    return toSummary(project)
  } catch {
    return null
  }
}

export async function rebuildDocumentIndex(storageRoot: string): Promise<DocumentSummary[]> {
  return withIndexLock(async () => {
    const indexed = await readIndex(storageRoot)
    const discovered = await findProjectDirs(storageRoot)
    const byId = new Map<string, DocumentSummary>()
    const seenDirs = new Set<string>()

    for (const dir of discovered) {
      const summary = await summaryFromDir(dir)
      if (!summary) continue
      byId.set(summary.id, summary)
      seenDirs.add(path.normalize(dir).toLowerCase())
    }

    for (const item of indexed) {
      if (byId.has(item.id)) continue
      const dir = path.normalize(item.projectDir).toLowerCase()
      if (seenDirs.has(dir)) continue
      const summary = await summaryFromDir(item.projectDir)
      if (summary) byId.set(summary.id, summary)
    }

    const documents = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    await writeIndex(storageRoot, documents)
    return documents
  })
}

export async function upsertIndex(storageRoot: string, project: DocumentProject): Promise<void> {
  await withIndexLock(async () => {
    const documents = await readIndex(storageRoot)
    const next = [toSummary(project), ...documents.filter((item) => item.id !== project.id)]
    await writeIndex(storageRoot, next)
  })
}
