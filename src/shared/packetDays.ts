import { localIsoDate, nowIso, shiftIsoDate } from './utils'
import type { DocumentProject, DocumentSummary, PacketDay } from './types'

const MAX_QUESTIONS = 999

export function weekdayIndex(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00`).getDay()
}

export function isWeekend(isoDate: string): boolean {
  const day = weekdayIndex(isoDate)
  return day === 0 || day === 6
}

export function nextSchoolDay(isoDate: string): string {
  let next = shiftIsoDate(isoDate, 1)
  while (isWeekend(next)) next = shiftIsoDate(next, 1)
  return next
}

export function schoolDaysFrom(start: string, count: number): string[] {
  const days = [start]
  let current = start
  while (days.length < Math.max(1, count)) {
    current = nextSchoolDay(current)
    days.push(current)
  }
  return days
}

export function clampOverviewEnd(endPage: number, pageCount: number): number {
  const pages = Math.max(1, pageCount)
  if (!Number.isFinite(endPage) || endPage <= 0) return 0
  return Math.min(Math.round(endPage), Math.max(0, pages - 1))
}

export function parseOverviewEnd(value: unknown, pageCount: number): number {
  return typeof value === 'number' ? clampOverviewEnd(value, pageCount) : 0
}

export function workStartPage(overviewEndPage: number, pageCount: number): number {
  return clampOverviewEnd(overviewEndPage, pageCount) + 1
}

export function hasLessonOverview(overviewEndPage: number, pageCount: number): boolean {
  return clampOverviewEnd(overviewEndPage, pageCount) > 0
}

export function isOverviewPage(page: number, overviewEndPage: number): boolean {
  return page >= 1 && page <= overviewEndPage
}

export function awaitingLessonStart(wantOverview: boolean, overviewEndPage: number): boolean {
  return wantOverview && overviewEndPage <= 0
}

export function singleDayRange(date: string, pageCount: number, overviewEndPage = 0): PacketDay[] {
  const pages = Math.max(1, pageCount)
  return [{ date, startPage: workStartPage(overviewEndPage, pages), endPage: pages }]
}

export function initialPacketSplit(
  date: string,
  pageCount: number
): { dayRanges: PacketDay[]; overviewEndPage: number } {
  return { overviewEndPage: 0, dayRanges: singleDayRange(date, pageCount, 0) }
}

export function beginFirstLesson(
  page: number,
  pageCount: number,
  firstDate: string
): { ranges: PacketDay[]; overviewEndPage: number } | null {
  const pages = Math.max(1, pageCount)
  if (page <= 1 || page > pages) return null
  const overviewEndPage = page - 1
  return {
    overviewEndPage,
    ranges: singleDayRange(firstDate, pages, overviewEndPage)
  }
}

export function packetDates(ranges: readonly PacketDay[]): string[] {
  return [...new Set(ranges.map((item) => item.date))].sort()
}

export function isMultiDay(ranges: readonly PacketDay[]): boolean {
  return packetDates(ranges).length > 1
}

export type DayReviewPatch = {
  reviewed?: boolean
  questionCount?: number | null
  correctCount?: number | null
}

export type DateReviewStatus = 'none' | 'some' | 'all'

function parseQuestionCount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const count = Math.round(value)
  if (count < 1 || count > MAX_QUESTIONS) return undefined
  return count
}

function parseCorrectCount(value: unknown, questionCount: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const count = Math.round(value)
  if (count < 0) return undefined
  return Math.min(count, questionCount)
}

export function dayReviewOf(
  item: Partial<PacketDay> | Record<string, unknown>
): Pick<PacketDay, 'reviewedAt' | 'questionCount' | 'correctCount'> {
  const review: Pick<PacketDay, 'reviewedAt' | 'questionCount' | 'correctCount'> = {}
  const reviewedAt = 'reviewedAt' in item ? item.reviewedAt : undefined
  if (typeof reviewedAt === 'string' && reviewedAt.trim()) review.reviewedAt = reviewedAt
  const questionCount = parseQuestionCount(item.questionCount)
  if (questionCount == null) return review
  review.questionCount = questionCount
  const correctCount = parseCorrectCount(item.correctCount, questionCount)
  if (correctCount != null) review.correctCount = correctCount
  return review
}

export function isDayReviewed(item: PacketDay): boolean {
  return Boolean(item.reviewedAt)
}

export function dayScoreLabel(item: PacketDay): string | null {
  if (item.questionCount == null) return null
  return `${item.correctCount ?? '—'}/${item.questionCount}`
}

export function setDayReview(
  ranges: readonly PacketDay[],
  date: string,
  patch: DayReviewPatch,
  reviewedAt = nowIso()
): PacketDay[] {
  return ranges.map((item) => {
    if (item.date !== date) return item
    const current = dayReviewOf(item)
    let nextReviewedAt = current.reviewedAt
    if (patch.reviewed === true) nextReviewedAt = current.reviewedAt ?? reviewedAt
    if (patch.reviewed === false) nextReviewedAt = undefined
    let questionCount = current.questionCount
    let correctCount = current.correctCount
    if (patch.questionCount !== undefined) {
      questionCount = patch.questionCount == null ? undefined : parseQuestionCount(patch.questionCount)
      if (questionCount == null) correctCount = undefined
      else if (correctCount != null) correctCount = parseCorrectCount(correctCount, questionCount)
    }
    if (patch.correctCount !== undefined) {
      if (questionCount == null || patch.correctCount == null) correctCount = undefined
      else correctCount = parseCorrectCount(patch.correctCount, questionCount)
    }
    const next: PacketDay = {
      date: item.date,
      startPage: item.startPage,
      endPage: item.endPage
    }
    return {
      ...next,
      ...dayReviewOf({ ...next, reviewedAt: nextReviewedAt, questionCount, correctCount })
    }
  })
}

type PacketPages = Pick<DocumentProject, 'date' | 'dayRanges'> & {
  overviewEndPage?: number
  pages?: { length: number }
  pageCount?: number
}

export function parsePacketDays(
  value: unknown,
  fallbackDate: string,
  pageCount: number,
  overviewEndPage = 0
): PacketDay[] {
  if (!Array.isArray(value)) return singleDayRange(fallbackDate, pageCount, overviewEndPage)
  const parsed: PacketDay[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) continue
    if (typeof record.startPage !== 'number' || typeof record.endPage !== 'number') continue
    parsed.push({
      date: record.date,
      startPage: Math.round(record.startPage),
      endPage: Math.round(record.endPage),
      ...dayReviewOf(record)
    })
  }
  return normalizeDayRanges(parsed, fallbackDate, pageCount, overviewEndPage)
}

export function normalizeDayRanges(
  ranges: readonly PacketDay[],
  fallbackDate: string,
  pageCount: number,
  overviewEndPage = 0
): PacketDay[] {
  const pages = Math.max(1, pageCount)
  const overview = clampOverviewEnd(overviewEndPage, pages)
  const workStart = workStartPage(overview, pages)
  if (workStart > pages) return singleDayRange(fallbackDate, pages, overview)
  if (ranges.length === 0) return singleDayRange(fallbackDate, pages, overview)
  const sorted = [...ranges]
    .map((item) => ({
      date: item.date,
      startPage: Math.min(pages, Math.max(workStart, item.startPage)),
      endPage: Math.min(pages, Math.max(workStart, item.endPage)),
      ...dayReviewOf(item)
    }))
    .sort((a, b) => a.startPage - b.startPage || a.date.localeCompare(b.date))

  const first = { ...sorted[0], startPage: workStart }
  const filled: PacketDay[] = [first]
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = filled[filled.length - 1]
    const start = Math.max(previous.endPage + 1, sorted[i].startPage)
    if (start > pages) break
    previous.endPage = start - 1
    if (previous.endPage < previous.startPage) {
      filled.pop()
    }
    filled.push({ ...sorted[i], startPage: start })
  }
  filled[filled.length - 1].endPage = pages
  return filled.filter((item) => item.endPage >= item.startPage)
}

export function rangesFromStartPages(
  startPages: readonly number[],
  firstDate: string,
  pageCount: number,
  overviewEndPage = 0
): PacketDay[] {
  const pages = Math.max(1, pageCount)
  const workStart = workStartPage(overviewEndPage, pages)
  const unique = [...new Set([workStart, ...startPages])]
    .filter((page) => page >= workStart && page <= pages)
    .sort((a, b) => a - b)
  const dates = schoolDaysFrom(firstDate, unique.length)
  const ranges: PacketDay[] = unique.map((start, index) => ({
    date: dates[index],
    startPage: start,
    endPage: (unique[index + 1] ?? pages + 1) - 1
  }))
  return normalizeDayRanges(ranges, firstDate, pages, overviewEndPage)
}

export function toggleStartPage(
  ranges: readonly PacketDay[],
  page: number,
  pageCount: number,
  overviewEndPage = 0
): PacketDay[] {
  const firstDate = ranges[0]?.date ?? localIsoDate()
  const workStart = workStartPage(overviewEndPage, pageCount)
  if (page <= workStart) return normalizeDayRanges(ranges, firstDate, pageCount, overviewEndPage)
  const starts = ranges.map((item) => item.startPage)
  const next = starts.includes(page) ? starts.filter((item) => item !== page) : [...starts, page]
  const datesByStart = new Map(ranges.map((item) => [item.startPage, item.date]))
  const extrasByStart = new Map(ranges.map((item) => [item.startPage, dayReviewOf(item)]))
  const unique = [...new Set([workStart, ...next])].sort((a, b) => a - b)
  const rebuilt = unique.map((start, index) => ({
    date: datesByStart.get(start) ?? '',
    startPage: start,
    endPage: (unique[index + 1] ?? pageCount + 1) - 1,
    ...extrasByStart.get(start)
  }))
  let previousDate = firstDate
  for (const range of rebuilt) {
    if (!range.date) range.date = indexSchoolDate(previousDate, range.startPage === workStart)
    previousDate = range.date
  }
  rebuilt[0].date = firstDate
  return normalizeDayRanges(rebuilt, firstDate, pageCount, overviewEndPage)
}

function indexSchoolDate(previousDate: string, isFirst: boolean): string {
  return isFirst ? previousDate : nextSchoolDay(previousDate)
}

export function setHasOverview(
  ranges: readonly PacketDay[],
  enabled: boolean,
  pageCount: number,
  firstDate: string
): { ranges: PacketDay[]; overviewEndPage: number } {
  if (!enabled) {
    return {
      overviewEndPage: 0,
      ranges: normalizeDayRanges(ranges, firstDate, pageCount, 0)
    }
  }
  return { overviewEndPage: 0, ranges: [] }
}

export function setOverviewEndPage(
  ranges: readonly PacketDay[],
  endPage: number,
  pageCount: number,
  firstDate: string
): { ranges: PacketDay[]; overviewEndPage: number } {
  const overviewEndPage = clampOverviewEnd(endPage, pageCount)
  return {
    overviewEndPage,
    ranges: normalizeDayRanges(ranges, firstDate, pageCount, overviewEndPage)
  }
}

export function growOverview(
  ranges: readonly PacketDay[],
  pageCount: number,
  firstDate: string,
  currentOverview: number
): { ranges: PacketDay[]; overviewEndPage: number } {
  return setOverviewEndPage(ranges, currentOverview + 1, pageCount, firstDate)
}

export function clearFirstLesson(): { ranges: PacketDay[]; overviewEndPage: number } {
  return { ranges: [], overviewEndPage: 0 }
}

export function canGrowOverview(overviewEndPage: number, pageCount: number): boolean {
  return clampOverviewEnd(overviewEndPage + 1, pageCount) > clampOverviewEnd(overviewEndPage, pageCount)
}

export function setRangeDate(ranges: readonly PacketDay[], index: number, date: string): PacketDay[] {
  return ranges.map((item, i) => (i === index ? { ...item, date } : item))
}

export function pushRemainingDays(
  ranges: readonly PacketDay[],
  fromDate: string,
  steps = 1
): PacketDay[] {
  return ranges.map((item) => {
    if (item.date < fromDate) return item
    let date = item.date
    for (let i = 0; i < Math.max(1, steps); i += 1) date = nextSchoolDay(date)
    return { ...item, date }
  })
}

export function expandLastRange(
  ranges: readonly PacketDay[],
  pageCount: number,
  fallbackDate: string,
  overviewEndPage = 0
): PacketDay[] {
  const normalized = normalizeDayRanges(ranges, fallbackDate, Math.max(1, pageCount - 1), overviewEndPage)
  if (normalized.length === 0) return singleDayRange(fallbackDate, pageCount, overviewEndPage)
  const next = normalized.map((item) => ({ ...item }))
  next[next.length - 1].endPage = Math.max(pageCount, next[next.length - 1].endPage + 1)
  return normalizeDayRanges(next, fallbackDate, pageCount, overviewEndPage)
}

export function remapOverviewAfterPageRemoval(
  overviewEndPage: number,
  removedPage: number,
  pageCount: number
): number {
  if (overviewEndPage <= 0) return 0
  const next = removedPage <= overviewEndPage ? overviewEndPage - 1 : overviewEndPage
  return clampOverviewEnd(next, pageCount)
}

export function remapRangesAfterPageRemoval(
  ranges: readonly PacketDay[],
  removedPage: number,
  pageCount: number,
  fallbackDate: string,
  overviewEndPage = 0
): PacketDay[] {
  const shifted = ranges.map((item) => {
    const startPage = item.startPage > removedPage ? item.startPage - 1 : item.startPage
    const endPage = item.endPage >= removedPage ? item.endPage - 1 : item.endPage
    return { ...item, startPage, endPage }
  })
  const nextOverview = remapOverviewAfterPageRemoval(overviewEndPage, removedPage, pageCount)
  return normalizeDayRanges(shifted, fallbackDate, pageCount, nextOverview)
}

export function overviewEndPageOf(item: PacketPages): number {
  const pageCount = item.pageCount ?? item.pages?.length ?? 1
  return clampOverviewEnd(item.overviewEndPage ?? 0, pageCount)
}

export function dayRangesOf(item: PacketPages): PacketDay[] {
  const pageCount = item.pageCount ?? item.pages?.length ?? 1
  return normalizeDayRanges(item.dayRanges ?? [], item.date, pageCount, overviewEndPageOf(item))
}

export function appearsOnDate(item: PacketPages, date: string): boolean {
  return dayRangesOf(item).some((range) => range.date === date)
}

export function rangeForDate(item: PacketPages, date: string): PacketDay | null {
  return dayRangesOf(item).find((range) => range.date === date) ?? null
}

export function dateReviewStatus(items: readonly PacketPages[], date: string): DateReviewStatus {
  const ranges = items
    .map((item) => rangeForDate(item, date))
    .filter((item): item is PacketDay => item != null)
  if (ranges.length === 0) return 'none'
  const reviewed = ranges.filter(isDayReviewed).length
  if (reviewed === 0) return 'none'
  return reviewed === ranges.length ? 'all' : 'some'
}

export function packetDayLabel(ranges: readonly PacketDay[], date: string): string | null {
  if (!isMultiDay(ranges)) return null
  const index = ranges.findIndex((item) => item.date === date)
  if (index < 0) return null
  return `Day ${index + 1} of ${ranges.length}`
}

export function datesOverlapRange(item: DocumentSummary, from: string, to: string): boolean {
  const dates = packetDates(dayRangesOf(item))
  return dates.some((date) => {
    if (from && date < from) return false
    if (to && date > to) return false
    return true
  })
}

export function withDayRanges(
  project: DocumentProject,
  ranges: PacketDay[],
  overviewEndPage = project.overviewEndPage ?? 0
): DocumentProject {
  const overview = clampOverviewEnd(overviewEndPage, project.pages.length)
  const normalized = normalizeDayRanges(ranges, project.date, project.pages.length, overview)
  return {
    ...project,
    date: normalized[0]?.date ?? project.date,
    dayRanges: normalized,
    overviewEndPage: overview
  }
}

export function pageSpanLabel(range: PacketDay): string {
  return range.startPage === range.endPage ? `p. ${range.startPage}` : `pp. ${range.startPage}–${range.endPage}`
}

export function workDatesOf(items: readonly PacketPages[]): string[] {
  const dates = new Set<string>()
  for (const item of items) {
    for (const date of packetDates(dayRangesOf(item))) dates.add(date)
  }
  return [...dates].sort()
}
