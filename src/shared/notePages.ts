import { nowIso } from './utils'
import type { DocumentProject, PageSource } from './types'

export const NOTE_PAGE_SOURCES = ['blank', 'lined', 'graph', 'dot'] as const
export type NotePageSource = (typeof NOTE_PAGE_SOURCES)[number]

export function isNotePageSource(source: PageSource): source is NotePageSource {
  return source !== 'original'
}

export function isNotePageSourceValue(value: string): value is NotePageSource {
  return (NOTE_PAGE_SOURCES as readonly string[]).includes(value)
}

export function removeNotePageFromProject(project: DocumentProject, pageNumber: number): DocumentProject {
  const spec = project.pages.find((item) => item.page === pageNumber)
  if (!spec) {
    throw new Error('That notes page could not be found.')
  }
  if (!isNotePageSource(spec.source)) {
    throw new Error('The original worksheet page cannot be removed.')
  }
  if (project.pages.length <= 1) {
    throw new Error('This worksheet needs at least one page.')
  }

  const pages = project.pages
    .filter((item) => item.page !== pageNumber)
    .map((item, index) => ({ ...item, page: index + 1 }))

  const annotations = project.annotations
    .filter((group) => group.page !== pageNumber)
    .map((group) => {
      const page = group.page > pageNumber ? group.page - 1 : group.page
      return {
        page,
        annotations: group.annotations.map((item) => ({ ...item, page }))
      }
    })
    .sort((a, b) => a.page - b.page)

  return {
    ...project,
    pages,
    annotations,
    updatedAt: nowIso()
  }
}
