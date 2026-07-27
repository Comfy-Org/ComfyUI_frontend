import { describe, expect, it, vi } from 'vitest'

import { endExpiredSession, isSessionTerminated } from './sessionExpiry'

// Its sibling suite pins isCloud true, which makes this guard unreachable there
// and lets a mutation deleting it survive at 100% coverage.
vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

const mockLocation = { href: '', pathname: '/', reload: vi.fn() }
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
})

describe('endExpiredSession off cloud', () => {
  it('does nothing on a non-cloud build', () => {
    endExpiredSession('token revoked')

    expect(mockLocation.href).toBe('')
    expect(isSessionTerminated()).toBe(false)
  })
})
