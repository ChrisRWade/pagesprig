import { describe, expect, it } from 'vitest'
import { finishedPdfLabel, finishedPdfState, finishedPdfTooltip } from './exportState'

describe('finished PDF state', () => {
  it('is missing until a finished PDF has been written', () => {
    expect(finishedPdfState({ updatedAt: '2026-09-16T12:00:00.000Z' })).toBe('missing')
    expect(finishedPdfLabel('missing')).toBe('PDF not saved')
  })

  it('is current when the finished PDF is at least as new as the marks', () => {
    expect(
      finishedPdfState({
        updatedAt: '2026-09-16T12:00:00.000Z',
        lastExportedAt: '2026-09-16T12:00:00.000Z'
      })
    ).toBe('current')
    expect(
      finishedPdfState({
        updatedAt: '2026-09-16T12:00:00.000Z',
        lastExportedAt: '2026-09-16T12:05:00.000Z'
      })
    ).toBe('current')
  })

  it('is stale when marks changed after the finished PDF', () => {
    expect(
      finishedPdfState({
        updatedAt: '2026-09-16T12:10:00.000Z',
        lastExportedAt: '2026-09-16T12:00:00.000Z'
      })
    ).toBe('stale')
    expect(finishedPdfLabel('stale')).toBe('PDF needs saving')
  })

  it('explains both timestamps in the tooltip', () => {
    const tip = finishedPdfTooltip({
      updatedAt: '2026-09-16T12:10:00.000Z',
      lastExportedAt: '2026-09-16T12:00:00.000Z'
    })
    expect(tip).toContain('Marks last edited')
    expect(tip).toContain('Finished PDF saved')
  })
})
