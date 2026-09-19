import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Annotation, DocumentProject, Point, TextAnnotation } from '@shared/types'
import { cssCursorForTool } from '../../cursors/toolCursors'
import { contrastInkFromCanvas } from '../../services/contrastInk'
import { registerPageSample, unregisterPageSample } from '../../services/pageCanvasRegistry'
import { renderNotePage, renderPdfPage } from '../../services/pdfRenderer'
import type { PageSample } from '../../services/adaptiveText'
import { AnnotationLayer } from './AnnotationLayer'
import { TextEditorOverlay } from './TextEditorOverlay'
import type { ToolId } from '@shared/types'
import styles from './PdfPage.module.css'

interface TextBox {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  project: DocumentProject
  pdf: PDFDocumentProxy | null
  page: number
  width: number
  active: boolean
  tool: ToolId
  priority?: number
}

export function PdfPage({ project, pdf, page, width, active, tool, priority = 1 }: Props) {
  const spec = project.pages.find((item) => item.page === page)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width, height: width * (792 / 612) })
  const [ready, setReady] = useState(spec?.source !== 'original')
  const [editing, setEditing] = useState<{ point: Point; existing?: TextAnnotation; box: TextBox } | null>(
    null
  )

  const pageSize = { width: spec?.width ?? 612, height: spec?.height ?? 792 }
  const height = width * (pageSize.height / pageSize.width)
  const source = spec?.source
  const originalPage = spec?.originalPage

  useEffect(() => {
    setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
  }, [width, height])

  useEffect(() => {
    if (!active || !canvasRef.current || !source) return
    let cancelled = false
    const canvas = canvasRef.current
    if (source === 'original' && canvas.dataset.rendered !== '1') setReady(false)
    const run = async () => {
      if (source === 'original') {
        if (!originalPage || !pdf) return
        const rendered = await renderPdfPage(pdf, originalPage, canvas, width, {
          priority,
          cacheId: `${project.id}:${originalPage}`
        })
        if (!cancelled) {
          setSize((current) =>
            current.width === rendered.width && current.height === rendered.height ? current : rendered
          )
          setReady(true)
        }
        return
      }
      renderNotePage(canvas, source, width, height)
      if (!cancelled) setReady(true)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [active, height, originalPage, pdf, priority, project.id, source, width])

  const pickContrastInk = useCallback(
    (box: TextBox) => contrastInkFromCanvas(canvasRef.current, box, size),
    [size]
  )

  const [sampleGen, setSampleGen] = useState(0)
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!ready || !canvas) return
    registerPageSample(project.id, page, canvas, size)
    setSampleGen((current) => current + 1)
    return () => unregisterPageSample(project.id, page, canvas)
  }, [page, project.id, ready, size])

  const pageSample = useMemo((): PageSample | null => {
    if (!ready || !canvasRef.current || sampleGen === 0) return null
    return { canvas: canvasRef.current, rendered: size }
  }, [ready, sampleGen, size])

  if (!spec) return null

  return (
    <article
      className={styles.page}
      style={{ width: size.width, height: size.height, cursor: cssCursorForTool(tool) }}
      aria-label={`Page ${page}`}
    >
      <canvas ref={canvasRef} className={`${styles.canvas} ${ready ? styles.canvasReady : ''}`} />
      {!ready && (
        <div className={styles.wait} aria-hidden="true">
          <span>Preparing this page…</span>
        </div>
      )}
      {active && ready && (
        <AnnotationLayer
          project={project}
          page={page}
          width={size.width}
          height={size.height}
          tool={tool}
          editingText={Boolean(editing)}
          pageSample={pageSample}
          pickContrastInk={pickContrastInk}
          onStartText={(point: Point, existing: Annotation | undefined, box: TextBox) => {
            setEditing({
              point,
              existing: existing?.type === 'text' ? existing : undefined,
              box
            })
          }}
        />
      )}
      {active && editing && (
        <div className={styles.editorLayer}>
          <TextEditorOverlay
            key={`${editing.existing?.id ?? 'new'}-${editing.box.x}-${editing.box.y}-${editing.box.width}-${editing.box.height}`}
            documentId={project.id}
            page={page}
            existing={editing.existing}
            box={editing.box}
            rendered={size}
            pageSize={pageSize}
            pageSample={pageSample}
            pickContrastInk={pickContrastInk}
            onClose={() => setEditing(null)}
          />
        </div>
      )}
    </article>
  )
}
