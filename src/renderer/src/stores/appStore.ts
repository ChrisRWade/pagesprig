import { create } from 'zustand'
import { ZOOM_LEVELS } from '@shared/constants'
import type { AppSettings, DocumentSummary, RecoveryInfo, ToolId } from '@shared/types'
import { defaultSettings, settingsNeedSetup } from '@shared/settingsSchema'

export type AppView = 'loading' | 'setup' | 'recovery' | 'picker' | 'main' | 'settings' | 'recent'

interface AppState {
  settings: AppSettings
  view: AppView
  previousView: AppView
  tool: ToolId
  shapeTool: Extract<ToolId, 'rect' | 'ellipse' | 'arrow' | 'checkmark' | 'xmark'>
  zoom: number
  error: string | null
  saveError: string | null
  documents: DocumentSummary[]
  recovery: RecoveryInfo[]
  pendingDrop: string[]
  thumbnailsOpen: boolean
  currentPage: number
  setSettings: (settings: AppSettings) => void
  setView: (view: AppView) => void
  openSettings: () => void
  closeOverlay: () => void
  setTool: (tool: ToolId) => void
  setShapeTool: (tool: AppState['shapeTool']) => void
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setError: (error: string | null) => void
  setSaveError: (error: string | null) => void
  setDocuments: (documents: DocumentSummary[]) => void
  setRecovery: (recovery: RecoveryInfo[]) => void
  setPendingDrop: (paths: string[]) => void
  setThumbnailsOpen: (open: boolean) => void
  setCurrentPage: (page: number) => void
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
  error: null,
  saveError: null,
  documents: [],
  recovery: [],
  pendingDrop: [],
  thumbnailsOpen: false,
  currentPage: 1,
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
  setError: (error) => set({ error }),
  setSaveError: (saveError) => set({ saveError }),
  setDocuments: (documents) => set({ documents }),
  setRecovery: (recovery) => set({ recovery }),
  setPendingDrop: (pendingDrop) => set({ pendingDrop }),
  setThumbnailsOpen: (thumbnailsOpen) => set({ thumbnailsOpen }),
  setCurrentPage: (currentPage) => set({ currentPage })
}))
