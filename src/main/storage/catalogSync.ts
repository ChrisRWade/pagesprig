import { app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import { toSummary } from '@shared/serialize'
import type { AppSettings, DocumentProject, DocumentSummary } from '@shared/types'
import { readIndex, reconcileCatalog, refreshDocumentIndex } from './documentIndex'
import { catalogFilePath, projectDirKey, readLocalCatalog, withCatalogLock, writeLocalCatalog, type CatalogEntry } from './localCatalog'
import { loadSettings } from './settingsStore'

const MIN_GAP_MS = 60_000

type Decorate = (settings: AppSettings, documents: DocumentSummary[]) => Promise<DocumentSummary[]>

let decorateDocuments: Decorate = async (_settings, documents) => documents
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let refreshRunning = false
let lastFinished = 0
let latestPublish = 0

export function setCatalogDecorator(decorate: Decorate): void {
  decorateDocuments = decorate
}

function catalogFile(storageRoot: string): string {
  return catalogFilePath(app.getPath('userData'), storageRoot)
}

function usableSummary(item: DocumentSummary | undefined): item is DocumentSummary {
  return Boolean(item && typeof item.id === 'string' && item.id && typeof item.projectDir === 'string' && item.projectDir)
}

function seedEntries(documents: readonly DocumentSummary[]): CatalogEntry[] {
  return documents.filter(usableSummary).map((summary) => ({ fingerprint: '', summary }))
}

async function sharedEntries(storageRoot: string): Promise<CatalogEntry[] | null> {
  try {
    return seedEntries(await readIndex(storageRoot))
  } catch {
    return null
  }
}

async function publishDocuments(documents: DocumentSummary[]): Promise<void> {
  const settings = await loadSettings()
  if (!settings.storageRoot) return
  const token = ++latestPublish
  let decorated = documents
  try {
    decorated = await decorateDocuments(settings, documents)
  } catch {
    decorated = documents
  }
  if (token !== latestPublish) return
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send(IPC_CHANNELS.documentsUpdated, decorated)
  }
}

export async function listCachedDocuments(storageRoot: string): Promise<DocumentSummary[]> {
  const local = await withCatalogLock(() => readLocalCatalog(catalogFile(storageRoot)))
  if (local) return local.map((entry) => entry.summary)
  const shared = await sharedEntries(storageRoot)
  return shared ? shared.map((entry) => entry.summary) : []
}

export async function rememberDocument(storageRoot: string, project: DocumentProject): Promise<void> {
  let documents: DocumentSummary[] | null = null
  await withCatalogLock(async () => {
    const filePath = catalogFile(storageRoot)
    const existing = (await readLocalCatalog(filePath)) ?? (await sharedEntries(storageRoot))
    if (!existing) return
    const summary = toSummary(project)
    const key = projectDirKey(project.projectDir)
    const next = existing.filter(
      (entry) => entry.summary.id !== project.id && projectDirKey(entry.summary.projectDir) !== key
    )
    next.push({ fingerprint: project.fingerprint || '', summary })
    await writeLocalCatalog(filePath, storageRoot, next)
    documents = next.map((entry) => entry.summary)
  })
  if (documents) await publishDocuments(documents)
}

export async function forgetDocument(storageRoot: string, projectDir: string): Promise<void> {
  let documents: DocumentSummary[] | null = null
  await withCatalogLock(async () => {
    const filePath = catalogFile(storageRoot)
    const existing = (await readLocalCatalog(filePath)) ?? (await sharedEntries(storageRoot))
    if (!existing) return
    const key = projectDirKey(projectDir)
    const next = existing.filter((entry) => projectDirKey(entry.summary.projectDir) !== key)
    await writeLocalCatalog(filePath, storageRoot, next)
    documents = next.map((entry) => entry.summary)
  })
  if (documents) await publishDocuments(documents)
}

export function scheduleCatalogRefresh(): void {
  if (refreshTimer || refreshRunning) return
  const wait = lastFinished === 0 ? 0 : Math.max(0, MIN_GAP_MS - (Date.now() - lastFinished))
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void runCatalogRefresh()
  }, wait)
  refreshTimer.unref?.()
}

async function runCatalogRefresh(): Promise<void> {
  if (refreshRunning) return
  refreshRunning = true
  try {
    const settings = await loadSettings()
    const storageRoot = settings.storageRoot
    if (!storageRoot) return
    const filePath = catalogFile(storageRoot)
    const previous = (await readLocalCatalog(filePath)) ?? (await sharedEntries(storageRoot)) ?? []
    const walked = await refreshDocumentIndex(storageRoot, previous)
    if (!walked) return
    let documents: DocumentSummary[] = []
    await withCatalogLock(async () => {
      const current = (await readLocalCatalog(filePath)) ?? []
      const merged = await reconcileCatalog(walked, current)
      await writeLocalCatalog(filePath, storageRoot, merged)
      documents = merged.map((entry) => entry.summary)
    })
    await publishDocuments(documents)
  } catch {
    // The folder can be offline. Keep showing the list already on screen.
  } finally {
    refreshRunning = false
    lastFinished = Date.now()
    scheduleCatalogRefresh()
  }
}
