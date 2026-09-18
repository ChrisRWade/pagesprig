import { formatTimestamp } from './utils'

export type FinishedPdfState = 'missing' | 'stale' | 'current'

export function finishedPdfState(project: {
  updatedAt: string
  lastExportedAt?: string | null
}): FinishedPdfState {
  if (!project.lastExportedAt) return 'missing'
  return project.lastExportedAt >= project.updatedAt ? 'current' : 'stale'
}

export function finishedPdfLabel(state: FinishedPdfState, exporting = false): string {
  if (exporting) return 'Saving PDF…'
  switch (state) {
    case 'current':
      return 'PDF saved'
    case 'stale':
      return 'PDF needs saving'
    case 'missing':
      return 'PDF not saved'
  }
}

export function finishedPdfTooltip(project: {
  updatedAt: string
  lastExportedAt?: string | null
}): string {
  const marks = `Marks last edited ${formatTimestamp(project.updatedAt)}`
  const pdf = project.lastExportedAt
    ? `Finished PDF saved ${formatTimestamp(project.lastExportedAt)}`
    : 'Finished PDF has not been saved yet'
  return `${marks}. ${pdf}.`
}
