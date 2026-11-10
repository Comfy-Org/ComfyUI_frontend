/**
 * The session client builder. Kept apart from `sessionFakes.ts` so the
 * pure-module suites (credential cache, mint coordinator, state machine) that
 * only need the data fakes do not evaluate the whole client graph.
 */
import type { AccountIdentity, SessionClientOptions } from '#/core/session'
import { createSessionClient } from '#/core/session'

import { EXCHANGE_URL, memoryStorage } from './sessionFakes'

export function makeClient(
  overrides: Partial<SessionClientOptions> = {},
  identity?: AccountIdentity
) {
  const storage = memoryStorage()
  const client = createSessionClient(
    { exchangeUrl: EXCHANGE_URL, storage, ...overrides },
    identity
  )
  return { client, storage }
}
