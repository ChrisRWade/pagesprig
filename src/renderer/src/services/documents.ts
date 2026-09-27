import { useMemo } from 'react'
import { mergeDocumentCatalog, annotationsForPage } from '@shared/serialize'
import { isNotePageSource } from '@shared/notePages'
import { dayRangesOf, setDayReview, withDayRanges } from '@shared/packetDays'
import { nowIso } from '@shared/utils'
import { forgetPdf, loadPdfDocument } from './pdfRenderer'
import { saveNow } from './autosave'
import { useAppStore } from '../stores/appStore'
import { useDocumentStore } from '../stores/documentStore'
import type { DocumentProject, DocumentSummary, PacketDay, PageSource } from '@shared/types'

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
  useAppStore.getState().setOverviewOpen(false)
  useAppStore.getState().requestPage(1)
  return true
}

export async function focusStudentAndSubject(studentId: string, subjectId?: string): Promise<void> {
  const settings = useAppStore.getState().settings
  const student = settings.students.find((item) => item.id === studentId)
  const nextSubject = subjectId ?? student?.subjects[0]?.id ?? null
  if (settings.selectedStudentId === studentId && settings.selectedSubjectId === nextSubject) return
  const next = {
    ...settings,
    selectedStudentId: studentId,
    selectedSubjectId: nextSubject
  }
  const saved = await window.studyApi.saveSettings(next)
  if (saved.ok) useAppStore.getState().setSettings(saved.data)
}

export async function openSummary(
  summary: DocumentSummary,
  options?: { page?: number }
): Promise<void> {
  await focusStudentAndSubject(summary.studentId, summary.subjectId)
  const loaded = await window.studyApi.loadProject(summary.projectDir)
  if (!loaded.ok) {
    useAppStore.getState().setError(loaded.error)
    return
  }
  const opened = await openProject(loaded.data)
  if (opened) useAppStore.getState().requestPage(options?.page ?? 1)
}

export async function saveDayRanges(
  project: DocumentProject,
  ranges: PacketDay[],
  overviewEndPage = project.overviewEndPage ?? 0
): Promise<boolean> {
  const next = { ...withDayRanges(project, ranges, overviewEndPage), updatedAt: nowIso() }
  if (useDocumentStore.getState().open[project.id]) {
    useDocumentStore.getState().patchProject(project.id, next)
    return saveNow(project.id)
  }
  const saved = await window.studyApi.saveProject({
    project: next,
    expectedFingerprint: project.fingerprint
  })
  if (!saved.ok) {
    useAppStore.getState().setError(saved.error)
    return false
  }
  await refreshDocuments()
  return true
}

export async function saveDayReview(
  summary: DocumentSummary,
  date: string,
  patch: { reviewed?: boolean; questionCount?: number | null; correctCount?: number | null }
): Promise<boolean> {
  const open = useDocumentStore.getState().open[summary.id]?.project
  let project = open
  if (!project) {
    const loaded = await window.studyApi.loadProject(summary.projectDir)
    if (!loaded.ok) {
      useAppStore.getState().setError(loaded.error)
      return false
    }
    project = loaded.data
  }
  const ranges = setDayReview(dayRangesOf(project), date, patch)
  return saveDayRanges(project, ranges, project.overviewEndPage)
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

export async function addNotesPage(project: DocumentProject, source: PageSource): Promise<boolean> {
  const result = await window.studyApi.addNotePage({ project, source })
  if (!result.ok) {
    useAppStore.getState().setError(result.error)
    return false
  }
  useDocumentStore.getState().patchProject(project.id, result.data, false)
  useAppStore.getState().requestPage(result.data.pages.length)
  return true
}

export async function removeNotesPage(project: DocumentProject, pageNumber: number): Promise<boolean> {
  const spec = project.pages.find((item) => item.page === pageNumber)
  if (!spec || !isNotePageSource(spec.source)) return false
  const marked = annotationsForPage(project, pageNumber).length > 0
  const ok = window.confirm(
    marked
      ? `Remove notes page ${pageNumber}? The writing on it will be deleted.`
      : `Remove notes page ${pageNumber}?`
  )
  if (!ok) return false
  const result = await window.studyApi.removeNotePage({ project, page: pageNumber })
  if (!result.ok) {
    useAppStore.getState().setError(result.error)
    return false
  }
  useDocumentStore.getState().patchProject(project.id, result.data, false)
  useAppStore.getState().requestPage(Math.min(pageNumber, result.data.pages.length))
  return true
}
