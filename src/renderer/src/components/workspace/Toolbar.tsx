import type { ReactNode } from 'react'
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

const SHAPES: { id: 'rect' | 'ellipse' | 'arrow' | 'checkmark' | 'xmark'; label: string; icon: ReactNode }[] = [
  { id: 'rect', label: 'Box', icon: Icons.rect },
  { id: 'ellipse', label: 'Circle', icon: Icons.ellipse },
  { id: 'arrow', label: 'Arrow', icon: Icons.arrow },
  { id: 'checkmark', label: 'Check', icon: Icons.check },
  { id: 'xmark', label: 'X', icon: Icons.xmark }
]

export function Toolbar() {
  const tool = useAppStore((state) => state.tool)
  const setTool = useAppStore((state) => state.setTool)
  const setShapeTool = useAppStore((state) => state.setShapeTool)
  const activeId = useDocumentStore((state) => state.activeId)
  const history = useDocumentStore((state) => (state.activeId ? state.open[state.activeId]?.history : null))

  return (
    <aside className={styles.rail} aria-label="Writing tools">
      {TOOLS.map((item) => (
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
      ))}
      <div className={styles.divider} />
      {SHAPES.map((item) => (
        <Button
          key={item.id}
          variant="tool"
          active={tool === item.id}
          title={item.label}
          aria-label={item.label}
          onClick={() => setShapeTool(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </Button>
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
