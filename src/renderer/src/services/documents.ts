import { useMemo } from 'react'
import { mergeDocumentCatalog } from '@shared/serialize'
import { forgetPdf, loadPdfDocument } from './pdfRenderer'
import { saveNow } from './autosave'
import { useAppStore } from '../stores/appStore'
import { useDocumentStore } from '../stores/documentStore'
import type { DocumentProject, DocumentSummary } from '@shared/types'

export function useCatalogDocuments(): DocumentSummary[] {
  const listed = useAppStore((state) => state.documents)
  const open = useDocumentStore((state) => state.open)
  return useMemo(
    () => mergeDocumentCatalog(listed, Object.values(open).map((item) => item.project)),
    [listed, open]
  )
}

export async function refreshDocuments(): Promise<void> {
  const list = await window.studyApi.listDocuments()
  if (list.ok) useAppStore.getState().setDocuments(list.data)
}

export async function ensureReadable(
  project: DocumentProject,
  options?: { discardIfUnreadable?: boolean }
): Promise<boolean> {
  try {
    await loadPdfDocument(project.id, project.sourcePdfPath)
    return true
  } catch (error) {
    forgetPdf(project.id)
    if (options?.discardIfUnreadable) {
      await window.studyApi.deleteDocument(project.projectDir)
      await refreshDocuments()
    }
    const message = error instanceof Error ? error.message : 'That worksheet could not be opened.'
    useAppStore.getState().setError(message)
    return false
  }
}

export async function openProject(
  project: DocumentProject,
  options?: { discardIfUnreadable?: boolean }
): Promise<boolean> {
  const readable = await ensureReadable(project, options)
  if (!readable) return false
  const { open } = useDocumentStore.getState()
  for (const doc of Object.values(open)) {
    if (doc.project.studentId !== project.studentId || doc.project.subjectId !== project.subjectId) {
      await saveNow(doc.project.id)
      useDocumentStore.getState().closeDocument(doc.project.id)
    }
  }
  useDocumentStore.getState().openDocument(project, null)
  useAppStore.getState().setView('main')
  return true
}

export async function openSummary(summary: DocumentSummary): Promise<void> {
  const loaded = await window.studyApi.loadProject(summary.projectDir)
  if (!loaded.ok) {
    useAppStore.getState().setError(loaded.error)
    return
  }
  await openProject(loaded.data)
}

export async function removeDocument(projectDir: string, documentId?: string): Promise<void> {
  const result = await window.studyApi.deleteDocument(projectDir)
  if (!result.ok) {
    useAppStore.getState().setError(result.error)
    return
  }
  if (documentId) {
    forgetPdf(documentId)
    useDocumentStore.getState().closeDocument(documentId)
  }
  await refreshDocuments()
}
