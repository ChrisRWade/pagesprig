import path from 'node:path'
import { SUBJECTS_FILE } from '@shared/constants'
import { emptySubjectCatalog, mergeSubjectCatalog, parseSubjectCatalog, type SharedSubjectCatalog } from '@shared/subjectCatalog'
import type { AppSettings } from '@shared/types'
import { atomicWriteFile, readTextIfExists } from './atomic'

export function subjectsCatalogPath(storageRoot: string): string {
  return path.join(storageRoot, SUBJECTS_FILE)
}

export async function readSubjectCatalog(storageRoot: string): Promise<SharedSubjectCatalog> {
  const raw = await readTextIfExists(subjectsCatalogPath(storageRoot))
  if (!raw) return emptySubjectCatalog()
  try {
    return parseSubjectCatalog(JSON.parse(raw))
  } catch {
    return emptySubjectCatalog()
  }
}

/** Write this computer's subjects into the schoolwork folder without removing lists published by other computers. */
export async function publishSubjectCatalog(settings: AppSettings): Promise<void> {
  if (!settings.storageRoot) return
  try {
    const existing = await readSubjectCatalog(settings.storageRoot)
    const next = mergeSubjectCatalog(existing, settings.students)
    if (JSON.stringify(existing) === JSON.stringify(next)) return
    await atomicWriteFile(subjectsCatalogPath(settings.storageRoot), `${JSON.stringify(next, null, 2)}\n`)
  } catch {
    // The shared folder can be offline. Local settings still save.
  }
}
