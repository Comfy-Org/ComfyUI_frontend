import { describe, expect, it } from 'vitest'

import { PRICING_URL, buildPricingFact } from './model-pricing'

describe('buildPricingFact', () => {
  it('deep-links a mapped partner model to its provider section', () => {
    expect(buildPricingFact('wan-api', true)).toContain(`${PRICING_URL}#wan`)
    expect(buildPricingFact('grok-imagine', true)).toContain(
      `${PRICING_URL}#xai`
    )
  })

  it('falls back to the table root for unmapped partner models', () => {
    const fact = buildPricingFact('stability-ai', true)
    expect(fact).toContain(PRICING_URL)
    expect(fact).not.toContain('#')
  })

  it('points open-source models at the Cloud GPU rate and notes local is free', () => {
    const fact = buildPricingFact('flux-1-dev', false)
    expect(fact).toContain(`${PRICING_URL}#cloud-gpu`)
    expect(fact).toContain('free to run locally')
  })
})
