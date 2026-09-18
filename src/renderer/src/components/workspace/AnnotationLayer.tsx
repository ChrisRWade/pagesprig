import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Arrow, Ellipse, Group, Layer, Line, Rect, Stage, Text as KonvaText } from 'react-konva'
import {
  DEFAULT_HIGHLIGHT_WIDTH_PT,
  DEFAULT_PENCIL_WIDTH_PT,
  DEFAULT_SHAPE_WIDTH_PT,
  DEFAULT_TEXT_SIZE_PT,
  HIGHLIGHT_OPACITY,
  MARK_SIZE_PRESETS,
  markStrokeFactor,
  SHAPE_COLOR,
  TEXT_COLOR
} from '@shared/constants'
import { pdfLengthToScreen, screenToNormalized } from '@shared/coords'
import { annotationsForPage } from '@shared/serialize'
import { simplifyStroke } from '@shared/simplify'
import type { Annotation, DocumentProject, Point, Size, ToolId } from '@shared/types'
import { annotationBounds, createId, hitTestAnnotation, moveAnnotation, nowIso } from '@shared/utils'
import { cssCursorForTool } from '../../cursors/toolCursors'
import { useDocumentStore } from '../../stores/documentStore'
import { useAppStore } from '../../stores/appStore'

const SELECT_HOVER = '#3D7AB5'
const ERASE_HOVER = '#D24A38'
const ERASE_HIT = 0.024

function topHit(annotations: Annotation[], point: Point, threshold?: number) {
  return [...annotations].reverse().find((item) => hitTestAnnotation(item, point, threshold))
}

function hitsAt(annotations: Annotation[], point: Point, threshold: number) {
  return annotations.filter((item) => hitTestAnnotation(item, point, threshold))
}

function sameIds(current: string[], next: string[]) {
  if (current.length !== next.length) return false
  if (current.length <= 1) return current[0] === next[0]
  const seen = new Set(current)
  return next.every((id) => seen.has(id))
}

interface TextBox {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  project: DocumentProject
  page: number
  width: number
  height: number
  tool: ToolId
  editingText: boolean
  onStartText: (point: Point, existing: Annotation | undefined, box: TextBox) => void
}

function styleWidth(annotation: Annotation, pageSize: Size, rendered: Size): number {
  return pdfLengthToScreen(annotation.style.width, pageSize, rendered)
}

function pointsToFlat(points: Point[], rendered: Size): number[] {
  return points.flatMap((point) => [point.x * rendered.width, point.y * rendered.height])
}

function toNormalized(event: ReactPointerEvent<HTMLDivElement> | { clientX: number; clientY: number }, el: HTMLDivElement): Point {
  const rect = el.getBoundingClientRect()
  return screenToNormalized(event.clientX - rect.left, event.clientY - rect.top, {
    width: rect.width,
    height: rect.height
  })
}

