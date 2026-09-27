export type CalculatorOp = '+' | '-' | '*' | '/'
export type CalculatorKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | '+'
  | '-'
  | '*'
  | '/'
  | '='
  | 'C'
  | 'Backspace'

export interface CalculatorState {
  display: string
  stored: number | null
  op: CalculatorOp | null
  entering: boolean
  error: boolean
}

export function createCalculator(): CalculatorState {
  return { display: '0', stored: null, op: null, entering: false, error: false }
}

export function calculatorCleared(state: CalculatorState): boolean {
  return state.display === '0' && state.stored === null && state.op === null && !state.error
}

export function formatCalculatorNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  const rounded = Number(value.toPrecision(12))
  if (Object.is(rounded, -0)) return '0'
  const text = String(rounded)
  return text.length > 14 ? rounded.toExponential(6) : text
}

function parseDisplay(display: string): number {
  const value = Number(display)
  return Number.isFinite(value) ? value : Number.NaN
}

function compute(left: number, op: CalculatorOp, right: number): number {
  switch (op) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      return right === 0 ? Number.NaN : left / right
  }
}

function digitCount(display: string): number {
  return display.replace(/^-/, '').replace('.', '').length
}

export function pressCalculator(state: CalculatorState, key: CalculatorKey): CalculatorState {
  if (key === 'C') return createCalculator()

  if (state.error) {
    if (key === 'Backspace') return createCalculator()
    if ((key >= '0' && key <= '9') || key === '.') return pressCalculator(createCalculator(), key)
    return state
  }

  if (key === 'Backspace') {
    if (!state.entering) return state
    if (state.display === '0' || state.display === '-0') {
      return { ...state, display: '0', entering: false }
    }
    const next = state.display.slice(0, -1)
    if (!next || next === '-') return { ...state, display: '0', entering: false }
    return { ...state, display: next }
  }

  if (key === '.') {
    if (!state.entering) return { ...state, display: '0.', entering: true }
    if (state.display.includes('.')) return state
    return { ...state, display: `${state.display}.` }
  }

  if (key >= '0' && key <= '9') {
    if (!state.entering || state.display === '0') {
      return { ...state, display: key, entering: true, error: false }
    }
    if (state.display === '-0') return { ...state, display: `-${key}`, entering: true }
    if (digitCount(state.display) >= 12) return state
    return { ...state, display: `${state.display}${key}` }
  }

  if (key === '+' || key === '-' || key === '*' || key === '/') {
    const current = parseDisplay(state.display)
    if (!Number.isFinite(current)) {
      return { display: 'Error', stored: null, op: null, entering: false, error: true }
    }
    if (state.stored !== null && state.op && state.entering) {
      const result = compute(state.stored, state.op, current)
      const display = formatCalculatorNumber(result)
      if (display === 'Error') return { display: 'Error', stored: null, op: null, entering: false, error: true }
      return { display, stored: result, op: key, entering: false, error: false }
    }
    return { ...state, stored: current, op: key, entering: false }
  }

  if (key === '=') {
    if (state.op === null || state.stored === null) return { ...state, entering: false }
    const result = compute(state.stored, state.op, parseDisplay(state.display))
    const display = formatCalculatorNumber(result)
    if (display === 'Error') return { display: 'Error', stored: null, op: null, entering: false, error: true }
    return { display, stored: result, op: null, entering: false, error: false }
  }

  return state
}

export function mapKeyboardToCalculator(event: KeyboardEvent): CalculatorKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (event.key >= '0' && event.key <= '9') return event.key as CalculatorKey
  if (event.key === '.') return '.'
  if (event.key === '+') return '+'
  if (event.key === '-') return '-'
  if (event.key === '*') return '*'
  if (event.key === '/') return '/'
  if (event.key === 'Enter' || event.key === '=') return '='
  if (event.key === 'Backspace') return 'Backspace'
  if (event.key.toLowerCase() === 'c') return 'C'
  return null
}
