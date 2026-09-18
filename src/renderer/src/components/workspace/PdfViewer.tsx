import { useEffect, useMemo, useRef, useState } from 'react'
import { VIRTUALIZATION_BUFFER } from '@shared/constants'
import type { DocumentProject, PageSpec } from '@shared/types'
import { loadPdfDocument } from '../../services/pdfRenderer'
import { useAppStore } from '../../stores/appStore'
import { PdfPage } from './PdfPage'
import styles from './PdfViewer.module.css'

interface Props {
  project: DocumentProject
}

function pageHeight(page: PageSpec, width: number): number {
  return width * (page.height / page.width) + 28
}

function pageOffset(pages: PageSpec[], width: number, pageNumber: number): number {
  let offset = 0
  for (const page of pages) {
    if (page.page >= pageNumber) break
    offset += pageHeight(page, width)
  }
  return offset
}

function pageAtScroll(pages: PageSpec[], width: number, scrollTop: number): number {
  if (pages.length === 0) return 1
  const y = Math.max(0, scrollTop + 16)
  let offset = 0
  for (const page of pages) {
    offset += pageHeight(page, width)
    if (y < offset) return page.page
  }
  return pages[pages.length - 1].page
}

export function PdfViewer({ project }: Props) {
  const zoom = useAppStore((state) => state.zoom)
  const tool = useAppStore((state) => state.tool)
  const requestedPage = useAppStore((state) => state.requestedPage)
  const currentPage = useAppStore((state) => state.currentPage)
  const setCurrentPage = useAppStore((state) => state.setCurrentPage)
  const clearRequestedPage = useAppStore((state) => state.clearRequestedPage)
  const setError = useAppStore((state) => state.setError)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const travelingRef = useRef(false)
  const navGen = useRef(0)
  const [pdf, setPdf] = useState<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null)
  const [viewport, setViewport] = useState({ start: 1, end: 3, width: 720 })

  useEffect(() => {
    let cancelled = false
    void loadPdfDocument(project.id, project.sourcePdfPath)
      .then((doc) => {
        if (!cancelled) setPdf(doc)
      })
      .catch((error: Error) => {
        if (!cancelled) setError(error.message)
      })
    return () => {
      cancelled = true
    }
  }, [project.id, project.sourcePdfPath, setError])

  useEffect(() => {
    travelingRef.current = false
    navGen.current += 1
  }, [project.id])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const update = () => {
      const width = Math.max(360, (el.clientWidth - 72) * zoom)
      const pageHeights = project.pages.map((page) => pageHeight(page, width))
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
      setViewport((current) => {
        const nextViewport = {
          start: Math.max(1, start - VIRTUALIZATION_BUFFER),
          end: Math.min(project.pages.length, end + VIRTUALIZATION_BUFFER),
          width
        }
        if (
          current.start === nextViewport.start &&
          current.end === nextViewport.end &&
          current.width === nextViewport.width
        ) {
          return current
        }
        return nextViewport
      })
      if (!travelingRef.current) {
        setCurrentPage(pageAtScroll(project.pages, width, el.scrollTop))
      }
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

  useEffect(() => {
    const el = scrollerRef.current
    if (!requestedPage || !el) return
    const width = Math.max(360, (el.clientWidth - 72) * zoom)
    const top = pageOffset(project.pages, width, requestedPage)
    if (Math.abs(el.scrollTop - top) < 4) {
      travelingRef.current = false
      clearRequestedPage()
      setCurrentPage(requestedPage)
      return
    }
    const gen = (navGen.current += 1)
    travelingRef.current = true
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
    clearRequestedPage()

    const finish = () => {
      if (gen !== navGen.current) return
      travelingRef.current = false
      setCurrentPage(pageAtScroll(project.pages, width, el.scrollTop))
    }
    el.addEventListener('scrollend', finish, { once: true })
    const timer = window.setTimeout(finish, reduced ? 0 : 500)
    return () => {
      el.removeEventListener('scrollend', finish)
      window.clearTimeout(timer)
    }
  }, [clearRequestedPage, project.pages, requestedPage, setCurrentPage, zoom])

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
                priority={item.page === currentPage ? 0 : 1}
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
