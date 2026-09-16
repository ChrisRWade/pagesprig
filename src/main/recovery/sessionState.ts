import type { SessionState } from '@shared/types'
import { nowIso } from '@shared/utils'

export const SESSION_VERSION = 1

export function emptySession(): SessionState {
  return {
    version: SESSION_VERSION,
    dirty: false,
    openDocumentIds: [],
    activeDocumentId: null,
    updatedAt: nowIso()
  }
}

export function shouldOfferRecovery(session: SessionState): boolean {
  return session.dirty && session.openDocumentIds.length > 0
}
