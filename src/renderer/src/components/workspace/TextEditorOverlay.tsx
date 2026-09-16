import { useEffect, useRef } from 'react'
import { DEFAULT_TEXT_SIZE_PT, TEXT_COLOR } from '@shared/constants'
import { pdfLengthToScreen } from '@shared/coords'
import type { Point, Size, TextAnnotation } from '@shared/types'
import { createId, nowIso } from '@shared/utils'
import { useDocumentStore } from '../../stores/documentStore'
import styles from './TextEditorOverlay.module.css'

interface Props {
  documentId: string
  page: number
  point: Point
  existing?: TextAnnotation
  rendered: Size
  pageSize: Size
  onClose: () => void
}

export function TextEditorOverlay({ documentId, page, point, existing, rendered, pageSize, onClose }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const applyAdd = useDocumentStore((state) => state.applyAdd)
  const applyModify = useDocumentStore((state) => state.applyModify)

  useEffect(() => {
    textareaRef.current?.focus()
    if (existing) textareaRef.current?.select()
  }, [existing])

  const left = (existing?.x ?? point.x) * rendered.width
  const top = (existing?.y ?? point.y) * rendered.height
  const fontSize = pdfLengthToScreen(existing?.fontSize ?? DEFAULT_TEXT_SIZE_PT, pageSize, rendered)

  const commit = () => {
    const value = textareaRef.current?.value ?? ''
    const heightPx = textareaRef.current?.scrollHeight ?? fontSize * 1.4
    const widthPx = Math.max(textareaRef.current?.scrollWidth ?? 160, 120)
    onClose()
    if (!value.trim()) return
    const annotation: TextAnnotation = {
      id: existing?.id ?? createId(),
      type: 'text',
      page,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      style: existing?.style ?? { color: TEXT_COLOR, width: DEFAULT_TEXT_SIZE_PT, opacity: 1 },
      x: existing?.x ?? point.x,
      y: existing?.y ?? point.y,
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
      style={{ left, top, fontSize, minWidth: Math.max(160, (existing?.width ?? 0.28) * rendered.width) }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    />
  )
}
