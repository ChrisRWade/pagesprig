import { useEffect, useMemo, useRef, useState } from 'react'
import { VIRTUALIZATION_BUFFER } from '@shared/constants'
import type { DocumentProject } from '@shared/types'
import { loadPdfDocument } from '../../services/pdfRenderer'
import { useAppStore } from '../../stores/appStore'
import { PdfPage } from './PdfPage'
import styles from './PdfViewer.module.css'

interface Props {
  project: DocumentProject
  pdfBytes: ArrayBuffer | null
}

export function PdfViewer({ project, pdfBytes }: Props) {
  const zoom = useAppStore((state) => state.zoom)
  const tool = useAppStore((state) => state.tool)
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)
  const setError = useAppStore((state) => state.setError)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null)
  const [viewport, setViewport] = useState({ start: 1, end: 3, width: 720 })

  useEffect(() => {
    if (!pdfBytes) return
    let cancelled = false
    void loadPdfDocument(project.id, pdfBytes)
      .then((doc) => {
        if (!cancelled) setPdf(doc)
      })
      .catch((error: Error) => setError(error.message))
    return () => {
      cancelled = true
    }
  }, [pdfBytes, project.id, setError])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const update = () => {
      const width = Math.max(360, (el.clientWidth - 72) * zoom)
      const pageHeights = project.pages.map((page) => width * (page.height / page.width) + 28)
      let offset = 0
      let start = 1
      let end = project.pages.length
      const top = el.scrollTop
      const bottom = top + el.clientHeight
      for (let i = 0; i < pageHeights.length; i += 1) {
        const next = offset + pageHeights[i]
        if (next < top) start = i + 2
        if (offset <= bottom) end = i + 1
        offset = next
      }
      setViewport({
        start: Math.max(1, start - VIRTUALIZATION_BUFFER),
        end: Math.min(project.pages.length, end + VIRTUALIZATION_BUFFER),
        width
      })
      setCurrentPage(Math.min(project.pages.length, Math.max(1, start)))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [project.pages, setCurrentPage, zoom])

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      if (event.deltaY < 0) useAppStore.getState().zoomIn()
      else useAppStore.getState().zoomOut()
    }
  }

  const placeholders = useMemo(
    () =>
      project.pages.map((page) => ({
        page: page.page,
        height: viewport.width * (page.height / page.width)
      })),
    [project.pages, viewport.width]
  )

  return (
    <div className={styles.scroller} ref={scrollerRef} onWheel={onWheel} tabIndex={0} aria-label="Worksheet pages">
      {placeholders.map((item) => {
        const active = item.page >= viewport.start && item.page <= viewport.end
        return (
          <div key={item.page} style={{ minHeight: item.height + 28 }}>
            {active ? (
              <PdfPage
                project={project}
                pdf={pdf}
                page={item.page}
                width={viewport.width}
                active
                tool={tool}
              />
            ) : (
              <div className={styles.placeholder} style={{ width: viewport.width, height: item.height }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
