import { describe, expect, it } from 'vitest'

import type { BackendTicket } from './pendingServerFact'
import { pendingServerFact } from './pendingServerFact'

describe('pendingServerFact', () => {
  it('only accepts a backend ticket identifier', () => {
    const ticket: BackendTicket = 'BE-1234'
    // @ts-expect-error a frontend ticket cannot bridge a server fact
    pendingServerFact('FE-1234', 0)
    // @ts-expect-error a ticket needs its team prefix
    pendingServerFact('1234', 0)

    expect(pendingServerFact(ticket, 0)).toBe(0)
  })
})
