import { describe, expect, it } from 'vitest'

import {
  customDistribution,
  distributionIds,
  normalizeBackendUrl,
  resolveDistribution
} from './distributions'

describe('resolveDistribution', () => {
  it('defaults to cloud', () => {
    expect(resolveDistribution(undefined)?.id).toBe('cloud')
  })

  it('resolves every registered distribution', () => {
    expect(distributionIds().map((id) => resolveDistribution(id)?.id)).toEqual(
      distributionIds()
    )
  })

  it('rejects an unknown distribution', () => {
    expect(resolveDistribution('unknown')).toBeUndefined()
  })
})

describe('normalizeBackendUrl', () => {
  it.for([
    ['agent.comfy.org', 'https://agent.comfy.org/'],
    ['https://testcloud.comfy.org/', 'https://testcloud.comfy.org/'],
    [' https://testcloud.comfy.org ', 'https://testcloud.comfy.org/']
  ])('normalizes %s', ([input, expected]) => {
    expect(normalizeBackendUrl(input)).toEqual({ ok: true, url: expected })
  })

  it.for(['garbage', 'ftp://agent.comfy.org', 'not a url'])(
    'rejects %s',
    (input) => {
      expect(normalizeBackendUrl(input).ok).toBe(false)
    }
  )
})

describe('customDistribution', () => {
  it('configures Vite for a remote backend', () => {
    expect(customDistribution('https://agent.comfy.org/')).toMatchObject({
      id: 'custom',
      script: 'dev',
      needsLocalBackend: false,
      backendUrl: 'https://agent.comfy.org/'
    })
  })
})
