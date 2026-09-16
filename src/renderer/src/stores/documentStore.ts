import { create } from 'zustand'
import { HISTORY_LIMIT } from '@shared/constants'
import {
  addAnnotationCommand,
  createHistory,
  deleteManyCommand,
  modifyAnnotationCommand,
  pushCommand,
  redoHistory,
  undoHistory,
  type HistoryState
} from '@shared/history'
import type { Annotation, DocumentProject, SaveStatus } from '@shared/types'

interface OpenDocument {
  project: DocumentProject
  pdfBytes: ArrayBuffer | null
  saveStatus: SaveStatus
  history: HistoryState
  selectedAnnotationId: string | null
}

interface DocumentState {
  open: Record<string, OpenDocument>
  openOrder: string[]
  activeId: string | null
  openDocument: (project: DocumentProject, pdfBytes: ArrayBuffer | null) => void
  closeDocument: (id: string) => void
  setActive: (id: string | null) => void
  patchProject: (id: string, project: DocumentProject, markDirty?: boolean) => void
  setSaveStatus: (id: string, saveStatus: SaveStatus) => void
  setPdfBytes: (id: string, pdfBytes: ArrayBuffer) => void
  setSelected: (id: string, annotationId: string | null) => void
  applyAdd: (id: string, annotation: Annotation) => void
  applyDeleteMany: (id: string, annotations: Annotation[]) => void
  applyModify: (id: string, before: Annotation, after: Annotation) => void
  undo: (id: string) => void
  redo: (id: string) => void
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  open: {},
  openOrder: [],
  activeId: null,
  openDocument: (project, pdfBytes) => {
    const current = get().open[project.id]
    set({
      open: {
        ...get().open,
        [project.id]: current
          ? { ...current, project }
          : {
              project,
              pdfBytes,
              saveStatus: 'saved',
              history: createHistory(),
              selectedAnnotationId: null
            }
      },
      openOrder: get().openOrder.includes(project.id) ? get().openOrder : [...get().openOrder, project.id],
      activeId: project.id
    })
  },
  closeDocument: (id) => {
    const { [id]: _removed, ...rest } = get().open
    const openOrder = get().openOrder.filter((item) => item !== id)
    const activeId = get().activeId === id ? (openOrder[openOrder.length - 1] ?? null) : get().activeId
    set({ open: rest, openOrder, activeId })
  },
  setActive: (id) => set({ activeId: id }),
  patchProject: (id, project, markDirty = true) => {
    const current = get().open[id]
    if (!current) return
    set({
      open: {
        ...get().open,
        [id]: {
          ...current,
          project,
          saveStatus: markDirty ? 'saving' : current.saveStatus
        }
      }
    })
  },
  setSaveStatus: (id, saveStatus) => {
    const current = get().open[id]
    if (!current) return
    set({ open: { ...get().open, [id]: { ...current, saveStatus } } })
  },
  setPdfBytes: (id, pdfBytes) => {
    const current = get().open[id]
    if (!current) return
    set({ open: { ...get().open, [id]: { ...current, pdfBytes } } })
  },
  setSelected: (id, annotationId) => {
    const current = get().open[id]
    if (!current) return
    set({ open: { ...get().open, [id]: { ...current, selectedAnnotationId: annotationId } } })
  },
  applyAdd: (id, annotation) => {
    const current = get().open[id]
    if (!current) return
    const next = pushCommand(current.history, addAnnotationCommand(annotation), current.project, HISTORY_LIMIT)
    set({
      open: {
        ...get().open,
        [id]: {
          ...current,
          project: {
            ...next.project,
            status: next.project.status === 'not_started' ? 'in_progress' : next.project.status
          },
          history: next.history,
          saveStatus: 'saving'
        }
      }
    })
  },
  applyDeleteMany: (id, annotations) => {
    const current = get().open[id]
    if (!current || annotations.length === 0) return
    const next = pushCommand(current.history, deleteManyCommand(annotations), current.project, HISTORY_LIMIT)
    set({
      open: {
        ...get().open,
        [id]: { ...current, project: next.project, history: next.history, saveStatus: 'saving', selectedAnnotationId: null }
      }
    })
  },
  applyModify: (id, before, after) => {
    const current = get().open[id]
    if (!current) return
    const next = pushCommand(current.history, modifyAnnotationCommand(before, after), current.project, HISTORY_LIMIT)
    set({
      open: {
        ...get().open,
        [id]: { ...current, project: next.project, history: next.history, saveStatus: 'saving' }
      }
    })
  },
  undo: (id) => {
    const current = get().open[id]
    if (!current) return
    const next = undoHistory(current.history, current.project)
    if (!next) return
    set({
      open: {
        ...get().open,
        [id]: { ...current, project: next.project, history: next.history, saveStatus: 'saving' }
      }
    })
  },
  redo: (id) => {
    const current = get().open[id]
    if (!current) return
    const next = redoHistory(current.history, current.project)
    if (!next) return
    set({
      open: {
        ...get().open,
        [id]: { ...current, project: next.project, history: next.history, saveStatus: 'saving' }
      }
    })
  }
}))

export function activeDocument(): OpenDocument | null {
  const state = useDocumentStore.getState()
  if (!state.activeId) return null
  return state.open[state.activeId] ?? null
}
