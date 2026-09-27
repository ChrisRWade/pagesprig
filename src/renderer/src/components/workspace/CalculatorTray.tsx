import { useEffect, useState } from 'react'
import {
  calculatorCleared,
  createCalculator,
  mapKeyboardToCalculator,
  pressCalculator,
  type CalculatorKey
} from '@shared/calculator'
import { useAppStore } from '../../stores/appStore'
import styles from './CalculatorTray.module.css'

const KEYS: { id: CalculatorKey; label: string; kind?: 'op' | 'eq' | 'wide' }[] = [
  { id: 'C', label: 'C' },
  { id: 'Backspace', label: '⌫' },
  { id: '/', label: '÷', kind: 'op' },
  { id: '*', label: '×', kind: 'op' },
  { id: '7', label: '7' },
  { id: '8', label: '8' },
  { id: '9', label: '9' },
  { id: '-', label: '−', kind: 'op' },
  { id: '4', label: '4' },
  { id: '5', label: '5' },
  { id: '6', label: '6' },
  { id: '+', label: '+', kind: 'op' },
  { id: '1', label: '1' },
  { id: '2', label: '2' },
  { id: '3', label: '3' },
  { id: '=', label: '=', kind: 'eq' },
  { id: '0', label: '0', kind: 'wide' },
  { id: '.', label: '.' }
]

export function CalculatorTray() {
  const open = useAppStore((state) => state.calculatorOpen)
  const thumbnailsOpen = useAppStore((state) => state.thumbnailsOpen)
  const [state, setState] = useState(createCalculator)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (typing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setState((current) => {
          if (calculatorCleared(current)) {
            useAppStore.getState().setCalculatorOpen(false)
            return current
          }
          return pressCalculator(current, 'C')
        })
        return
      }
      const key = mapKeyboardToCalculator(event)
      if (!key) return
      event.preventDefault()
      event.stopPropagation()
      setState((current) => pressCalculator(current, key))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!open) return null

  return (
    <aside className={styles.tray} aria-label="Calculator" style={{ right: thumbnailsOpen ? 108 : 16 }}>
      <header className={styles.top}>
        <strong>Calculator</strong>
        <button
          type="button"
          className={styles.close}
          aria-label="Close calculator"
          onClick={() => useAppStore.getState().setCalculatorOpen(false)}
        >
          ×
        </button>
      </header>
      <div className={state.error ? styles.displayErr : styles.display} aria-live="polite">
        {state.display}
      </div>
      <div className={styles.keys}>
        {KEYS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              item.kind === 'eq' ? styles.eq : item.kind === 'op' ? styles.op : item.kind === 'wide' ? styles.wide : styles.key
            }
            aria-label={labelFor(item.id, item.label)}
            onClick={() => setState((current) => pressCalculator(current, item.id))}
          >
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  )
}

function labelFor(id: CalculatorKey, label: string): string {
  if (id === 'C') return 'Clear'
  if (id === 'Backspace') return 'Backspace'
  if (id === '/') return 'Divide'
  if (id === '*') return 'Multiply'
  if (id === '-') return 'Subtract'
  if (id === '+') return 'Add'
  if (id === '=') return 'Equals'
  return label
}
