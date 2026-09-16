import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Annotation, DocumentProject, Point, TextAnnotation } from '@shared/types'
import { renderNotePage, renderPdfPage } from '../../services/pdfRenderer'
import { AnnotationLayer } from './AnnotationLayer'
import { TextEditorOverlay } from './TextEditorOverlay'
import type { ToolId } from '@shared/types'
import styles from './PdfPage.module.css'

interface Props {
  project: DocumentProject
  pdf: PDFDocumentProxy | null
  page: number
  width: number
  active: boolean
  tool: ToolId
}

export function PdfPage({ project, pdf, page, width, active, tool }: Props) {
  const spec = project.pages.find((item) => item.page === page)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width, height: width * (792 / 612) })
  const [editing, setEditing] = useState<{ point: Point; existing?: TextAnnotation } | null>(null)

  const pageSize = { width: spec?.width ?? 612, height: spec?.height ?? 792 }
  const height = width * (pageSize.height / pageSize.width)

  useEffect(() => {
    setSize({ width, height })
  }, [width, height])

  useEffect(() => {
    if (!active || !canvasRef.current || !spec) return
    let cancelled = false
    const canvas = canvasRef.current
    const run = async () => {
      if (spec.source === 'original' && spec.originalPage && pdf) {
        const rendered = await renderPdfPage(pdf, spec.originalPage, canvas, width)
        if (!cancelled) setSize(rendered)
      } else {
        renderNotePage(canvas, spec.source, width, height)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [active, pdf, spec, width, height])

  if (!spec) return null

  return (
    <article className={styles.page} style={{ width: size.width, height: size.height }} aria-label={`Page ${page}`}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {active && (
        <AnnotationLayer
          project={project}
          page={page}
          width={size.width}
          height={size.height}
          tool={tool}
          onStartText={(point: Point, existing?: Annotation) => {
            setEditing({
              point,
              existing: existing?.type === 'text' ? existing : undefined
            })
          }}
        />
      )}
      {active && editing && (
        <TextEditorOverlay
          documentId={project.id}
          page={page}
          point={editing.point}
          existing={editing.existing}
          rendered={size}
          pageSize={pageSize}
          onClose={() => setEditing(null)}
        />
      )}
    </article>
  )
}
