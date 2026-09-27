import { describe, expect, it } from 'vitest'
import { createCalculator, formatCalculatorNumber, pressCalculator, type CalculatorKey } from './calculator'

function run(keys: string): string {
  let state = createCalculator()
  for (const key of keys) {
    state = pressCalculator(state, key as CalculatorKey)
  }
  return state.display
}

describe('worksheet calculator', () => {
  it('adds, subtracts, multiplies, and divides', () => {
    expect(run('12+7=')).toBe('19')
    expect(run('20-8=')).toBe('12')
    expect(run('6*7=')).toBe('42')
    expect(run('84/4=')).toBe('21')
  })

  it('chains left to right like a four-function tray', () => {
    expect(run('3+4*2=')).toBe('14')
  })

  it('keeps a decimal point and leading zero', () => {
    expect(run('.5*2=')).toBe('1')
    expect(run('0.25+0.25=')).toBe('0.5')
  })

  it('shows an error for divide by zero instead of evaluating code', () => {
    const state = pressCalculator(pressCalculator(pressCalculator(createCalculator(), '8'), '/'), '0')
    const equals = pressCalculator(state, '=')
    expect(equals.display).toBe('Error')
    expect(equals.error).toBe(true)
    expect(pressCalculator(equals, '3').display).toBe('3')
  })

  it('clears and backspaces typed digits', () => {
    expect(pressCalculator(pressCalculator(pressCalculator(createCalculator(), '1'), '2'), 'Backspace').display).toBe(
      '1'
    )
    expect(pressCalculator(pressCalculator(createCalculator(), '9'), 'C').display).toBe('0')
  })

  it('formats floating results without junk digits', () => {
    expect(formatCalculatorNumber(0.1 + 0.2)).toBe('0.3')
  })
})