export function AnnotationLayer({ project, page, width, height, tool, editingText, onStartText }: Props) {
  const pageSpec = project.pages.find((item) => item.page === page)
  const pageSize = { width: pageSpec?.width ?? 612, height: pageSpec?.height ?? 792 }
  const rendered = useMemo(() => ({ width, height }), [width, height])
  const annotations = annotationsForPage(project, page)
  const selectedId = useDocumentStore((state) =>
    state.activeId ? state.open[state.activeId]?.selectedAnnotationId ?? null : null
  )
  const applyAdd = useDocumentStore((state) => state.applyAdd)
  const applyDeleteMany = useDocumentStore((state) => state.applyDeleteMany)
  const applyModify = useDocumentStore((state) => state.applyModify)
  const setSelected = useDocumentStore((state) => state.setSelected)
  const toolColors = useAppStore((state) => state.toolColors)

  const hostRef = useRef<HTMLDivElement>(null)
  const [livePoints, setLivePoints] = useState<Point[]>([])
  const [preview, setPreview] = useState<Annotation | null>(null)
  const [selectMode, setSelectMode] = useState<'idle' | 'over' | 'drag'>('idle')
  const [emphasizedIds, setEmphasizedIds] = useState<string[]>([])
  const dragRef = useRef<{ annotation: Annotation; origin: Point } | null>(null)
  const eraseRef = useRef<Set<string>>(new Set())
  const drawing = useRef(false)
  const textPointRef = useRef<Point | null>(null)

  useEffect(() => {
    const onUp = () => {
      drawing.current = false
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [])

  useEffect(() => {
    setSelectMode('idle')
    setEmphasizedIds([])
  }, [tool])

  if (width <= 0 || height <= 0) return null

  const rememberIds = (next: string[]) => {
    setEmphasizedIds((current) => (sameIds(current, next) ? current : next))
  }

  const commitStroke = (type: 'stroke' | 'highlight', points: Point[]) => {
    if (points.length < 2) return
    const simplified = simplifyStroke(points).map((point) => ({
      ...point,
      x: Math.min(1, Math.max(0, point.x)),
      y: Math.min(1, Math.max(0, point.y))
    }))
    applyAdd(project.id, {
      id: createId(),
      type,
      page,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      style: {
        color: type === 'highlight' ? toolColors.highlighter : toolColors.pencil,
        width: type === 'highlight' ? DEFAULT_HIGHLIGHT_WIDTH_PT : DEFAULT_PENCIL_WIDTH_PT,
        opacity: type === 'highlight' ? HIGHLIGHT_OPACITY : 1
      },
      points: simplified
    })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hostRef.current || event.button !== 0) return
    const point = toNormalized(event, hostRef.current)

    if (tool === 'checkmark' || tool === 'xmark') {
      const size = MARK_SIZE_PRESETS[useAppStore.getState().markSize]
      applyAdd(project.id, {
        id: createId(),
        type: tool,
        page,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        style: { color: SHAPE_COLOR, width: DEFAULT_SHAPE_WIDTH_PT, opacity: 1 },
        x: point.x - size / 2,
        y: point.y - size / 2,
        size
      })
      return
    }

    if (tool === 'text') {
      textPointRef.current = point
      drawing.current = true
      hostRef.current.setPointerCapture(event.pointerId)
      dragRef.current = {
        annotation: {
          id: 'preview',
          type: 'rect',
          page,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          style: { color: SHAPE_COLOR, width: 1, opacity: 0.9 },
          x: point.x,
          y: point.y,
          width: 0.001,
          height: 0.001
        },
        origin: point
      }
      setPreview(dragRef.current.annotation)
      return
    }

    if (tool === 'select') {
      const hit = topHit(annotations, point)
      if (event.detail >= 2 && hit?.type === 'text') {
        drawing.current = false
        dragRef.current = null
        setPreview(null)
        rememberIds([])
        setSelected(project.id, hit.id)
        onStartText(point, hit, { x: hit.x, y: hit.y, width: hit.width, height: hit.height })
        return
      }
      hostRef.current.setPointerCapture(event.pointerId)
      drawing.current = true
      setSelected(project.id, hit?.id ?? null)
      setSelectMode(hit ? 'drag' : 'idle')
      rememberIds(hit ? [hit.id] : [])
      if (hit) dragRef.current = { annotation: hit, origin: point }
      return
    }

    hostRef.current.setPointerCapture(event.pointerId)
    drawing.current = true

    if (tool === 'eraser') {
      eraseRef.current = new Set()
      const hit = hitsAt(annotations, point, ERASE_HIT)
      hit.forEach((item) => eraseRef.current.add(item.id))
      rememberIds([...eraseRef.current])
      return
    }

    if (tool === 'pencil' || tool === 'highlighter') {
      setLivePoints([point])
      return
    }

    if (tool === 'line' || tool === 'arrow' || tool === 'rect' || tool === 'ellipse') {
      const base = {
        id: 'preview',
        page,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        style: { color: toolColors[tool], width: DEFAULT_SHAPE_WIDTH_PT, opacity: 1 }
      }
      if (tool === 'line' || tool === 'arrow') {
        setPreview({ ...base, type: tool, x1: point.x, y1: point.y, x2: point.x, y2: point.y })
      } else {
        setPreview({ ...base, type: tool, x: point.x, y: point.y, width: 0.001, height: 0.001 })
      }
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hostRef.current) return
    const point = toNormalized(event, hostRef.current)

    if (tool === 'select') {
      if (!drawing.current) {
        const hit = topHit(annotations, point)
        setSelectMode((mode) => {
          const next = hit ? 'over' : 'idle'
          return mode === next ? mode : next
        })
        rememberIds(hit ? [hit.id] : [])
      }
      if (drawing.current && dragRef.current) {
        const dx = point.x - dragRef.current.origin.x
        const dy = point.y - dragRef.current.origin.y
        setPreview(moveAnnotation(dragRef.current.annotation, dx, dy))
      }
      return
    }

    if (tool === 'eraser') {
      if (drawing.current) {
        hitsAt(annotations, point, ERASE_HIT).forEach((item) => eraseRef.current.add(item.id))
        rememberIds([...eraseRef.current])
      } else {
        rememberIds(hitsAt(annotations, point, ERASE_HIT).map((item) => item.id))
      }
      return
    }

    if (!drawing.current) return

    if (tool === 'pencil' || tool === 'highlighter') {
      setLivePoints((current) => {
        const last = current[current.length - 1]
        if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.0015) return current
        return [...current, { ...point, p: event.pressure || undefined }]
      })
      return
    }

    if (preview && (preview.type === 'line' || preview.type === 'arrow')) {
      setPreview({ ...preview, x2: point.x, y2: point.y })
    } else if (preview && (preview.type === 'rect' || preview.type === 'ellipse')) {
      const start = dragRef.current?.origin ?? { x: preview.x, y: preview.y }
      if (!dragRef.current) dragRef.current = { annotation: preview, origin: { x: preview.x, y: preview.y } }
      setPreview({
        ...preview,
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y)
      })
    }
  }

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (tool !== 'select' || !hostRef.current) return
    const point = toNormalized(event, hostRef.current)
    const hit = topHit(annotations, point)
    if (hit?.type !== 'text') return
    drawing.current = false
    dragRef.current = null
    setPreview(null)
    setSelectMode('idle')
    rememberIds([])
    setSelected(project.id, hit.id)
    onStartText(point, hit, { x: hit.x, y: hit.y, width: hit.width, height: hit.height })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hostRef.current) return
    const point = toNormalized(event, hostRef.current)
    drawing.current = false

    if (tool === 'text' && textPointRef.current) {
      const start = textPointRef.current
      textPointRef.current = null
      dragRef.current = null
      setPreview(null)
      const dragged = Math.hypot(point.x - start.x, point.y - start.y) > 0.012
      const existingHit = !dragged
        ? [...annotations].reverse().find((item) => item.type === 'text' && hitTestAnnotation(item, start))
        : undefined
      const existing = existingHit?.type === 'text' ? existingHit : undefined
      const box = dragged
        ? {
            x: Math.min(start.x, point.x),
            y: Math.min(start.y, point.y),
            width: Math.max(Math.abs(point.x - start.x), 0.08),
            height: Math.max(Math.abs(point.y - start.y), 0.04)
          }
        : existing
          ? { x: existing.x, y: existing.y, width: existing.width, height: existing.height }
          : { x: start.x, y: start.y, width: 0.32, height: 0.1 }
      onStartText(start, existing, box)
      return
    }

    if (tool === 'select' && dragRef.current) {
      const dx = point.x - dragRef.current.origin.x
      const dy = point.y - dragRef.current.origin.y
      if (Math.hypot(dx, dy) > 0.002) {
        applyModify(project.id, dragRef.current.annotation, moveAnnotation(dragRef.current.annotation, dx, dy))
      }
      dragRef.current = null
      setPreview(null)
      const still = topHit(annotations, point)
      setSelectMode(still ? 'over' : 'idle')
      rememberIds(still ? [still.id] : [])
      return
    }

    if (tool === 'eraser') {
      const removed = annotations.filter((item) => eraseRef.current.has(item.id))
      applyDeleteMany(project.id, removed)
      eraseRef.current = new Set()
      rememberIds(hitsAt(annotations, point, ERASE_HIT).filter((item) => !removed.includes(item)).map((item) => item.id))
      return
    }

    if (tool === 'pencil' || tool === 'highlighter') {
      commitStroke(tool === 'highlighter' ? 'highlight' : 'stroke', livePoints)
      setLivePoints([])
      return
    }

    if (preview && preview.id === 'preview') {
      const next = { ...preview, id: createId() }
      if (
        (next.type === 'rect' || next.type === 'ellipse') &&
        (next.width < 0.008 || next.height < 0.008)
      ) {
        setPreview(null)
        dragRef.current = null
        return
      }
      applyAdd(project.id, next)
      setPreview(null)
      dragRef.current = null
    }
  }

  const shown = preview && preview.id !== 'preview'
    ? annotations.map((item) => (item.id === preview.id ? preview : item))
    : annotations

  return (
    <div
      ref={hostRef}
      className="annotation-host"
      style={{
        position: 'absolute',
        inset: 0,
        touchAction: 'none',
        overflow: 'hidden',
        pointerEvents: editingText ? 'none' : 'auto',
        cursor:
          tool === 'select' && selectMode === 'drag'
            ? 'grabbing'
            : tool === 'select' && selectMode === 'over'
              ? 'grab'
              : cssCursorForTool(tool)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        if (drawing.current) return
        setSelectMode((mode) => (mode === 'drag' ? mode : 'idle'))
        rememberIds([])
      }}
      onDoubleClick={onDoubleClick}
    >
      <Stage width={width} height={height} listening={false}>
        <Layer listening={false} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
          {shown
            .filter((annotation) => !(editingText && annotation.id === selectedId && annotation.type === 'text'))
            .map((annotation) => (
            <DrawnAnnotation
              key={annotation.id}
              annotation={annotation}
              rendered={rendered}
              pageSize={pageSize}
              selected={annotation.id === selectedId}
              emphasis={
                emphasizedIds.includes(annotation.id)
                  ? tool === 'eraser'
                    ? 'erase'
                    : 'select'
                  : 'none'
              }
            />
          ))}
          {preview && preview.id === 'preview' && (
            <DrawnAnnotation
              annotation={preview}
              rendered={rendered}
              pageSize={pageSize}
              selected={false}
              emphasis="none"
            />
          )}
          {livePoints.length > 1 && (
            <Line
              points={pointsToFlat(livePoints, rendered)}
              stroke={tool === 'highlighter' ? toolColors.highlighter : toolColors.pencil}
              opacity={tool === 'highlighter' ? HIGHLIGHT_OPACITY : 1}
              strokeWidth={pdfLengthToScreen(
                tool === 'highlighter' ? DEFAULT_HIGHLIGHT_WIDTH_PT : DEFAULT_PENCIL_WIDTH_PT,
                pageSize,
                rendered
              )}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}

function DrawnAnnotation({
  annotation,
  rendered,
  pageSize,
  selected,
  emphasis
}: {
  annotation: Annotation
  rendered: Size
  pageSize: Size
  selected: boolean
  emphasis: 'none' | 'select' | 'erase'
}) {
  const strokeWidth = styleWidth(annotation, pageSize, rendered)
  const markStroke =
    annotation.type === 'checkmark' || annotation.type === 'xmark'
      ? Math.max(strokeWidth * markStrokeFactor(annotation.size), 1.8)
      : strokeWidth
  const bounds = annotationBounds(annotation)
  const boxX = Math.max(0, bounds.x * rendered.width - 4)
  const boxY = Math.max(0, bounds.y * rendered.height - 4)
  const boxRight = Math.min(rendered.width, (bounds.x + bounds.width) * rendered.width + 4)
  const boxBottom = Math.min(rendered.height, (bounds.y + bounds.height) * rendered.height + 4)
  const selectBox = selected ? (
    <Rect
      x={boxX}
      y={boxY}
      width={Math.max(2, boxRight - boxX)}
      height={Math.max(2, boxBottom - boxY)}
      stroke="#1f4e79"
      dash={[5, 4]}
      strokeWidth={1}
      listening={false}
    />
  ) : null

  const haloWidth =
    annotation.type === 'highlight'
      ? markStroke + 5
      : annotation.type === 'text'
        ? 3.2
        : Math.max(markStroke + 3.4, 5.5)
  const haloColor = emphasis === 'erase' ? ERASE_HOVER : SELECT_HOVER

  return (
    <Group>
      {emphasis !== 'none' && (
        <AnnotationBody
          annotation={annotation}
          rendered={rendered}
          pageSize={pageSize}
          color={haloColor}
          opacity={emphasis === 'erase' ? 0.88 : 0.8}
          strokeWidth={haloWidth}
          textHalo
        />
      )}
      <AnnotationBody
        annotation={annotation}
        rendered={rendered}
        pageSize={pageSize}
        color={annotation.style.color || TEXT_COLOR}
        opacity={annotation.style.opacity}
        strokeWidth={markStroke}
      />
      {selectBox}
    </Group>
  )
}

function AnnotationBody({
  annotation,
  rendered,
  pageSize,
  color,
  opacity,
  strokeWidth,
  textHalo = false
}: {
  annotation: Annotation
  rendered: Size
  pageSize: Size
  color: string
  opacity: number
  strokeWidth: number
  textHalo?: boolean
}) {
  switch (annotation.type) {
    case 'stroke':
    case 'highlight':
      return (
        <Line
          points={pointsToFlat(annotation.points, rendered)}
          stroke={color}
          opacity={opacity}
          strokeWidth={strokeWidth}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )
    case 'line':
      return (
        <Line
          points={[
            annotation.x1 * rendered.width,
            annotation.y1 * rendered.height,
            annotation.x2 * rendered.width,
            annotation.y2 * rendered.height
          ]}
          stroke={color}
          opacity={opacity}
          strokeWidth={strokeWidth}
          lineCap="round"
          listening={false}
        />
      )
    case 'arrow':
      return (
        <Arrow
          points={[
            annotation.x1 * rendered.width,
            annotation.y1 * rendered.height,
            annotation.x2 * rendered.width,
            annotation.y2 * rendered.height
          ]}
          stroke={color}
          fill={color}
          opacity={opacity}
          strokeWidth={strokeWidth}
          pointerLength={14}
          pointerWidth={12}
          listening={false}
        />
      )
    case 'rect':
      return (
        <Rect
          x={annotation.x * rendered.width}
          y={annotation.y * rendered.height}
          width={annotation.width * rendered.width}
          height={annotation.height * rendered.height}
          stroke={color}
          opacity={opacity}
          strokeWidth={strokeWidth}
          listening={false}
        />
      )
    case 'ellipse':
      return (
        <Ellipse
          x={(annotation.x + annotation.width / 2) * rendered.width}
          y={(annotation.y + annotation.height / 2) * rendered.height}
          radiusX={(annotation.width / 2) * rendered.width}
          radiusY={(annotation.height / 2) * rendered.height}
          stroke={color}
          opacity={opacity}
          strokeWidth={strokeWidth}
          listening={false}
        />
      )
    case 'checkmark': {
      const x = annotation.x * rendered.width
      const y = annotation.y * rendered.height
      const size = annotation.size * rendered.width
      return (
        <Line
          points={[x, y + size * 0.55, x + size * 0.32, y + size, x + size, y]}
          stroke={color}
          opacity={opacity}
          strokeWidth={strokeWidth}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )
    }
    case 'xmark': {
      const x = annotation.x * rendered.width
      const y = annotation.y * rendered.height
      const size = annotation.size * rendered.width
      return (
        <Group>
          <Line
            points={[x, y, x + size, y + size]}
            stroke={color}
            opacity={opacity}
            strokeWidth={strokeWidth}
            lineCap="round"
            listening={false}
          />
          <Line
            points={[x + size, y, x, y + size]}
            stroke={color}
            opacity={opacity}
            strokeWidth={strokeWidth}
            lineCap="round"
            listening={false}
          />
        </Group>
      )
    }
    case 'text':
      return (
        <KonvaText
          x={annotation.x * rendered.width}
          y={annotation.y * rendered.height}
          width={annotation.width * rendered.width}
          height={annotation.height * rendered.height}
          text={annotation.text}
          fill={color}
          stroke={textHalo ? color : undefined}
          strokeWidth={textHalo ? strokeWidth : 0}
          fillAfterStrokeEnabled={textHalo}
          opacity={opacity}
          fontSize={pdfLengthToScreen(annotation.fontSize || DEFAULT_TEXT_SIZE_PT, pageSize, rendered)}
          fontFamily="Atkinson Hyperlegible, Segoe UI, sans-serif"
          wrap="word"
          listening={false}
        />
      )
  }
}
