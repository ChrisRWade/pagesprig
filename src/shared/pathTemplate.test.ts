import { describe, expect, it } from 'vitest'
import { applyTemplate, sanitizePathSegment, templateContext, uniqueName } from './pathTemplate'

describe('path templates', () => {
  it('builds the default schoolwork folder layout', () => {
    const context = templateContext({
      student: 'Alex',
      subject: 'Math',
      originalName: 'Fractions Practice.pdf',
      date: '2026-09-16'
    })
    expect(applyTemplate('{student}/{year}/{month}/{date}/{subject}', context)).toBe(
      'Alex/2026/09/2026-09-16/Math'
    )
    expect(applyTemplate('{date} - {subject} - {originalName}', context)).toBe(
      '2026-09-16 - Math - Fractions Practice'
    )
  })

  it('strips characters that are illegal on Windows', () => {
    expect(sanitizePathSegment('Math: Review <2>')).toBe('Math Review 2')
    expect(sanitizePathSegment('...')).toBe('Untitled')
  })

  it('avoids colliding folder names', () => {
    const existing = new Set(['fractions practice', 'fractions practice (2)'])
    expect(uniqueName(existing, 'Fractions Practice')).toBe('Fractions Practice (3)')
  })
})
