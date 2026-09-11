import { describe, expect, it } from 'vitest'

import { platformTopUpHref } from './buy-credits'

describe('platformTopUpHref', () => {
  it('carries the server-resolved workspace id', () => {
    expect(platformTopUpHref('ws_123')).toBe(
      'https://platform.comfy.org/billing?workspace=ws_123'
    )
  })

  it('still lands on billing without one', () => {
    expect(platformTopUpHref()).toBe('https://platform.comfy.org/billing')
  })
})
