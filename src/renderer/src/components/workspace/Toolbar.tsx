import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  MARK_SIZE_PRESETS,
  markStrokeFactor,
  swatchesForTool,
  type ColorableTool,
  type MarkSize
} from '@shared/constants'
import type { ToolId } from '@shared/types'
import { canRedo, canUndo } from '@shared/history'
import { Button } from '../shared/Button'
import { Icons } from '../shared/Icons'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import styles from './Toolbar.module.css'

const TOOLS: { id: ToolId; label: string; shortcut: string; icon: ReactNode }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: Icons.select },
  { id: 'pencil', label: 'Pencil', shortcut: 'P', icon: Icons.pencil },
  { id: 'highlighter', label: 'Highlight', shortcut: 'H', icon: Icons.highlighter },
  { id: 'text', label: 'Type', shortcut: 'T', icon: Icons.text },
  { id: 'line', label: 'Line', shortcut: 'L', icon: Icons.line },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Icons.eraser }
]

const SHAPES: { id: 'rect' | 'ellipse' | 'arrow'; label: string; icon: ReactNode }[] = [
  { id: 'rect', label: 'Box', icon: Icons.rect },
  { id: 'ellipse', label: 'Circle', icon: Icons.ellipse },
  { id: 'arrow', label: 'Arrow', icon: Icons.arrow }
]

const MARKS: { id: 'checkmark' | 'xmark'; label: string; icon: ReactNode }[] = [
  { id: 'checkmark', label: 'Check', icon: Icons.check },
  { id: 'xmark', label: 'X', icon: Icons.xmark }
]

const SIZES: { id: MarkSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' }
]

const COLORABLE = new Set<ToolId>(['pencil', 'highlighter', 'line', 'rect', 'ellipse', 'arrow'])

