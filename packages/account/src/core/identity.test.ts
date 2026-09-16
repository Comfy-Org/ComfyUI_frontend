import { describe, expect, it } from 'vitest'

import type { AccountIdentity } from './identity.js'
import { brandIdentity, identityBrand } from './identity.js'

describe('identity brand', () => {
  it('is minted only by brandIdentity; a hand-rolled port is not an AccountIdentity', () => {
    const port = { onUserChanged: () => () => undefined }
    // @ts-expect-error an unbranded port is not an AccountIdentity
    const unbranded: AccountIdentity = port
    const branded: AccountIdentity = brandIdentity(port)

    expect(branded[identityBrand]).toBe(true)
    expect(branded.onUserChanged).toBe(port.onUserChanged)
    expect(identityBrand in unbranded).toBe(false)
  })
})
