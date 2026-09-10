import { describe, expect, it } from 'vitest'

import { AccountLayerReadinessTimeoutError } from './seam'

describe('AccountLayerReadinessTimeoutError', () => {
  it('D09-2: exposes a stable typed readiness timeout', () => {
    const error = new AccountLayerReadinessTimeoutError(250)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AccountLayerReadinessTimeoutError')
    expect(error.code).toBe('ACCOUNT_LAYER_READINESS_TIMEOUT')
  })
})
