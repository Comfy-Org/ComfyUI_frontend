import { zComfyNodeDef, zPriceBadge } from '@comfyorg/object-info-parser'
import { describe, expect, it } from 'vitest'

import {
  evaluateNodeDefPricing,
  evaluatePricingContext,
  formatPricingResult,
  getCompiledRuleForNodeType
} from './nodePricing'

const context = { widgets: {}, inputs: {}, inputGroups: {} }

describe('evaluatePricingContext', () => {
  it('recompiles a changed rule under the same node name', async () => {
    const badge = zPriceBadge.parse({ expr: '{"type":"usd","usd":0.05}' })
    expect(await evaluatePricingContext('RefreshedRule', badge, context)).toBe(
      '10.6 credits/Run'
    )
    badge.expr = '{"type":"usd","usd":0.10}'
    expect(await evaluatePricingContext('RefreshedRule', badge, context)).toBe(
      '21.1 credits/Run'
    )
  })

  it('refreshes dependency metadata even when the expression is unchanged', () => {
    const badge = zPriceBadge.parse({ expr: '{"type":"usd","usd":0.05}' })
    const original = getCompiledRuleForNodeType('RefreshedDependencies', badge)
    const changed = getCompiledRuleForNodeType('RefreshedDependencies', {
      ...badge,
      depends_on: { ...badge.depends_on, inputs: ['image'] }
    })
    expect(changed).not.toBe(original)
    expect(changed?.depends_on.inputs).toEqual(['image'])
  })

  it('honors the list separator in both value-only and complete labels', () => {
    const result = {
      type: 'list_usd',
      usd: [0.05, 0.1],
      format: { separator: ' or ', approximate: true }
    }
    expect(formatPricingResult(result, { valueOnly: true })).toBe(
      '~10.6 or 21.1'
    )
    expect(formatPricingResult(result)).toBe('~10.6 or 21.1 credits/Run')
  })
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

describe('default node pricing', () => {
  function nodeDefinition() {
    return zComfyNodeDef.parse({
      name: 'ReloadedDefaults',
      display_name: 'Reloaded defaults',
      description: '',
      category: 'test',
      output_node: false,
      python_module: 'test',
      input: { required: { count: ['INT', { default: 1 }] } },
      price_badge: {
        expr: '{"type":"usd","usd":widgets.count * 0.05}',
        depends_on: { widgets: [{ name: 'count', type: 'INT' }] }
      }
    })
  }

  it('recalculates after a default or rule changes on the same definition', async () => {
    const node = nodeDefinition()
    expect(await evaluateNodeDefPricing(node)).toBe('10.6')
    node.input = { required: { count: ['INT', { default: 2 }] } }
    expect(await evaluateNodeDefPricing(node)).toBe('21.1')
    node.price_badge = zPriceBadge.parse({ expr: '{"type":"usd","usd":0.20}' })
    expect(await evaluateNodeDefPricing(node)).toBe('42.2')
  })

  it.for(['COMBO', 'INT', 'FLOAT', 'BOOLEAN'])(
    'withholds estimates when a %s dependency has no usable default',
    async (type) => {
      const node = nodeDefinition()
      node.input = { required: {} }
      node.price_badge = zPriceBadge.parse({
        expr: '{"type":"usd","usd":widgets.resolution = "original" ? 0.05 : 0.10}',
        depends_on: { widgets: [{ name: 'resolution', type }] }
      })
      expect(await evaluateNodeDefPricing(node)).toBe('')
    }
  )
})
