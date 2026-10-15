import { describe, expect, it } from 'vitest'
import {
  appearsOnDate,
  beginFirstLesson,
  clearFirstLesson,
  dateReviewStatus,
  dayScoreLabel,
  growOverview,
  initialPacketSplit,
  nextSchoolDay,
  packetDayLabel,
  pageSpanLabel,
  parsePacketDays,
  pushRemainingDays,
  rangesFromStartPages,
  rangeForDate,
  remapRangesAfterPageRemoval,
  schoolDaysFrom,
  setDayReview,
  setHasOverview,
  shouldMaterializePacket,
  toggleStartPage
} from './packetDays'

describe('packet days', () => {
  it('skips weekends when laying out school days', () => {
    expect(nextSchoolDay('2026-09-18')).toBe('2026-09-21')
    expect(schoolDaysFrom('2026-09-21', 3)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23'])
  })

  it('splits a packet at the pages a child marks as new days', () => {
    const ranges = rangesFromStartPages([1, 5, 8], '2026-09-21', 10)
    expect(ranges).toEqual([
      { date: '2026-09-21', startPage: 1, endPage: 4 },
      { date: '2026-09-22', startPage: 5, endPage: 7 },
      { date: '2026-09-23', startPage: 8, endPage: 10 }
    ])
    expect(packetDayLabel(ranges, '2026-09-22')).toBe('Day 2 of 3')
  })

  it('toggles a cut without losing the first day', () => {
    const one = rangesFromStartPages([1], '2026-09-21', 6)
    const two = toggleStartPage(one, 4, 6)
    expect(two.map((item) => [item.startPage, item.endPage, item.date])).toEqual([
      [1, 3, '2026-09-21'],
      [4, 6, '2026-09-22']
    ])
    expect(toggleStartPage(two, 4, 6)).toEqual(one)
  })

  it('does not assume page 1 is a one-page overview', () => {
    expect(initialPacketSplit('2026-09-21', 15)).toEqual({
      overviewEndPage: 0,
      dayRanges: [{ date: '2026-09-21', startPage: 1, endPage: 15 }]
    })
  })

  it('uses the first selected page as day 1 and treats earlier pages as overview', () => {
    const first = beginFirstLesson(5, 12, '2026-09-21')
    expect(first).toEqual({
      overviewEndPage: 4,
      ranges: [{ date: '2026-09-21', startPage: 5, endPage: 12 }]
    })
    const days = toggleStartPage(first!.ranges, 9, 12, first!.overviewEndPage)
    expect(days.map((item) => [item.startPage, item.endPage])).toEqual([
      [5, 8],
      [9, 12]
    ])
  })

  it('can move day 1 later or clear it after a mistaken first pick', () => {
    const first = beginFirstLesson(4, 10, '2026-09-21')!
    const grown = growOverview(first.ranges, 10, '2026-09-21', first.overviewEndPage)
    expect(grown.overviewEndPage).toBe(4)
    expect(grown.ranges).toEqual([{ date: '2026-09-21', startPage: 5, endPage: 10 }])
    expect(clearFirstLesson()).toEqual({ ranges: [], overviewEndPage: 0 })
  })

  it('can turn the overview off so page 1 is day 1 again', () => {
    const first = beginFirstLesson(4, 8, '2026-09-21')!
    const without = setHasOverview(first.ranges, false, 8, '2026-09-21')
    expect(without.overviewEndPage).toBe(0)
    expect(without.ranges).toEqual([{ date: '2026-09-21', startPage: 1, endPage: 8 }])
    const restored = setHasOverview(without.ranges, true, 8, '2026-09-21')
    expect(restored.overviewEndPage).toBe(0)
    expect(restored.ranges).toEqual([])
  })

  it('pushes leftover days forward for a holiday or sick day', () => {
    const ranges = rangesFromStartPages([1, 3, 5], '2026-09-21', 6)
    const shifted = pushRemainingDays(ranges, '2026-09-22')
    expect(shifted.map((item) => item.date)).toEqual(['2026-09-21', '2026-09-23', '2026-09-24'])
  })

  it('keeps a packet visible on each of its days', () => {
    const item = {
      date: '2026-09-21',
      pageCount: 8,
      dayRanges: rangesFromStartPages([1, 5], '2026-09-21', 8)
    }
    expect(appearsOnDate(item, '2026-09-21')).toBe(true)
    expect(appearsOnDate(item, '2026-09-22')).toBe(true)
    expect(appearsOnDate(item, '2026-09-23')).toBe(false)
  })

  it('shrinks day ranges when a notes page is removed', () => {
    const ranges = rangesFromStartPages([1, 4], '2026-09-21', 6)
    const next = remapRangesAfterPageRemoval(ranges, 5, 5, '2026-09-21')
    expect(next).toEqual([
      { date: '2026-09-21', startPage: 1, endPage: 3 },
      { date: '2026-09-22', startPage: 4, endPage: 5 }
    ])
  })

  it('labels the page span for a day', () => {
    expect(pageSpanLabel({ date: '2026-09-21', startPage: 1, endPage: 1 })).toBe('p. 1')
    expect(pageSpanLabel({ date: '2026-09-22', startPage: 5, endPage: 7 })).toBe('pp. 5–7')
  })

  it('lets a parent check a day and record an optional score', () => {
    const ranges = rangesFromStartPages([1, 5], '2026-09-21', 8)
    const checked = setDayReview(
      ranges,
      '2026-09-21',
      { reviewed: true, questionCount: 9, correctCount: 8 },
      '2026-09-21T18:00:00.000Z'
    )
    expect(checked[0]).toMatchObject({
      date: '2026-09-21',
      reviewedAt: '2026-09-21T18:00:00.000Z',
      questionCount: 9,
      correctCount: 8
    })
    expect(checked[1].reviewedAt).toBeUndefined()
    expect(dayScoreLabel(checked[0])).toBe('8/9')
    expect(dateReviewStatus([{ date: '2026-09-21', pageCount: 8, dayRanges: checked }], '2026-09-21')).toBe(
      'all'
    )
    expect(dateReviewStatus([{ date: '2026-09-21', pageCount: 8, dayRanges: checked }], '2026-09-22')).toBe(
      'none'
    )
  })

  it('keeps parent review notes when a later day is split', () => {
    const one = setDayReview(
      rangesFromStartPages([1], '2026-09-21', 6),
      '2026-09-21',
      { reviewed: true, questionCount: 9, correctCount: 8 },
      '2026-09-21T18:00:00.000Z'
    )
    const split = toggleStartPage(one, 4, 6)
    expect(split[0]).toMatchObject({
      date: '2026-09-21',
      startPage: 1,
      endPage: 3,
      reviewedAt: '2026-09-21T18:00:00.000Z',
      questionCount: 9,
      correctCount: 8
    })
    expect(split[1].reviewedAt).toBeUndefined()
    expect(split[1].questionCount).toBeUndefined()
  })

  it('round-trips parent review fields from saved packet days', () => {
    const parsed = parsePacketDays(
      [
        {
          date: '2026-09-21',
          startPage: 1,
          endPage: 4,
          reviewedAt: '2026-09-21T18:00:00.000Z',
          questionCount: 9,
          correctCount: 8
        },
        { date: '2026-09-22', startPage: 5, endPage: 8 }
      ],
      '2026-09-21',
      8
    )
    expect(parsed[0]).toMatchObject({
      reviewedAt: '2026-09-21T18:00:00.000Z',
      questionCount: 9,
      correctCount: 8
    })
    expect(parsed[1].reviewedAt).toBeUndefined()
  })

  it('clamps a score to the question count and drops a score with no questions', () => {
    const ranges = rangesFromStartPages([1], '2026-09-21', 4)
    const tooHigh = setDayReview(ranges, '2026-09-21', { questionCount: 9, correctCount: 12 })
    expect(tooHigh[0]).toMatchObject({ questionCount: 9, correctCount: 9 })
    const cleared = setDayReview(tooHigh, '2026-09-21', { questionCount: null })
    expect(cleared[0].questionCount).toBeUndefined()
    expect(cleared[0].correctCount).toBeUndefined()
  })

  it('splits a packet into day files only after more than one day or an overview is confirmed', () => {
    expect(shouldMaterializePacket([{ date: '2026-10-12' }], 0, 'worksheet')).toBe(false)
    expect(shouldMaterializePacket([{ date: '2026-10-12' }, { date: '2026-10-13' }], 0)).toBe(true)
    expect(shouldMaterializePacket([{ date: '2026-10-12' }], 2)).toBe(true)
    expect(shouldMaterializePacket([{ date: '2026-10-12' }, { date: '2026-10-13' }], 2, 'packet')).toBe(false)
    expect(shouldMaterializePacket([{ date: '2026-10-12' }], 2, 'day')).toBe(false)
  })

  it('shows one day of an unsplit packet without pulling in the other days', () => {
    const packet = {
      date: '2026-10-12',
      pageCount: 16,
      dayRanges: [
        { date: '2026-10-12', startPage: 1, endPage: 4 },
        { date: '2026-10-13', startPage: 5, endPage: 8 },
        { date: '2026-10-14', startPage: 9, endPage: 12 },
        { date: '2026-10-15', startPage: 13, endPage: 16 }
      ]
    }
    expect(appearsOnDate(packet, '2026-10-15')).toBe(true)
    expect(appearsOnDate(packet, '2026-10-16')).toBe(false)
    expect(rangeForDate(packet, '2026-10-15')).toMatchObject({ startPage: 13, endPage: 16 })
    expect(pageSpanLabel(rangeForDate(packet, '2026-10-15')!)).toBe('pp. 13–16')
    expect(packetDayLabel(packet.dayRanges, '2026-10-15')).toBe('Day 4 of 4')
  })
})
