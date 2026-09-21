import { describe, expect, it } from 'vitest'

import { resolveRecordPrefill } from './recordPrefill'

describe('resolveRecordPrefill', () => {
  it('maps valid record flags to prompt-skipping options', () => {
    const result = resolveRecordPrefill({
      distribution: 'cloud-staging',
      workflow: 'default',
      tags: '@canvas,@widget',
      'feature-flags': 'linear_toggle_enabled:true,count:2',
      'use-case': 'test-plan-step',
      description: 'seed stays fixed across runs',
      name: 'fixed-seed'
    })

    expect(result).toMatchObject({
      distribution: { id: 'cloud-staging' },
      distributionSource: '--distribution',
      workflow: 'default',
      tags: ['@canvas', '@widget'],
      featureFlags: { linear_toggle_enabled: true, count: 2 },
      useCase: { id: 'test-plan-step' },
      description: 'seed stays fixed across runs',
      name: 'fixed-seed',
      warnings: []
    })
  })

  it('drops invalid values and returns warnings for interactive fallback', () => {
    const result = resolveRecordPrefill({
      distribution: 'moon',
      tags: 'not-a-tag',
      'use-case': 'other',
      description: '---',
      name: '---'
    })

    expect(result.distribution).toBeUndefined()
    expect(result.tags).toBeUndefined()
    expect(result.useCase).toBeUndefined()
    expect(result.description).toBeUndefined()
    expect(result.name).toBeUndefined()
    expect(result.warnings).toHaveLength(5)
  })

  it('normalizes a custom backend and makes it the distribution', () => {
    expect(resolveRecordPrefill({ backend: 'agent.comfy.org' })).toMatchObject({
      distribution: {
        id: 'custom',
        backendUrl: 'https://agent.comfy.org/'
      },
      distributionSource: '--backend'
    })
  })

  it('keeps a numeric pull request and rejects other values', () => {
    expect(resolveRecordPrefill({ pr: '123' }).pr).toBe('123')
    const invalid = resolveRecordPrefill({ pr: 'abc' })
    expect(invalid.pr).toBeUndefined()
    expect(invalid.warnings).toContain(
      'Invalid --pr "abc": use a pull request number.'
    )
  })
})
