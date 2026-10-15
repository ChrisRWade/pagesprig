import { createHash } from 'node:crypto'
import path from 'node:path'
import type { DocumentSummary } from '@shared/types'
import { atomicWriteFile, readTextIfExists } from './atomic'

export interface CatalogEntry {
  fingerprint: string
  summary: DocumentSummary
}

interface CatalogFile {
  version: 1
  storageRoot: string
  entries: CatalogEntry[]
}

let catalogLock: Promise<unknown> = Promise.resolve()

export function projectDirKey(projectDir: string): string {
  const normalized = path.normalize(projectDir)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

export function catalogFilePath(userData: string, storageRoot: string): string {
  const resolved = path.resolve(storageRoot)
  const stable = process.platform === 'win32' ? resolved.toLowerCase() : resolved
  const key = createHash('sha1').update(stable).digest('hex')
  return path.join(userData, 'catalogs', `${key}.json`)
}

export async function withCatalogLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = catalogLock
  let release!: () => void
  catalogLock = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await previous
  } catch {
    // A failed catalog write must not block the next one.
  }
  try {
    return await work()
  } finally {
    release()
  }
}

function usableEntry(entry: CatalogEntry | undefined): entry is CatalogEntry {
  return Boolean(
    entry &&
      typeof entry.fingerprint === 'string' &&
      entry.summary &&
      typeof entry.summary.id === 'string' &&
      entry.summary.id &&
      typeof entry.summary.projectDir === 'string' &&
      entry.summary.projectDir
  )
}

export async function readLocalCatalog(filePath: string): Promise<CatalogEntry[] | null> {
  const raw = await readTextIfExists(filePath)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CatalogFile>
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return null
    return parsed.entries.filter(usableEntry)
  } catch {
    return null
  }
}

export async function writeLocalCatalog(
  filePath: string,
  storageRoot: string,
  entries: readonly CatalogEntry[]
): Promise<void> {
  const body: CatalogFile = { version: 1, storageRoot, entries: [...entries] }
  await atomicWriteFile(filePath, `${JSON.stringify(body)}\n`)
}
