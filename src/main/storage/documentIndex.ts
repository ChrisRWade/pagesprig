import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { ANNOTATIONS_FILE, INDEX_FILE, LEGACY_INDEX_FILE, RECOVERY_DIR } from '@shared/constants'
import { fingerprintFromFile, toSummary } from '@shared/serialize'
import type { DocumentSummary } from '@shared/types'
import { readTextIfExists } from './atomic'
import { type CatalogEntry, projectDirKey } from './localCatalog'
import { loadProjectFromDisk } from './projectIo'

const WALK_CONCURRENCY = 8
const READ_CONCURRENCY = 6

export function indexPath(storageRoot: string): string {
  return path.join(storageRoot, INDEX_FILE)
}

function legacyIndexPath(storageRoot: string): string {
  return path.join(storageRoot, LEGACY_INDEX_FILE)
}

export async function readIndex(storageRoot: string): Promise<DocumentSummary[]> {
  const raw =
    (await readTextIfExists(indexPath(storageRoot))) ?? (await readTextIfExists(legacyIndexPath(storageRoot)))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { documents?: DocumentSummary[] }
    return Array.isArray(parsed.documents) ? parsed.documents : []
  } catch {
    return []
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function createPool(limit: number): <T>(work: () => Promise<T>) => Promise<T> {
  let active = 0
  const waiting: Array<() => void> = []
  return function run<T>(work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = (): void => {
        active += 1
        work().then(resolve, reject).finally(() => {
          active -= 1
          const next = waiting.shift()
          if (next) next()
        })
      }
      if (active < limit) start()
      else waiting.push(start)
    })
  }
}

async function discoverProjectDirs(storageRoot: string): Promise<string[] | null> {
  const found: string[] = []
  const run = createPool(WALK_CONCURRENCY)
  let rootFailed = false

  const walk = async (dir: string, depth: number, isRoot: boolean): Promise<void> => {
    if (depth > 10) return
    const entries = await run(async () => {
      try {
        return await readdir(dir, { withFileTypes: true })
      } catch {
        if (isRoot) rootFailed = true
        return null
      }
    })
    if (!entries) return
    if (entries.some((entry) => entry.isFile() && entry.name === ANNOTATIONS_FILE)) {
      found.push(dir)
      return
    }
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name !== RECOVERY_DIR)
        .map((entry) => walk(path.join(dir, entry.name), depth + 1, false))
    )
  }

  await walk(storageRoot, 0, true)
  if (rootFailed) return null
  return found
}

async function entryForDir(dir: string, prev: CatalogEntry | undefined): Promise<CatalogEntry | null> {
  const filePath = path.join(dir, ANNOTATIONS_FILE)
  let fingerprint: string
  try {
    const info = await stat(filePath)
    fingerprint = fingerprintFromFile(info.mtimeMs, info.size)
  } catch (error) {
    if (isMissing(error)) return null
    return prev ?? null
  }

  if (prev && prev.fingerprint && prev.fingerprint === fingerprint) {
    const summary = prev.summary.projectDir === dir ? prev.summary : { ...prev.summary, projectDir: dir }
    return { fingerprint, summary }
  }

  try {
    const project = await loadProjectFromDisk(dir, { touchOpened: false, fingerprint })
    return { fingerprint, summary: toSummary(project) }
  } catch {
    return prev ?? null
  }
}

function byNewest(entries: Iterable<CatalogEntry>): CatalogEntry[] {
  const byId = new Map<string, CatalogEntry>()
  for (const entry of entries) {
    const existing = byId.get(entry.summary.id)
    if (!existing || (entry.summary.updatedAt || '') >= (existing.summary.updatedAt || '')) {
      byId.set(entry.summary.id, entry)
    }
  }
  return [...byId.values()].sort((a, b) => (b.summary.updatedAt || '').localeCompare(a.summary.updatedAt || ''))
}

/**
 * Reread worksheet notes only when the file's time and size changed.
 * Returns null when the schoolwork folder itself cannot be listed, so the caller keeps the last catalog.
 * This never writes the shared index or any worksheet file.
 */
export async function refreshDocumentIndex(
  storageRoot: string,
  previous: readonly CatalogEntry[] = []
): Promise<CatalogEntry[] | null> {
  const discovered = await discoverProjectDirs(storageRoot)
  if (!discovered) return null

  const previousByDir = new Map(previous.map((entry) => [projectDirKey(entry.summary.projectDir), entry]))
  const run = createPool(READ_CONCURRENCY)
  const collected: CatalogEntry[] = []

  await Promise.all(
    discovered.map((dir) =>
      run(async () => {
        const entry = await entryForDir(dir, previousByDir.get(projectDirKey(dir)))
        if (entry) collected.push(entry)
      })
    )
  )

  const seen = new Set(collected.map((entry) => projectDirKey(entry.summary.projectDir)))
  await Promise.all(
    previous.map((prev) =>
      run(async () => {
        const key = projectDirKey(prev.summary.projectDir)
        if (seen.has(key)) return
        const entry = await entryForDir(prev.summary.projectDir, prev)
        if (entry) collected.push(entry)
      })
    )
  )

  return byNewest(collected)
}

/**
 * Keep a save that landed while a background refresh was walking the folder.
 * A missing notes file drops that catalog row only. Worksheet files are never deleted here.
 */
export async function reconcileCatalog(
  walked: readonly CatalogEntry[],
  current: readonly CatalogEntry[]
): Promise<CatalogEntry[]> {
  const currentByDir = new Map(current.map((entry) => [projectDirKey(entry.summary.projectDir), entry]))
  const result: CatalogEntry[] = []
  const seen = new Set<string>()

  for (const entry of walked) {
    const key = projectDirKey(entry.summary.projectDir)
    seen.add(key)
    const live = currentByDir.get(key)
    if (live?.fingerprint && live.fingerprint !== entry.fingerprint) {
      const fresh = await entryForDir(entry.summary.projectDir, live.fingerprint ? live : entry)
      result.push(fresh ?? entry)
    } else {
      result.push(entry)
    }
  }

  for (const entry of current) {
    const key = projectDirKey(entry.summary.projectDir)
    if (seen.has(key)) continue
    const stillThere = await entryForDir(entry.summary.projectDir, entry)
    if (stillThere) result.push(stillThere)
  }

  return byNewest(result)
}
