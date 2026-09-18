import type { DocumentProject } from './types'

export function mergePersistedProject(
  local: DocumentProject,
  persisted: DocumentProject,
  localRevision: number,
  persistedRevision: number
): { project: DocumentProject; caughtUp: boolean } {
  if (localRevision !== persistedRevision) {
    return {
      caughtUp: false,
      project: { ...local, fingerprint: persisted.fingerprint }
    }
  }
  return { caughtUp: true, project: persisted }
}
