import { useEffect, useRef } from 'react'
import { DEFAULT_TEXT_SIZE_PT, TEXT_COLOR } from '@shared/constants'
import { pdfLengthToScreen } from '@shared/coords'
import type { Size, TextAnnotation } from '@shared/types'
import { createId, nowIso } from '@shared/utils'
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
  onClose: () => void
}

export function TextEditorOverlay({ documentId, page, existing, box, rendered, pageSize, onClose }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const armedRef = useRef(false)
  const applyAdd = useDocumentStore((state) => state.applyAdd)
  const applyModify = useDocumentStore((state) => state.applyModify)

  const area = {
    x: existing?.x ?? box.x,
    y: existing?.y ?? box.y,
    width: existing?.width ?? box.width,
    height: existing?.height ?? box.height
  }

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

  const commit = () => {
    if (!armedRef.current) return
    const value = textareaRef.current?.value ?? ''
    const widthPx = textareaRef.current?.offsetWidth ?? width
    const heightPx = textareaRef.current?.offsetHeight ?? height
    armedRef.current = false
    onClose()
    if (!value.trim()) return
    const annotation: TextAnnotation = {
      id: existing?.id ?? createId(),
      type: 'text',
      page,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      style: existing?.style ?? { color: TEXT_COLOR, width: DEFAULT_TEXT_SIZE_PT, opacity: 1 },
      x: area.x,
      y: area.y,
      width: widthPx / rendered.width,
      height: heightPx / rendered.height,
      text: value,
      fontSize: existing?.fontSize ?? DEFAULT_TEXT_SIZE_PT
    }
    if (existing) applyModify(documentId, existing, annotation)
    else applyAdd(documentId, annotation)
  }

  return (
    <textarea
      ref={textareaRef}
      className={styles.editor}
      defaultValue={existing?.text ?? ''}
      aria-label="Type on the worksheet"
      style={{ left, top, width, height, fontSize }}
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
