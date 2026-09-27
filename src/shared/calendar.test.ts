import { describe, expect, it } from 'vitest'
import { calendarCells, daysInMonth, monthKey, shiftMonth } from './calendar'

describe('review calendar', () => {
  it('builds a Sunday-first month grid', () => {
    expect(monthKey('2026-09-21')).toBe('2026-09')
    expect(daysInMonth('2026-09')).toHaveLength(30)
    const cells = calendarCells('2026-09')
    expect(cells[0]?.date).toBeNull()
    expect(cells[2]?.date).toBe('2026-09-01')
    expect(cells.filter((cell) => cell.date).at(-1)?.date).toBe('2026-09-30')
    expect(cells.length % 7).toBe(0)
  })

  it('moves to the next and previous month', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})
