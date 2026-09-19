import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEFAULT_TEXT_SIZE_PT, TEXT_COLOR, TEXT_FONT_STACK } from '@shared/constants'
import { pdfLengthToScreen } from '@shared/coords'
import { textPadX, textPadY } from '@shared/textLayout'
import type { Size, TextAnnotation } from '@shared/types'
import { createId, nowIso } from '@shared/utils'
import { inkMapDataUrl, type PageSample } from '../../services/adaptiveText'
import { useDocumentStore } from '../../stores/documentStore'
import styles from './TextEditorOverlay.module.css'

interface TextBox {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  documentId: string
  page: number
  existing?: TextAnnotation
  box: TextBox
  rendered: Size
  pageSize: Size
  pageSample: PageSample | null
  pickContrastInk: (box: TextBox) => string
  onClose: () => void
}

export function TextEditorOverlay({
  documentId,
  page,
  existing,
  box,
  rendered,
  pageSize,
  pageSample,
  pickContrastInk,
  onClose
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const armedRef = useRef(false)
  const applyAdd = useDocumentStore((state) => state.applyAdd)
  const applyModify = useDocumentStore((state) => state.applyModify)
  const [inkUrl, setInkUrl] = useState<string | null>(null)

  const area = {
    x: existing?.x ?? box.x,
    y: existing?.y ?? box.y,
    width: existing?.width ?? box.width,
    height: existing?.height ?? box.height
  }

  const ink = pickContrastInk(area)

  useEffect(() => {
    armedRef.current = false
    const arm = window.setTimeout(() => {
      armedRef.current = true
      textareaRef.current?.focus()
    }, 60)
    return () => window.clearTimeout(arm)
  }, [existing, area.x, area.y, area.width, area.height])

  const left = area.x * rendered.width
  const top = area.y * rendered.height
  const width = Math.max(72, area.width * rendered.width)
  const height = Math.max(28, area.height * rendered.height)
  const fontSize = pdfLengthToScreen(existing?.fontSize ?? DEFAULT_TEXT_SIZE_PT, pageSize, rendered)
  const padX = textPadX(fontSize)
  const padY = textPadY(fontSize)

  useLayoutEffect(() => {
    const node = textareaRef.current
    if (!node || !pageSample) {
      setInkUrl(null)
      return
    }

    const paint = () => {
      const widthPx = node.offsetWidth
      const heightPx = node.offsetHeight
      const dpr = window.devicePixelRatio || 1
      const nextBox = {
        x: area.x,
        y: area.y,
        width: widthPx / rendered.width,
        height: heightPx / rendered.height
      }
      setInkUrl(inkMapDataUrl(pageSample, nextBox, widthPx * dpr, heightPx * dpr))
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(node)
    return () => observer.disconnect()
  }, [area.x, area.y, pageSample, rendered.height, rendered.width])

  const commit = () => {
    if (!armedRef.current) return
    const value = textareaRef.current?.value ?? ''
    const widthPx = textareaRef.current?.offsetWidth ?? width
    const heightPx = textareaRef.current?.offsetHeight ?? height
    armedRef.current = false
    onClose()
    if (!value.trim()) return
    const nextBox = {
      x: area.x,
      y: area.y,
      width: widthPx / rendered.width,
      height: heightPx / rendered.height
    }
    const annotation: TextAnnotation = {
      id: existing?.id ?? createId(),
      type: 'text',
      page,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      style: {
        ...(existing?.style ?? { color: TEXT_COLOR, width: DEFAULT_TEXT_SIZE_PT, opacity: 1 }),
        color: pickContrastInk(nextBox)
      },
      x: nextBox.x,
      y: nextBox.y,
      width: nextBox.width,
      height: nextBox.height,
      text: value,
      fontSize: existing?.fontSize ?? DEFAULT_TEXT_SIZE_PT
    }
    if (existing) applyModify(documentId, existing, annotation)
    else applyAdd(documentId, annotation)
  }

  return (
    <textarea
      ref={textareaRef}
      className={`${styles.editor}${inkUrl ? ` ${styles.adaptive}` : ''}`}
      defaultValue={existing?.text ?? ''}
      aria-label="Type on the worksheet"
      style={{
        left,
        top,
        width,
        height,
        fontSize,
        padding: `${padY}px ${padX}px`,
        fontFamily: TEXT_FONT_STACK,
        color: inkUrl ? 'transparent' : ink,
        caretColor: ink,
        backgroundImage: inkUrl ? `url(${inkUrl})` : undefined
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          armedRef.current = false
          onClose()
        }
      }}
    />
  )
}
