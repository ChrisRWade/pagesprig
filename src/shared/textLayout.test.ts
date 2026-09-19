import { describe, expect, it } from 'vitest'
import { textPadX, textPadY, wrapTextLines } from './textLayout'

describe('text layout', () => {
  it('pads 16px type with 4×2 like the type overlay', () => {
    expect(textPadX(16)).toBe(4)
    expect(textPadY(16)).toBe(2)
  })

  it('keeps newlines and wraps on spaces', () => {
    const measure = (value: string) => value.length * 10
    expect(wrapTextLines('one two\nthree', 50, measure)).toEqual(['one', 'two', 'three'])
  })

  it('splits a token that cannot fit the line', () => {
    const measure = (value: string) => value.length * 10
    expect(wrapTextLines('abcdefghij', 40, measure)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('preserves an empty line between paragraphs', () => {
    const measure = (value: string) => value.length
    expect(wrapTextLines('a\n\nb', 80, measure)).toEqual(['a', '', 'b'])
  })
})
