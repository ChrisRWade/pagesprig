import { useEffect, useRef, useState } from 'react'
import { ZOOM_LEVELS } from '@shared/constants'
import { finishedPdfState } from '@shared/exportState'
import type { DocumentProject, PageSource } from '@shared/types'
import { Button } from '../shared/Button'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import { saveNow } from '../../services/autosave'
import { removeDocument } from '../../services/documents'
import styles from './PageControls.module.css'

interface Props {
  project: DocumentProject
}

export function PageControls({ project }: Props) {
  const zoom = useAppStore((state) => state.zoom)
  const currentPage = useAppStore((state) => state.currentPage)
  const page = Math.min(Math.max(1, currentPage), Math.max(1, project.pages.length))
  const exportStatus = useDocumentStore((state) => state.open[project.id]?.exportStatus ?? 'idle')
  const pdfNeedsSaving = finishedPdfState(project) !== 'current'
  const setError = useAppStore((state) => state.setError)
  const patchProject = useDocumentStore((state) => state.patchProject)
  const [jumpValue, setJumpValue] = useState(String(page))
  const jumpFocused = useRef(false)

  useEffect(() => {
    if (!jumpFocused.current) setJumpValue(String(page))
  }, [page])

  const goToPage = (target: number) => {
    if (!Number.isFinite(target)) return
    const next = Math.min(project.pages.length, Math.max(1, Math.round(target)))
    useAppStore.getState().requestPage(next)
  }

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
          Page {page} of {project.pages.length}
        </span>
        <Button
          variant="ghost"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          aria-label="Next page"
          disabled={page >= project.pages.length}
          onClick={() => goToPage(page + 1)}
        >
          Next
        </Button>
        <label className={styles.jump}>
          Jump
          <input
            type="number"
            min={1}
            max={project.pages.length}
            value={jumpValue}
            aria-label="Jump to page"
            onFocus={() => {
              jumpFocused.current = true
            }}
            onBlur={() => {
              jumpFocused.current = false
              goToPage(Number(jumpValue))
              setJumpValue(String(useAppStore.getState().currentPage))
            }}
            onChange={(event) => setJumpValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
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
        <Button
          variant={pdfNeedsSaving ? 'primary' : 'ghost'}
          disabled={exportStatus === 'exporting'}
          title="Write a finished PDF with your marks on it. Ctrl+S"
          onClick={() => void saveNow(project.id, true)}
        >
          {exportStatus === 'exporting' ? 'Saving PDF…' : 'Save PDF'}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (
              window.confirm(
                `Remove "${project.title}" from StudyPDF? The copy in the schoolwork folder is deleted. The original file you dropped is not changed.`
              )
            ) {
              void removeDocument(project.projectDir, project.id)
            }
          }}
        >
          Remove
        </Button>
        <Button variant={project.status === 'completed' ? 'primary' : 'ghost'} onClick={() => void markComplete()}>
          {project.status === 'completed' ? 'Completed' : 'Mark completed'}
        </Button>
      </div>
    </footer>
  )
}
