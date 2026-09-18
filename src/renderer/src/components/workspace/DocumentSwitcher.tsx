import { useEffect, useRef, useState } from 'react'
import type { DocumentProject } from '@shared/types'
import { Icons } from '../shared/Icons'
import { forgetPdf } from '../../services/pdfRenderer'
import { saveNow } from '../../services/autosave'
import { useDocumentStore } from '../../stores/documentStore'
import styles from './DocumentSwitcher.module.css'

interface Props {
  documents: DocumentProject[]
  activeId: string
}

export function DocumentSwitcher({ documents, activeId }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef(0)
  const active = documents.find((item) => item.id === activeId) ?? documents[0]
  const many = documents.length > 1

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  if (!active) return null

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={() => {
        if (!many) return
        window.clearTimeout(closeTimer.current)
        setOpen(true)
      }}
      onMouseLeave={() => {
        closeTimer.current = window.setTimeout(() => setOpen(false), 140)
      }}
    >
      <button
        className={styles.trigger}
        type="button"
        aria-haspopup={many ? 'listbox' : undefined}
        aria-expanded={many ? open : undefined}
        disabled={!many}
        onClick={() => {
          if (many) setOpen((value) => !value)
        }}
      >
        <span className={styles.title}>{active.title}</span>
        {many && <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>{Icons.chevron}</span>}
      </button>
      {many && open && (
        <ul className={styles.menu} role="listbox" aria-label="Open worksheets">
          {documents.map((doc) => (
            <li key={doc.id}>
              <button
                className={doc.id === activeId ? styles.itemOn : styles.item}
                role="option"
                aria-selected={doc.id === activeId}
                onClick={() => {
                  useDocumentStore.getState().setActive(doc.id)
                  setOpen(false)
                }}
              >
                {doc.title}
              </button>
              <button
                className={styles.close}
                aria-label={`Close ${doc.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  void (async () => {
                    await saveNow(doc.id)
                    forgetPdf(doc.id)
                    useDocumentStore.getState().closeDocument(doc.id)
                  })()
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
