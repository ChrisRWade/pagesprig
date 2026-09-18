import { describe, expect, it } from 'vitest'
import { annotationBounds, localIsoDate, schoolDayWindow, shiftIsoDate } from './utils'
import type { StrokeAnnotation } from './types'

const stroke = (points: { x: number; y: number }[]): StrokeAnnotation => ({
  id: 's1',
  type: 'stroke',
  page: 1,
  createdAt: '2026-09-16T12:00:00.000Z',
  updatedAt: '2026-09-16T12:00:00.000Z',
  style: { color: '#000', width: 1.6, opacity: 1 },
  points
})

describe('annotation bounds', () => {
  it('fits a pencil stroke without stretching to the page origin', () => {
    const bounds = annotationBounds(
      stroke([
        { x: 0.4, y: 0.5 },
        { x: 0.42, y: 0.52 },
        { x: 0.45, y: 0.51 }
      ])
    )
    expect(bounds.x).toBeGreaterThan(0.3)
    expect(bounds.y).toBeGreaterThan(0.4)
    expect(bounds.x).toBeLessThan(0.4)
    expect(bounds.y).toBeLessThan(0.5)
    expect(bounds.width).toBeLessThan(0.08)
    expect(bounds.height).toBeLessThan(0.04)
    expect(bounds.x + bounds.width).toBeLessThan(0.5)
    expect(bounds.y + bounds.height).toBeLessThan(0.6)
  })
})

describe('school days', () => {
  it('uses the local calendar date, not UTC', () => {
    expect(localIsoDate(new Date(2026, 8, 17, 23, 30, 0))).toBe('2026-09-17')
  })

  it('moves a calendar date by whole days', () => {
    expect(shiftIsoDate('2026-09-17', -1)).toBe('2026-09-16')
    expect(shiftIsoDate('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('keeps today and the selected day in a short window', () => {
    expect(schoolDayWindow(['2026-09-10', '2026-09-11', '2026-09-16'], '2026-09-16', '2026-09-17', 7)).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-16',
      '2026-09-17'
    ])
    expect(schoolDayWindow(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-16'], '2026-09-16', '2026-09-17', 3)).toEqual([
      '2026-09-15',
      '2026-09-16',
      '2026-09-17'
    ])
  })
})
