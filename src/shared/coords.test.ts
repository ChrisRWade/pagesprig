import { describe, expect, it } from 'vitest'
import {
  normalizedToPdf,
  normalizedToScreen,
  pdfLengthToScreen,
  pdfToNormalized,
  screenLengthToPdf,
  screenToNormalized
} from './coords'

const page = { width: 612, height: 792 }
const rendered = { width: 1224, height: 1584 }

describe('coordinate transforms', () => {
  it('maps the top-left corner through screen, normalized, and PDF space', () => {
    const normalized = screenToNormalized(0, 0, rendered)
    expect(normalized).toEqual({ x: 0, y: 0 })
    expect(normalizedToPdf(normalized, page)).toEqual({ x: 0, y: 792 })
    expect(normalizedToScreen(normalized, rendered)).toEqual({ x: 0, y: 0 })
  })

  it('maps the bottom-right corner', () => {
    const normalized = screenToNormalized(1224, 1584, rendered)
    expect(normalized).toEqual({ x: 1, y: 1 })
    expect(normalizedToPdf(normalized, page)).toEqual({ x: 612, y: 0 })
  })

  it('keeps annotations aligned when zoom changes rendered size', () => {
    const zoomed = { width: 612, height: 792 }
    const point = { x: 0.25, y: 0.4 }
    const at100 = normalizedToScreen(point, rendered)
    const at50 = normalizedToScreen(point, zoomed)
    expect(at100.x / rendered.width).toBeCloseTo(at50.x / zoomed.width)
    expect(at100.y / rendered.height).toBeCloseTo(at50.y / zoomed.height)
  })

  it('round-trips PDF points through normalized coordinates', () => {
    const original = { x: 153, y: 396 }
    const normalized = pdfToNormalized(original, page)
    const back = normalizedToPdf(normalized, page)
    expect(back.x).toBeCloseTo(original.x)
    expect(back.y).toBeCloseTo(original.y)
  })

  it('scales stroke width with the page render size', () => {
    const pdfWidth = 2
    const screen = pdfLengthToScreen(pdfWidth, page, rendered)
    expect(screen).toBeCloseTo(4)
    expect(screenLengthToPdf(screen, page, rendered)).toBeCloseTo(2)
  })

  it('clamps out-of-page pointer positions', () => {
    expect(screenToNormalized(-20, 3000, rendered)).toEqual({ x: 0, y: 1 })
  })
})
