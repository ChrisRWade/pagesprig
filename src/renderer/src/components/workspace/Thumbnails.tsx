import { useEffect, useRef } from 'react'
import type { DocumentProject, PageSpec } from '@shared/types'
import { loadPdfDocument, renderNotePage, renderPdfPage } from '../../services/pdfRenderer'
import { useAppStore } from '../../stores/appStore'
import styles from './Thumbnails.module.css'

interface Props {
  project: DocumentProject
  open: boolean
}

export function Thumbnails({ project, open }: Props) {
  const currentPage = useAppStore((state) => state.currentPage)
  return (
    <aside
      className={`${styles.side} ${open ? styles.open : ''}`}
      aria-label="Page thumbnails"
      aria-hidden={!open}
      inert={!open}
    >
      {project.pages.map((page) => (
        <Thumb
          key={page.page}
          project={project}
          page={page}
          current={page.page === currentPage}
          reveal={open && page.page === currentPage}
          open={open}
        />
      ))}
    </aside>
  )
}

function Thumb({
  project,
  page,
  current,
  reveal,
  open
}: {
  project: DocumentProject
  page: PageSpec
  current: boolean
  reveal: boolean
  open: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const width = 52
  const height = width * (page.height / page.width)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !open) return
    let cancelled = false
    const run = async () => {
      try {
        if (page.source === 'original' && page.originalPage) {
          const pdf = await loadPdfDocument(project.id, project.sourcePdfPath)
          if (cancelled || !canvasRef.current) return
          await renderPdfPage(pdf, page.originalPage, canvasRef.current, width, {
            priority: 5,
            cacheId: `${project.id}:thumb:${page.originalPage}`
          })
        } else {
          renderNotePage(canvas, page.source, width, height)
        }
      } catch {
        if (!cancelled && canvasRef.current) {
          renderNotePage(canvasRef.current, 'blank', width, height)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [height, open, page.originalPage, page.page, page.source, project.id, project.sourcePdfPath])

  useEffect(() => {
    if (reveal) {
      buttonRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [reveal])

  return (
    <button
      ref={buttonRef}
      className={current ? `${styles.thumb} ${styles.thumbOn}` : styles.thumb}
      aria-current={current ? 'page' : undefined}
      onClick={() => useAppStore.getState().requestPage(page.page)}
    >
      <canvas ref={canvasRef} className={styles.sheet} aria-hidden="true" />
      {page.page}
    </button>
  )
}
