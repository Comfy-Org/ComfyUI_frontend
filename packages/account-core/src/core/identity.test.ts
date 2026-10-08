import { describe, expect, it } from 'vitest'

import { EXCHANGE_URL, memoryStorage } from './__fixtures__/sessionFakes.js'
import type { AccountIdentity } from './identity.js'
import { brandIdentity, identityBrand } from './identity.js'
import { createSessionClient } from './session.js'

describe('identity brand', () => {
  it('an unbranded port is a compile error and brandIdentity stamps the brand without mutating its input', () => {
    const port = { onUserChanged: () => () => undefined }
    // @ts-expect-error an unbranded port is not an AccountIdentity
    const unbranded: AccountIdentity = port
    const branded: AccountIdentity = brandIdentity(port)
    const client = createSessionClient(
      { exchangeUrl: EXCHANGE_URL, storage: memoryStorage() },
      // @ts-expect-error createSessionClient takes only a branded identity
      port
    )
    client.dispose()

    expect(branded[identityBrand]).toBe(true)
    expect(branded.onUserChanged).toBe(port.onUserChanged)
    expect(identityBrand in unbranded).toBe(false)
  })
})
