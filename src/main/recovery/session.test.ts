import { describe, expect, it } from 'vitest'
import { emptySession, shouldOfferRecovery } from './sessionState'

describe('crash recovery', () => {
  it('offers recovery only when the last session did not exit cleanly', () => {
    expect(shouldOfferRecovery(emptySession())).toBe(false)
    expect(
      shouldOfferRecovery({
        version: 1,
        dirty: true,
        openDocumentIds: ['doc-1'],
        activeDocumentId: 'doc-1',
        updatedAt: new Date().toISOString()
      })
    ).toBe(true)
    expect(
      shouldOfferRecovery({
        version: 1,
        dirty: true,
        openDocumentIds: [],
        activeDocumentId: null,
        updatedAt: new Date().toISOString()
      })
    ).toBe(false)
  })
})
