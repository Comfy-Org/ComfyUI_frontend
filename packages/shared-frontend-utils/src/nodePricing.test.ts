import { zPriceBadge } from '@comfyorg/object-info-parser'
import { describe, expect, it } from 'vitest'

import { evaluatePricingContext } from './nodePricing'

describe('evaluatePricingContext', () => {
  it('keeps a range and its per-second unit instead of presenting a run total', async () => {
    const badge = zPriceBadge.parse({
      expr: '{"type":"range_usd","min_usd":0.05,"max_usd":0.10,"format":{"suffix":"/sec","approximate":true}}'
    })
    expect(
      await evaluatePricingContext('VideoRange', badge, {
        widgets: {},
        inputs: {},
        inputGroups: {}
      })
    ).toBe('~10.6-21.1 credits/sec')
  })

  it('reevaluates the same compiled rule for different model settings and media inputs', async () => {
    const badge = zPriceBadge.parse({
      expr: '{"type":"usd","usd":widgets.duration * 0.05 + (inputs.image.connected ? 0.01 : 0)}',
      depends_on: {
        widgets: [{ name: 'duration', type: 'INT' }],
        inputs: ['image']
      }
    })
    expect(
      await evaluatePricingContext('VideoSettings', badge, {
        widgets: { duration: 1 },
        inputs: { image: { connected: false } },
        inputGroups: {}
      })
    ).toBe('10.6 credits/Run')
    expect(
      await evaluatePricingContext('VideoSettings', badge, {
        widgets: { duration: 6 },
        inputs: { image: { connected: true } },
        inputGroups: {}
      })
    ).toBe('65.4 credits/Run')
  })

  it.for(['(', '$error("unavailable")', '{"type":"unexpected","usd":10}'])(
    'does not display a fabricated price for an invalid rule: %s',
    async (expr) => {
      expect(
        await evaluatePricingContext(
          `Invalid:${expr}`,
          zPriceBadge.parse({ expr }),
          {
            widgets: {},
            inputs: {},
            inputGroups: {}
          }
        )
      ).toBe('')
    }
  )
})
