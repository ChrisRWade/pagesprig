import { finishedPdfState, type FinishedPdfState } from './exportState'
import { shiftIsoDate } from './utils'
import type { DocumentStatus, DocumentSummary } from './types'

export type RecentStatusFilter = 'all' | DocumentStatus
export type RecentPdfFilter = 'all' | FinishedPdfState
export type RecentRange = 'all' | 'today' | 'week' | 'month' | 'custom'
export type RecentSort = 'day' | 'opened' | 'edited' | 'title'

export interface RecentFilter {
  query: string
  studentId: string
  subjectId: string
  status: RecentStatusFilter
  pdf: RecentPdfFilter
  range: RecentRange
  fromDate: string
  toDate: string
  sort: RecentSort
}

export const DEFAULT_RECENT_FILTER: RecentFilter = {
  query: '',
  studentId: '',
  subjectId: '',
  status: 'all',
  pdf: 'all',
  range: 'all',
  fromDate: '',
  toDate: '',
  sort: 'day'
}

export function recentDateBounds(
  filter: Pick<RecentFilter, 'range' | 'fromDate' | 'toDate'>,
  today: string
): { from: string; to: string } {
  switch (filter.range) {
    case 'today':
      return { from: today, to: today }
    case 'week':
      return { from: shiftIsoDate(today, -6), to: today }
    case 'month':
      return { from: shiftIsoDate(today, -29), to: today }
    case 'custom':
      return { from: filter.fromDate, to: filter.toDate }
    default:
      return { from: '', to: '' }
  }
}

export function recentFilterActive(filter: RecentFilter): boolean {
  return (
    Boolean(filter.query.trim()) ||
    Boolean(filter.studentId) ||
    Boolean(filter.subjectId) ||
    filter.status !== 'all' ||
    filter.pdf !== 'all' ||
    filter.range !== 'all'
  )
}

export function matchesRecentQuery(
  item: DocumentSummary,
  query: string,
  names: { student: string; subject: string }
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [item.title, item.originalFilename, item.date, names.student, names.subject]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export function filterAndSortRecent(
  documents: DocumentSummary[],
  filter: RecentFilter,
  today: string,
  namesFor: (item: DocumentSummary) => { student: string; subject: string }
): DocumentSummary[] {
  const bounds = recentDateBounds(filter, today)
  const next = documents.filter((item) => {
    if (filter.studentId && item.studentId !== filter.studentId) return false
    if (filter.subjectId && item.subjectId !== filter.subjectId) return false
    if (filter.status !== 'all' && item.status !== filter.status) return false
    if (filter.pdf !== 'all' && finishedPdfState(item) !== filter.pdf) return false
    if (bounds.from && item.date < bounds.from) return false
    if (bounds.to && item.date > bounds.to) return false
    return matchesRecentQuery(item, filter.query, namesFor(item))
  })

  next.sort((a, b) => {
    switch (filter.sort) {
      case 'opened':
        return b.lastOpenedAt.localeCompare(a.lastOpenedAt)
      case 'edited':
        return b.updatedAt.localeCompare(a.updatedAt)
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return b.date.localeCompare(a.date) || a.title.localeCompare(b.title)
    }
  })
  return next
}

export function groupRecentByDay(documents: DocumentSummary[]): { date: string; items: DocumentSummary[] }[] {
  const groups = new Map<string, DocumentSummary[]>()
  for (const item of documents) {
    const items = groups.get(item.date)
    if (items) items.push(item)
    else groups.set(item.date, [item])
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }))
}
