import { describe, expect, it, vi } from 'vitest'
import { simplifyStroke } from './simplify'
import { debounce } from './utils'

describe('stroke simplification', () => {
  it('keeps endpoints and drops colinear jitter', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0.0001 },
      { x: 0.2, y: -0.0001 },
      { x: 0.3, y: 0 }
    ]
    const simplified = simplifyStroke(points, 0.001)
    expect(simplified[0]).toEqual(points[0])
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1])
    expect(simplified.length).toBeLessThan(points.length)
  })

  it('preserves a genuine corner', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.2, y: 0 },
      { x: 0.2, y: 0.3 }
    ]
    expect(simplifyStroke(points, 0.001)).toHaveLength(3)
  })
})

describe('autosave debounce', () => {
  it('only writes after edits settle', () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const debounced = debounce(write, 350)
    debounced()
    debounced()
    debounced()
    expect(write).not.toHaveBeenCalled()
    vi.advanceTimersByTime(349)
    expect(write).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(write).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
