import { create } from 'zustand'
import { ZOOM_LEVELS, type MarkSize } from '@shared/constants'
import type { AppSettings, DocumentSummary, RecoveryInfo, ToolId } from '@shared/types'
import { defaultSettings, settingsNeedSetup } from '@shared/settingsSchema'
import { createId } from '@shared/utils'

export type AppView = 'loading' | 'setup' | 'recovery' | 'picker' | 'main' | 'settings' | 'recent'
export type ToastKind = 'error' | 'success'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
}

interface AppState {
  settings: AppSettings
  view: AppView
  previousView: AppView
  tool: ToolId
  shapeTool: Extract<ToolId, 'rect' | 'ellipse' | 'arrow' | 'checkmark' | 'xmark'>
  zoom: number
  markSize: MarkSize
  error: string | null
  saveError: string | null
  notice: string | null
  toasts: Toast[]
  documents: DocumentSummary[]
  recovery: RecoveryInfo[]
  pendingDrop: string[]
  thumbnailsOpen: boolean
  currentPage: number
  requestedPage: number | null
  setSettings: (settings: AppSettings) => void
  setView: (view: AppView) => void
  openSettings: () => void
  closeOverlay: () => void
  setTool: (tool: ToolId) => void
  setShapeTool: (tool: AppState['shapeTool']) => void
  setZoom: (zoom: number) => void
  setMarkSize: (size: MarkSize) => void
  zoomIn: () => void
  zoomOut: () => void
  setError: (error: string | null) => void
  setSaveError: (error: string | null) => void
  setNotice: (notice: string | null) => void
  dismissToast: (id: string) => void
  setDocuments: (documents: DocumentSummary[]) => void
  setRecovery: (recovery: RecoveryInfo[]) => void
  setPendingDrop: (paths: string[]) => void
  setThumbnailsOpen: (open: boolean) => void
  setCurrentPage: (page: number) => void
  requestPage: (page: number) => void
  clearRequestedPage: () => void
}

function pushToast(
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
  kind: ToastKind,
  message: string
): void {
  const toast: Toast = { id: createId(), kind, message }
  const toasts = [...get().toasts.filter((item) => item.message !== message), toast].slice(-3)
  set({ toasts })
}

function nearestZoom(value: number): number {
  return ZOOM_LEVELS.reduce((best, item) =>
    Math.abs(item - value) < Math.abs(best - value) ? item : best
  )
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: defaultSettings(),
  view: 'loading',
  previousView: 'main',
  tool: 'pencil',
  shapeTool: 'rect',
  zoom: 1,
  markSize: 'large',
  error: null,
  saveError: null,
  notice: null,
  toasts: [],
  documents: [],
  recovery: [],
  pendingDrop: [],
  thumbnailsOpen: false,
  currentPage: 1,
  requestedPage: null,
  setSettings: (settings) => set({ settings }),
  setView: (view) => set({ view }),
  openSettings: () => set({ previousView: get().view === 'settings' ? get().previousView : get().view, view: 'settings' }),
  closeOverlay: () => {
    const next = get().previousView === 'settings' ? 'main' : get().previousView
    set({ view: settingsNeedSetup(get().settings) ? 'setup' : next })
  },
  setTool: (tool) => set({ tool }),
  setShapeTool: (shapeTool) => set({ shapeTool, tool: shapeTool }),
  setZoom: (zoom) => set({ zoom: nearestZoom(zoom) }),
  setMarkSize: (markSize) => set({ markSize }),
  zoomIn: () => {
    const current = get().zoom
    const next = ZOOM_LEVELS.find((item) => item > current) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
    set({ zoom: next })
  },
  zoomOut: () => {
    const current = get().zoom
    const next = [...ZOOM_LEVELS].reverse().find((item) => item < current) ?? ZOOM_LEVELS[0]
    set({ zoom: next })
  },
  setError: (error) => {
    if (error) pushToast(set, get, 'error', error)
    set({ error })
  },
  setSaveError: (saveError) => {
    if (saveError) pushToast(set, get, 'error', saveError)
    set({ saveError })
  },
  setNotice: (notice) => {
    if (notice) pushToast(set, get, 'success', notice)
    set({ notice })
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((item) => item.id !== id) }),
  setDocuments: (documents) => set({ documents }),
  setRecovery: (recovery) => set({ recovery }),
  setPendingDrop: (pendingDrop) => set({ pendingDrop }),
  setThumbnailsOpen: (thumbnailsOpen) => set({ thumbnailsOpen }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  requestPage: (page) => set({ requestedPage: page, currentPage: page }),
  clearRequestedPage: () => set({ requestedPage: null })
}))
