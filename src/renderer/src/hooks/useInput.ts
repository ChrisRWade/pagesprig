import { useEffect } from 'react'
import { SESSION_HEARTBEAT_MS } from '@shared/constants'
import { useAppStore } from '../stores/appStore'
import { useDocumentStore } from '../stores/documentStore'
import { saveNow } from '../services/autosave'

export function useSessionHeartbeat(): void {
  const view = useAppStore((state) => state.view)

  useEffect(() => {
    const tick = () => {
      const { openOrder, activeId } = useDocumentStore.getState()
      void window.studyApi.heartbeat({ openDocumentIds: openOrder, activeDocumentId: activeId })
    }
    tick()
    const timer = window.setInterval(tick, SESSION_HEARTBEAT_MS)
    return () => window.clearInterval(timer)
  }, [view])

  useEffect(() => {
    const onHide = () => {
      const { openOrder } = useDocumentStore.getState()
      for (const id of openOrder) {
        void saveNow(id)
      }
    }
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide()
    })
    return () => window.removeEventListener('beforeunload', onHide)
  }, [])
}

export function useKeyboard(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      const app = useAppStore.getState()
      const docs = useDocumentStore.getState()
      const activeId = docs.activeId

      if (event.key === 'Escape') {
        if (app.view === 'settings' || app.view === 'recent') app.closeOverlay()
        if (activeId) docs.setSelected(activeId, null)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        app.openSettings()
        return
      }

      if (typing) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (activeId) docs.undo(activeId)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        if (activeId) docs.redo(activeId)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (activeId) void saveNow(activeId, true)
        return
      }
      if (event.key === 'PageDown' || event.key === 'PageUp' || event.key === 'Home' || event.key === 'End') {
        const doc = activeId ? docs.open[activeId] : null
        if (!doc) return
        event.preventDefault()
        const last = doc.project.pages.length
        const current = app.currentPage
        const next =
          event.key === 'Home'
            ? 1
            : event.key === 'End'
              ? last
              : event.key === 'PageDown'
                ? current + 1
                : current - 1
        app.requestPage(Math.min(last, Math.max(1, next)))
        return
      }
      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        app.zoomIn()
        return
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        app.zoomOut()
        return
      }
      if (event.key.toLowerCase() === 'v') app.setTool('select')
      if (event.key.toLowerCase() === 'p') app.setTool('pencil')
      if (event.key.toLowerCase() === 'h') app.setTool('highlighter')
      if (event.key.toLowerCase() === 't') app.setTool('text')
      if (event.key.toLowerCase() === 'l') app.setTool('line')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
