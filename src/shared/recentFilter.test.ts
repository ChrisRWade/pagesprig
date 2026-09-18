import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RECENT_FILTER,
  filterAndSortRecent,
  groupRecentByDay,
  matchesRecentQuery,
  recentDateBounds,
  recentFilterActive
} from './recentFilter'
import type { DocumentSummary } from './types'

const names = { student: 'Chris', subject: 'Math' }

const doc = (overrides: Partial<DocumentSummary>): DocumentSummary => ({
  id: 'd1',
  studentId: 'chris',
  subjectId: 'math',
  date: '2026-09-17',
  title: 'Fractions',
  status: 'in_progress',
  projectDir: '/tmp/fractions',
  exportPdfPath: '/tmp/fractions.pdf',
  sourcePdfPath: '/tmp/original.pdf',
  originalFilename: 'SS3-fractions.pdf',
  updatedAt: '2026-09-17T12:00:00.000Z',
  lastOpenedAt: '2026-09-17T12:00:00.000Z',
  lastExportedAt: null,
  pageCount: 2,
  ...overrides
})

describe('recent filters', () => {
  it('matches title, file name, student, and subject', () => {
    const item = doc({})
    expect(matchesRecentQuery(item, 'frac', names)).toBe(true)
    expect(matchesRecentQuery(item, 'SS3', names)).toBe(true)
    expect(matchesRecentQuery(item, 'chris', names)).toBe(true)
    expect(matchesRecentQuery(item, 'science', names)).toBe(false)
  })

  it('narrows by status, saved PDF, and school day', () => {
    const docs = [
      doc({ id: 'a', title: 'A', status: 'completed', lastExportedAt: '2026-09-17T13:00:00.000Z', date: '2026-09-17' }),
      doc({ id: 'b', title: 'B', status: 'not_started', date: '2026-09-10' }),
      doc({
        id: 'c',
        title: 'C',
        status: 'in_progress',
        updatedAt: '2026-09-16T18:00:00.000Z',
        lastExportedAt: '2026-09-16T12:00:00.000Z',
        date: '2026-09-16'
      })
    ]
    const savedToday = filterAndSortRecent(
      docs,
      { ...DEFAULT_RECENT_FILTER, status: 'completed', pdf: 'current', range: 'today' },
      '2026-09-17',
      () => names
    )
    expect(savedToday.map((item) => item.id)).toEqual(['a'])

    const needsSaving = filterAndSortRecent(
      docs,
      { ...DEFAULT_RECENT_FILTER, pdf: 'stale' },
      '2026-09-17',
      () => names
    )
    expect(needsSaving.map((item) => item.id)).toEqual(['c'])
  })

  it('uses a trailing week window and groups by school day', () => {
    expect(recentDateBounds({ range: 'week', fromDate: '', toDate: '' }, '2026-09-17')).toEqual({
      from: '2026-09-11',
      to: '2026-09-17'
    })
    const grouped = groupRecentByDay([
      doc({ id: 'new', date: '2026-09-17', title: 'B' }),
      doc({ id: 'old', date: '2026-09-10', title: 'A' }),
      doc({ id: 'also-new', date: '2026-09-17', title: 'A' })
    ])
    expect(grouped.map((group) => group.date)).toEqual(['2026-09-17', '2026-09-10'])
    expect(grouped[0].items.map((item) => item.id)).toEqual(['new', 'also-new'])
    expect(recentFilterActive({ ...DEFAULT_RECENT_FILTER, query: 'math' })).toBe(true)
    expect(recentFilterActive(DEFAULT_RECENT_FILTER)).toBe(false)
  })
})
