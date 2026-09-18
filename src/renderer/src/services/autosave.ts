import { ERROR_CODES } from '@shared/constants'
import { mergePersistedProject } from '@shared/persistState'
import { debounce } from '@shared/utils'
import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { useDocumentStore } from '../stores/documentStore'
import type { DocumentProject } from '@shared/types'

const saveLocks = new Map<string, Promise<unknown>>()

async function withSaveLock<T>(id: string, work: () => Promise<T>): Promise<T> {
  const previous = saveLocks.get(id) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  saveLocks.set(
    id,
    previous.then(
      () => current,
      () => current
    )
  )
  try {
    await previous
  } catch {
    // A failed save must not block the next attempt.
  }
  try {
    return await work()
  } finally {
    release()
  }
}

type PersistResult =
  | { status: 'saved'; project: DocumentProject }
  | { status: 'dirty' }
  | { status: 'error' }

export function useAutosave(): void {
  const autosaveMs = useAppStore((state) => state.settings.autosaveMs)

  useEffect(() => {
    const save = debounce(() => {
      void flushDirty(() => save())
    }, autosaveMs)

    const unsubscribe = useDocumentStore.subscribe((state, prev) => {
      const dirty = Object.values(state.open).some((doc) => doc.saveStatus === 'saving')
      const changed = state.open !== prev.open
      if (dirty && changed) save()
    })

    return () => {
      save.cancel()
      unsubscribe()
    }
  }, [autosaveMs])
}

let flushing = false

async function flushDirty(reschedule: () => void): Promise<void> {
  if (flushing) {
    reschedule()
    return
  }
  flushing = true
  try {
    const ids = Object.entries(useDocumentStore.getState().open)
      .filter(([, doc]) => doc.saveStatus === 'saving')
      .map(([id]) => id)
    let dirtyAgain = false
    for (const id of ids) {
      const result = await persistAnnotations(id)
      if (result.status === 'error') {
        useDocumentStore.getState().setSaveStatus(id, 'error')
        continue
      }
      if (result.status === 'dirty') dirtyAgain = true
    }
    if (dirtyAgain) reschedule()
  } finally {
    flushing = false
  }
}

async function writeProject(project: DocumentProject): Promise<DocumentProject | null> {
  const attempt = await window.studyApi.saveProject({
    project,
    expectedFingerprint: project.fingerprint
  })
  if (attempt.ok) return attempt.data

  if (attempt.code === ERROR_CODES.EXTERNAL_CHANGE) {
    const loaded = await window.studyApi.loadProject(project.projectDir)
    if (loaded.ok) {
      const retry = await window.studyApi.saveProject({
        project: { ...project, fingerprint: loaded.data.fingerprint },
        expectedFingerprint: loaded.data.fingerprint
      })
      if (retry.ok) return retry.data
      useAppStore.getState().setSaveError(retry.error)
      return null
    }
  }

  useAppStore.getState().setSaveError(attempt.error)
  return null
}

async function persistAnnotationsUnlocked(id: string): Promise<PersistResult> {
  const doc = useDocumentStore.getState().open[id]
  if (!doc) return { status: 'error' }
  const revision = doc.revision
  const persisted = await writeProject(doc.project)
  if (!persisted) return { status: 'error' }

  const current = useDocumentStore.getState().open[id]
  if (!current) return { status: 'error' }
  const merged = mergePersistedProject(current.project, persisted, current.revision, revision)
  if (!merged.caughtUp) {
    useDocumentStore.getState().acceptFingerprint(id, persisted.fingerprint)
    return { status: 'dirty' }
  }

  useDocumentStore.getState().patchProject(id, merged.project, false)
  useDocumentStore.getState().setSaveStatus(id, 'saved')
  return { status: 'saved', project: merged.project }
}

async function persistAnnotations(id: string): Promise<PersistResult> {
  return withSaveLock(id, () => persistAnnotationsUnlocked(id))
}

export async function saveNow(id: string, exportPdf = false): Promise<boolean> {
  return withSaveLock(id, async () => {
    let saved: DocumentProject | null = null
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const doc = useDocumentStore.getState().open[id]
      if (!doc) return false
      useDocumentStore.getState().setSaveStatus(id, 'saving')
      const result = await persistAnnotationsUnlocked(id)
      if (result.status === 'error') {
        useDocumentStore.getState().setSaveStatus(id, 'error')
        return false
      }
      if (result.status === 'dirty') continue
      saved = result.project
      break
    }
    if (!saved) return false

    if (exportPdf) {
      useDocumentStore.getState().setExportStatus(id, 'exporting')
      const exported = await window.studyApi.exportPdf({ project: saved })
      if (!exported.ok) {
        useDocumentStore.getState().setExportStatus(id, 'error')
        useAppStore.getState().setSaveError(
          `${exported.error} Close the finished PDF if it is open, then try Save PDF again.`
        )
        const list = await window.studyApi.listDocuments()
        if (list.ok) useAppStore.getState().setDocuments(list.data)
        return false
      }
      useDocumentStore.getState().setExportStatus(id, 'idle')
      useDocumentStore.getState().patchProject(id, exported.data, false)
      const fileName = exported.data.exportPdfPath.replace(/^.*[\\/]/, '')
      useAppStore.getState().setSaveError(null)
      useAppStore.getState().setNotice(`Finished PDF saved: ${fileName}`)
    }
    const list = await window.studyApi.listDocuments()
    if (list.ok) useAppStore.getState().setDocuments(list.data)
    return true
  })
}
