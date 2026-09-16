import { ZOOM_LEVELS } from '@shared/constants'
import type { DocumentProject, PageSource } from '@shared/types'
import { Button } from '../shared/Button'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import { saveNow } from '../../services/autosave'
import styles from './PageControls.module.css'

interface Props {
  project: DocumentProject
}

export function PageControls({ project }: Props) {
  const zoom = useAppStore((state) => state.zoom)
  const currentPage = useAppStore((state) => state.currentPage)
  const saveStatus = useDocumentStore((state) => state.open[project.id]?.saveStatus ?? 'idle')
  const setError = useAppStore((state) => state.setError)
  const patchProject = useDocumentStore((state) => state.patchProject)

  const addPage = async (source: PageSource) => {
    const result = await window.studyApi.addNotePage({ project, source })
    if (!result.ok) {
      setError(result.error)
      return
    }
    patchProject(project.id, result.data, false)
  }

  const markComplete = async () => {
    const next = {
      ...project,
      status: project.status === 'completed' ? 'in_progress' : 'completed'
    } as DocumentProject
    patchProject(project.id, next)
    await saveNow(project.id, next.status === 'completed')
  }

  return (
    <footer className={styles.bar}>
      <div className={styles.group}>
        <span className={styles.page}>
          Page {currentPage} of {project.pages.length}
        </span>
        <label className={styles.jump}>
          Jump
          <input
            type="number"
            min={1}
            max={project.pages.length}
            value={currentPage}
            aria-label="Jump to page"
            onChange={(event) => {
              const page = Number(event.target.value)
              const el = document.querySelector(`[aria-label="Page ${page}"]`)
              el?.scrollIntoView({ block: 'start' })
            }}
          />
        </label>
      </div>
      <div className={styles.group}>
        <Button variant="ghost" onClick={() => useAppStore.getState().zoomOut()} aria-label="Zoom out">
          -
        </Button>
        <span className={styles.zoom}>{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" onClick={() => useAppStore.getState().zoomIn()} aria-label="Zoom in">
          +
        </Button>
        <select
          aria-label="Zoom level"
          value={String(zoom)}
          onChange={(event) => useAppStore.getState().setZoom(Number(event.target.value))}
        >
          {ZOOM_LEVELS.map((level) => (
            <option key={level} value={level}>
              {Math.round(level * 100)}%
            </option>
          ))}
        </select>
      </div>
      <div className={styles.group}>
        <Button variant="ghost" onClick={() => void addPage('lined')}>
          Add notes page
        </Button>
        <select
          aria-label="Notes page style"
          defaultValue="lined"
          onChange={(event) => void addPage(event.target.value as PageSource)}
        >
          <option value="blank">Blank</option>
          <option value="lined">Lined</option>
          <option value="graph">Graph</option>
          <option value="dot">Dot grid</option>
        </select>
        <Button variant="ghost" onClick={() => void saveNow(project.id, true)}>
          Save now
        </Button>
        <Button variant={project.status === 'completed' ? 'primary' : 'ghost'} onClick={() => void markComplete()}>
          {project.status === 'completed' ? 'Completed' : 'Mark completed'}
        </Button>
        <span className={saveStatus === 'error' ? styles.bad : styles.saved} aria-live="polite">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'Saved'}
        </span>
      </div>
    </footer>
  )
}
