import { useEffect, useRef, useState } from 'react'
import { APP_NAME, ZOOM_LEVELS } from '@shared/constants'
import { finishedPdfState } from '@shared/exportState'
import { isNotePageSource, type NotePageSource } from '@shared/notePages'
import type { DocumentProject } from '@shared/types'
import { Button } from '../shared/Button'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import { saveNow } from '../../services/autosave'
import { addNotesPage, removeDocument, removeNotesPage } from '../../services/documents'
import styles from './PageControls.module.css'

interface Props {
  project: DocumentProject
}

const NOTE_KINDS: { id: NotePageSource; label: string }[] = [
  { id: 'blank', label: 'Blank' },
  { id: 'lined', label: 'Lined' },
  { id: 'graph', label: 'Graph' },
  { id: 'dot', label: 'Dot grid' }
]

export function PageControls({ project }: Props) {
  const zoom = useAppStore((state) => state.zoom)
  const currentPage = useAppStore((state) => state.currentPage)
  const page = Math.min(Math.max(1, currentPage), Math.max(1, project.pages.length))
  const exportStatus = useDocumentStore((state) => state.open[project.id]?.exportStatus ?? 'idle')
  const pdfNeedsSaving = finishedPdfState(project) !== 'current'
  const [jumpValue, setJumpValue] = useState(String(page))
  const jumpFocused = useRef(false)
  const spec = project.pages.find((item) => item.page === page)
  const canRemoveNotes = Boolean(spec && isNotePageSource(spec.source))

  useEffect(() => {
    if (!jumpFocused.current) setJumpValue(String(page))
  }, [page])

  const goToPage = (target: number) => {
    if (!Number.isFinite(target)) return
    const next = Math.min(project.pages.length, Math.max(1, Math.round(target)))
    useAppStore.getState().requestPage(next)
  }

  const markComplete = async () => {
    const next = {
      ...project,
      status: project.status === 'completed' ? 'in_progress' : 'completed'
    } as DocumentProject
    useDocumentStore.getState().patchProject(project.id, next)
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
        <AddNotesMenu onPick={(source) => void addNotesPage(project, source)} />
        {canRemoveNotes && (
          <Button variant="ghost" onClick={() => void removeNotesPage(project, page)}>
            Remove this page
          </Button>
        )}
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
                `Remove "${project.title}" from ${APP_NAME}? The copy in the schoolwork folder is deleted. The original file you dropped is not changed.`
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

function AddNotesMenu({ onPick }: { onPick: (source: NotePageSource) => void }) {
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState({ bottom: 0, left: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef(0)

  const showMenu = () => {
    window.clearTimeout(closeTimer.current)
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect) {
      setMenu({
        bottom: window.innerHeight - rect.top + 4,
        left: Math.min(rect.left, window.innerWidth - 188)
      })
    }
    setOpen(true)
  }

  const hideMenu = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  return (
    <div
      ref={wrapRef}
      className={styles.notesWrap}
      onMouseEnter={showMenu}
      onMouseLeave={hideMenu}
    >
      <Button
        variant="ghost"
        title="Hover to choose a notes page"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={showMenu}
      >
        Add notes page
      </Button>
      {open && (
        <div
          className={styles.notesMenu}
          role="menu"
          aria-label="Notes page style"
          style={{ bottom: menu.bottom, left: menu.left }}
          onMouseEnter={showMenu}
          onMouseLeave={hideMenu}
        >
          {NOTE_KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={styles.notesItem}
              onClick={() => {
                setOpen(false)
                onPick(item.id)
              }}
            >
              <span className={`${styles.preview} ${styles[item.id]}`} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}