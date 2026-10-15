import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { DocumentProject } from '@shared/types'
import { loadPdfDocument } from '../../services/pdfRenderer'
import { PdfPage } from '../workspace/PdfPage'
import styles from './ReviewScreen.module.css'

interface Props {
  project: DocumentProject
  pages: number[]
}

export function ReviewReader({ project, pages }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [width, setWidth] = useState(720)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPdf(null)
    setError(null)
    void loadPdfDocument(project.id, project.sourcePdfPath)
      .then((doc) => {
        if (!cancelled) setPdf(doc)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'That worksheet could not be opened.')
      })
    return () => {
      cancelled = true
    }
  }, [project.id, project.sourcePdfPath])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const update = () => setWidth(Math.max(320, el.clientWidth - 64))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [project.id])

  return (
    <div className={styles.reader} ref={scrollerRef}>
      {error ? <p className={styles.none}>{error}</p> : null}
      {pages.map((page) => (
        <PdfPage
          key={`${project.id}-${page}`}
          project={project}
          pdf={pdf}
          page={page}
          width={width}
          active
          tool="select"
          priority={0}
        />
      ))}
    </div>
  )
}
