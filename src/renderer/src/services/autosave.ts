import { useEffect } from 'react'
import { debounce } from '@shared/utils'
import { useAppStore } from '../stores/appStore'
import { useDocumentStore } from '../stores/documentStore'

export function useAutosave(): void {
  const autosaveMs = useAppStore((state) => state.settings.autosaveMs)
  const setSaveError = useAppStore((state) => state.setSaveError)
  const setDocuments = useAppStore((state) => state.setDocuments)

  useEffect(() => {
    const save = debounce(async () => {
      const { open } = useDocumentStore.getState()
      for (const [id, doc] of Object.entries(open)) {
        if (doc.saveStatus !== 'saving') continue
        useDocumentStore.getState().setSaveStatus(id, 'saving')
        const result = await window.studyApi.saveProject({
          project: doc.project,
          expectedFingerprint: doc.project.fingerprint
        })
        if (!result.ok) {
          useDocumentStore.getState().setSaveStatus(id, 'error')
          setSaveError(result.error)
          continue
        }
        setSaveError(null)
        useDocumentStore.getState().patchProject(id, result.data, false)
        useDocumentStore.getState().setSaveStatus(id, 'saved')
        const list = await window.studyApi.listDocuments()
        if (list.ok) setDocuments(list.data)
      }
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
  }, [autosaveMs, setDocuments, setSaveError])
}

export async function saveNow(id: string, exportPdf = false): Promise<boolean> {
  const doc = useDocumentStore.getState().open[id]
  if (!doc) return false
  useDocumentStore.getState().setSaveStatus(id, 'saving')
  const result = await window.studyApi.saveProject({
    project: doc.project,
    expectedFingerprint: doc.project.fingerprint,
    exportPdf
  })
  if (!result.ok) {
    useDocumentStore.getState().setSaveStatus(id, 'error')
    useAppStore.getState().setSaveError(result.error)
    return false
  }
  useAppStore.getState().setSaveError(null)
  useDocumentStore.getState().patchProject(id, result.data, false)
  useDocumentStore.getState().setSaveStatus(id, 'saved')
  if (exportPdf) {
    const exported = await window.studyApi.exportPdf({ project: result.data })
    if (!exported.ok) {
      useAppStore.getState().setSaveError(exported.error)
      return false
    }
  }
  const list = await window.studyApi.listDocuments()
  if (list.ok) useAppStore.getState().setDocuments(list.data)
  return true
}
