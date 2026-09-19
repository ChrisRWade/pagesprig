import { useLayoutEffect, useRef } from 'react'
import type Konva from 'konva'
import { Image as KonvaImage, Text as KonvaText } from 'react-konva'
import { DEFAULT_TEXT_SIZE_PT, TEXT_FONT_STACK, TEXT_LINE_HEIGHT } from '@shared/constants'
import { pdfLengthToScreen } from '@shared/coords'
import type { Size, TextAnnotation } from '@shared/types'
import {
  rasterizeAdaptiveTextInto,
  samplePageRegion,
  textFontIsReady,
  waitForTextFont,
  type PageSample
} from '../../services/adaptiveText'

interface Props {
  annotation: TextAnnotation
  rendered: Size
  pageSize: Size
  pageSample: PageSample | null
  color: string
  opacity: number
  halo?: boolean
  haloColor?: string
  haloWidth?: number
}

export function AdaptiveText({
  annotation,
  rendered,
  pageSize,
  pageSample,
  color,
  opacity,
  halo = false,
  haloColor,
  haloWidth = 3.2
}: Props) {
  const nodeRef = useRef<Konva.Image>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const x = annotation.x * rendered.width
  const y = annotation.y * rendered.height
  const width = Math.max(1, annotation.width * rendered.width)
  const height = Math.max(1, annotation.height * rendered.height)
  const fontSize = pdfLengthToScreen(annotation.fontSize || DEFAULT_TEXT_SIZE_PT, pageSize, rendered)
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1

  useLayoutEffect(() => {
    if (!pageSample || !annotation.text) return
    let cancelled = false
    const canvas = canvasRef.current ?? document.createElement('canvas')
    canvasRef.current = canvas
    const pixelW = Math.max(1, Math.round(width * dpr))
    const pixelH = Math.max(1, Math.round(height * dpr))
    const fontSizePx = fontSize * dpr
    const box = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height
    }

    const paint = () => {
      if (cancelled) return
      const background = samplePageRegion(pageSample, box, pixelW, pixelH)
      rasterizeAdaptiveTextInto(canvas, annotation.text, fontSizePx, pixelW, pixelH, background)
      const node = nodeRef.current
      if (!node) return
      node.image(canvas)
      node.getLayer()?.batchDraw()
    }

    if (textFontIsReady(fontSizePx)) paint()
    else void waitForTextFont(fontSizePx).then(paint)
    return () => {
      cancelled = true
    }
  }, [
    annotation.height,
    annotation.text,
    annotation.width,
    annotation.x,
    annotation.y,
    dpr,
    fontSize,
    height,
    pageSample,
    width
  ])

  if (!pageSample || !annotation.text) {
    return (
      <KonvaText
        x={x}
        y={y}
        width={width}
        height={height}
        text={annotation.text}
        fill={color}
        stroke={halo ? haloColor ?? color : undefined}
        strokeWidth={halo ? haloWidth : 0}
        fillAfterStrokeEnabled={halo}
        opacity={opacity}
        fontSize={fontSize}
        fontFamily={TEXT_FONT_STACK}
        lineHeight={TEXT_LINE_HEIGHT}
        wrap="word"
        listening={false}
      />
    )
  }

  return (
    <KonvaImage
      ref={nodeRef}
      x={x}
      y={y}
      width={width}
      height={height}
      opacity={opacity}
      listening={false}
      image={canvasRef.current ?? undefined}
      imageSmoothingEnabled={false}
      shadowEnabled={halo}
      shadowColor={halo ? haloColor : undefined}
      shadowBlur={halo ? 8 : 0}
      shadowOpacity={halo ? 0.95 : 0}
      perfectDrawEnabled={false}
    />
  )
}
