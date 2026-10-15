import { describe, expect, it } from 'vitest'
import { DEFAULT_FOLDER_TEMPLATE } from './constants'
import {
  catalogSubjectName,
  mergeSubjectCatalog,
  resolveSubjectName,
  subjectFromProjectPath,
  emptySubjectCatalog
} from './subjectCatalog'
import type { Student } from './types'

const abel: Student = {
  id: 'abel-home',
  name: 'Abel',
  avatar: '🦊',
  accentColor: '#2A6F6F',
  subjects: [{ id: 'latin-id', name: 'Latin', color: '#6B3A4A' }],
  createdAt: '2026-10-01T00:00:00.000Z'
}

describe('shared subjects', () => {
  it('reads the subject from the schoolwork path used by the default template', () => {
    const root = 'G:/My Drive/PageSprig'
    const dir = 'G:/My Drive/PageSprig/Abel/2026/10/2026-10-13/Latin/Goal-Setting'
    expect(subjectFromProjectPath(root, dir, DEFAULT_FOLDER_TEMPLATE)).toBe('Latin')
    expect(subjectFromProjectPath('G:\\My Drive\\PageSprig', 'G:\\My Drive\\PageSprig\\Abel\\2026\\10\\2026-10-13\\Science\\Lab', DEFAULT_FOLDER_TEMPLATE)).toBe(
      'Science'
    )
  })

  it('does not treat a day-file folder as a subject', () => {
    const dir = 'G:/My Drive/PageSprig/Abel/2026/10/Fractions/2026-10-12'
    expect(subjectFromProjectPath('G:/My Drive/PageSprig', dir, DEFAULT_FOLDER_TEMPLATE)).toBeNull()
  })

  it('shares one child\'s subjects without erasing another child', () => {
    const existing = mergeSubjectCatalog(emptySubjectCatalog(), [abel])
    const parent: Student = { ...abel, id: 'abel-parent', subjects: [{ id: 'math', name: 'Math', color: '#2A6F6F' }] }
    const lana: Student = { ...abel, id: 'lana', name: 'Lana', subjects: [{ id: 'chem', name: 'Chemistry', color: '#3B6B2F' }] }
    const merged = mergeSubjectCatalog(existing, [parent, lana])
    expect(catalogSubjectName(merged, 'Abel', 'latin-id')).toBe('Latin')
    expect(catalogSubjectName(merged, 'Abel', 'math')).toBe('Math')
    expect(catalogSubjectName(merged, 'Lana', 'chem')).toBe('Chemistry')
    expect(
      resolveSubjectName({
        folderName: 'Abel',
        subjectId: 'latin-id',
        pathSubject: 'Latin',
        catalog: emptySubjectCatalog(),
        localName: null
      })
    ).toBe('Latin')
  })
})