export function Toolbar() {
  const tool = useAppStore((state) => state.tool)
  const setTool = useAppStore((state) => state.setTool)
  const setShapeTool = useAppStore((state) => state.setShapeTool)
  const activeId = useDocumentStore((state) => state.activeId)
  const history = useDocumentStore((state) => (state.activeId ? state.open[state.activeId]?.history : null))

  return (
    <aside className={styles.rail} aria-label="Writing tools">
      {TOOLS.map((item) =>
        COLORABLE.has(item.id) ? (
          <ColorTool
            key={item.id}
            id={item.id as ColorableTool}
            label={item.label}
            shortcut={item.shortcut}
            icon={item.icon}
            active={tool === item.id}
            onSelect={() => setTool(item.id)}
          />
        ) : (
          <Button
            key={item.id}
            variant="tool"
            active={tool === item.id}
            title={`${item.label} (${item.shortcut})`}
            aria-label={`${item.label} (${item.shortcut})`}
            onClick={() => setTool(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </Button>
        )
      )}
      <div className={styles.divider} />
      {SHAPES.map((item) => (
        <ColorTool
          key={item.id}
          id={item.id}
          label={item.label}
          icon={item.icon}
          active={tool === item.id}
          onSelect={() => setShapeTool(item.id)}
        />
      ))}
      {MARKS.map((item) => (
        <MarkTool key={item.id} id={item.id} label={item.label} icon={item.icon} active={tool === item.id} />
      ))}
      <div className={styles.divider} />
      <Button
        variant="tool"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        disabled={!history || !canUndo(history)}
        onClick={() => activeId && useDocumentStore.getState().undo(activeId)}
      >
        {Icons.undo}
        <span>Undo</span>
      </Button>
      <Button
        variant="tool"
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
        disabled={!history || !canRedo(history)}
        onClick={() => activeId && useDocumentStore.getState().redo(activeId)}
      >
        {Icons.redo}
        <span>Redo</span>
      </Button>
    </aside>
  )
}

function useHoverMenu(menuHeight: number) {
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState({ top: 0, left: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef(0)

  const showMenu = () => {
    window.clearTimeout(closeTimer.current)
    const rect = wrapRef.current?.getBoundingClientRect()
    if (rect) {
      setMenu({
        top: Math.min(rect.top, window.innerHeight - menuHeight),
        left: rect.right + 8
      })
    }
    setOpen(true)
  }

  const hideMenu = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  return { open, setOpen, menu, wrapRef, showMenu, hideMenu }
}

function ColorTool({
  id,
  label,
  shortcut,
  icon,
  active,
  onSelect
}: {
  id: ColorableTool
  label: string
  shortcut?: string
  icon: ReactNode
  active: boolean
  onSelect: () => void
}) {
  const color = useAppStore((state) => state.toolColors[id])
  const { open, setOpen, menu, wrapRef, showMenu, hideMenu } = useHoverMenu(72)
  const swatches = swatchesForTool(id)
  const title = shortcut ? `${label} (${shortcut})` : label

  const pick = (value: string) => {
    useAppStore.getState().setToolColor(id, value)
    onSelect()
    setOpen(false)
  }

  return (
    <div
      ref={wrapRef}
      className={styles.markWrap}
      onMouseEnter={showMenu}
      onMouseLeave={hideMenu}
    >
      <Button
        variant="tool"
        active={active}
        title={`${title}. Hover to choose a color.`}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onSelect}
      >
        {icon}
        <span>{label}</span>
        <span className={styles.pip} style={{ background: color }} aria-hidden="true" />
      </Button>
      {open && (
        <div
          className={styles.colorMenu}
          role="menu"
          aria-label={`${label} color`}
          style={{ top: menu.top, left: menu.left }}
          onMouseEnter={showMenu}
          onMouseLeave={hideMenu}
        >
          {swatches.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              role="menuitemradio"
              aria-checked={color === swatch.value}
              aria-label={swatch.name}
              title={swatch.name}
              className={color === swatch.value ? styles.swatchOn : styles.swatch}
              style={{ background: swatch.value }}
              onClick={() => pick(swatch.value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MarkTool({
  id,
  label,
  icon,
  active
}: {
  id: 'checkmark' | 'xmark'
  label: string
  icon: ReactNode
  active: boolean
}) {
  const markSize = useAppStore((state) => state.markSize)
  const { open, setOpen, menu, wrapRef, showMenu, hideMenu } = useHoverMenu(168)

  const pick = (size: MarkSize) => {
    useAppStore.getState().setMarkSize(size)
    useAppStore.getState().setShapeTool(id)
    setOpen(false)
  }

  return (
    <div
      ref={wrapRef}
      className={styles.markWrap}
      onMouseEnter={showMenu}
      onMouseLeave={hideMenu}
    >
      <Button
        variant="tool"
        active={active}
        title={`${label}. Hover to choose a size.`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => pick(markSize)}
      >
        {icon}
        <span>{label}</span>
      </Button>
      {open && (
        <div
          className={styles.sizeMenu}
          role="menu"
          aria-label={`${label} size`}
          style={{ top: menu.top, left: menu.left }}
          onMouseEnter={showMenu}
          onMouseLeave={hideMenu}
        >
          {SIZES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={markSize === item.id ? styles.sizeOn : styles.size}
              onClick={() => pick(item.id)}
            >
              <MarkPreview type={id} size={item.id} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MarkPreview({ type, size }: { type: 'checkmark' | 'xmark'; size: MarkSize }) {
  const scale = MARK_SIZE_PRESETS[size] / MARK_SIZE_PRESETS.large
  const px = 8 + scale * 14
  const stroke = (1.8 * markStrokeFactor(MARK_SIZE_PRESETS[size])) / Math.max(scale, 0.2)
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className={styles.preview}>
      {type === 'checkmark' ? (
        <path
          d="M4 12l4 4 10-10"
          transform={`translate(11 11) scale(${scale}) translate(-11 -11)`}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            d="M6 6l10 10"
            transform={`translate(11 11) scale(${scale}) translate(-11 -11)`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d="M16 6L6 16"
            transform={`translate(11 11) scale(${scale}) translate(-11 -11)`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </>
      )}
      <circle cx="11" cy="11" r={px / 2} fill="none" stroke="currentColor" strokeOpacity="0.18" />
    </svg>
  )
}