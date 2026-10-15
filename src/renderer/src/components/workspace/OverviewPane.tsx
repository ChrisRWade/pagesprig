import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  clampOverviewEnd,
  isOverviewPage,
  pageSpanLabel
} from '@shared/packetDays'
import type { DocumentProject } from '@shared/types'
import { Button } from '../shared/Button'
import { loadPdfDocument, renderNotePage, renderPdfPage } from '../../services/pdfRenderer'
import { useAppStore } from '../../stores/appStore'
import styles from './OverviewPane.module.css'

interface Props {
  project: DocumentProject
}

export function OverviewPane({ project }: Props) {
  const requested = useAppStore((state) => state.overviewPage)
  const external = (project.overviewPageCount ?? 0) > 0 && Boolean(project.overviewPdfPath)
  const end = external
    ? (project.overviewPageCount ?? 0)
    : clampOverviewEnd(project.overviewEndPage ?? 0, project.pages.length)
  const page = Math.min(end, Math.max(1, requested))
  const spec = useMemo(
    () =>
      external
        ? {
            page,
            source: 'original' as const,
            originalPage: page,
            width: project.pages[0]?.width ?? 612,
            height: project.pages[0]?.height ?? 792
          }
        : (project.pages.find((item) => item.page === page) ?? project.pages[0]),
    [external, page, project.pages]
  )
  const pdfPath = external ? project.overviewPdfPath! : project.sourcePdfPath
  const pdfId = external ? `${project.id}:overview` : project.id
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(280)

  useEffect(() => {
    if (requested !== page) useAppStore.getState().setOverviewPage(page)
  }, [page, requested])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => {
      const next = Math.max(160, el.clientWidth - 24)
      setWidth((current) => (Math.abs(current - next) < 2 ? current : next))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !spec || !isOverviewPage(page, end)) return
    const height = width * (spec.height / spec.width)
    let cancelled = false
    const run = async () => {
      try {
        if (spec.source === 'original' && spec.originalPage) {
          const pdf = await loadPdfDocument(pdfId, pdfPath)
          if (cancelled || !canvasRef.current) return
          await renderPdfPage(pdf, spec.originalPage, canvasRef.current, width, {
            priority: 0,
            cacheId: `${pdfId}:${spec.originalPage}`
          })
        } else {
          renderNotePage(canvas, spec.source, width, height)
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
  }, [end, external, page, pdfId, pdfPath, project.id, project.sourcePdfPath, spec, width])

  if (end <= 0 || !spec) return null

  const go = (next: number) => useAppStore.getState().setOverviewPage(Math.min(end, Math.max(1, next)))
  const height = width * (spec.height / spec.width)

  return (
    <aside className={styles.pane} aria-label="Lesson overview">
      <header className={styles.top}>
        <div>
          <p className={styles.kicker}>Lesson overview</p>
          <strong>
            Page {page} of {end}
            <span> · {pageSpanLabel({ date: project.date, startPage: 1, endPage: end })}</span>
          </strong>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Hide lesson overview"
          onClick={() => useAppStore.getState().setOverviewOpen(false)}
        >
          ×
        </button>
      </header>
      <div className={styles.stage} ref={stageRef}>
        <canvas ref={canvasRef} className={styles.sheet} width={width} height={height} aria-hidden="true" />
      </div>
      <div className={styles.actions}>
        {end > 1 && (
          <>
            <Button variant="ghost" disabled={page <= 1} onClick={() => go(page - 1)}>
              Previous
            </Button>
            <Button variant="ghost" disabled={page >= end} onClick={() => go(page + 1)}>
              Next
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => useAppStore.getState().setOverviewOpen(false)}>
          Hide
        </Button>
      </div>
    </aside>
  )
}
