import { describe, expect, it, vi } from 'vitest'

import { WORKSHOP_CREDITS_URL } from '../../config/workshop-env'
import { platformTopUpHref } from './buy-credits'

describe('platformTopUpHref', () => {
  it('keeps a lower environment on its own cloud credits page', () => {
    expect(platformTopUpHref('ws_123')).toBe(WORKSHOP_CREDITS_URL)
    expect(platformTopUpHref()).toBe(WORKSHOP_CREDITS_URL)
  })

  it('deep-links production platform billing with the workspace id', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_CLOUD_ENV', 'prod')
    vi.resetModules()
    const { platformTopUpHref: prodHref } = await import('./buy-credits')
    expect(prodHref('ws_123')).toBe(
      'https://platform.comfy.org/billing?workspace=ws_123'
    )
    expect(prodHref()).toBe('https://platform.comfy.org/billing')
  })
})
