import { describe, expect, it } from 'vitest'

import { providerName } from './provider-name'

describe('providerName', () => {
  it.for([
    ['bfl', 'Black Forest Labs'],
    ['vertexai', 'Google'],
    ['fish-audio-labs', 'Fish Audio Labs'],
    ['constructor', 'Constructor']
  ] as const)('names %s as %s', ([id, name]) => {
    expect(providerName(id)).toBe(name)
  })
})
