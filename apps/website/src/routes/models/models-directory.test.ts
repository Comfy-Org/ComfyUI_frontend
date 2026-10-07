import { describe, expect, it } from 'vitest'

import { modelsByProvider } from './models-directory'

const catalogue = [
  { name: 'Seedance 10 Fast', provider: 'ByteDance' },
  { name: 'FLUX 2 Pro', provider: 'Black Forest Labs' },
  { name: 'Seedance 2 Fast', provider: 'ByteDance' },
  { name: 'Unhosted Upscaler' },
  { name: 'FLUX 2 Max', provider: 'Black Forest Labs' },
  { name: 'Veo 3', provider: 'Google' }
]

describe('modelsByProvider', () => {
  it('orders the providers alphabetically', () => {
    expect(
      modelsByProvider(catalogue, 'Other').map((group) => group.provider)
    ).toEqual(['Black Forest Labs', 'ByteDance', 'Google', 'Other'])
  })

  it.for([
    ['Black Forest Labs', ['FLUX 2 Max', 'FLUX 2 Pro']],
    // 10 after 2, as a reader counts them rather than as a string sorts them
    ['ByteDance', ['Seedance 2 Fast', 'Seedance 10 Fast']],
    ['Other', ['Unhosted Upscaler']]
  ] as const)('orders %s by name', ([provider, names]) => {
    const group = modelsByProvider(catalogue, 'Other').find(
      (candidate) => candidate.provider === provider
    )
    expect(group?.models.map((model) => model.name)).toEqual(names)
  })

  it('keeps every model exactly once', () => {
    const grouped = modelsByProvider(catalogue, 'Other').flatMap(
      (group) => group.models
    )
    expect(grouped).toHaveLength(catalogue.length)
    expect(new Set(grouped)).toEqual(new Set(catalogue))
  })

  it('has no groups without models', () => {
    expect(modelsByProvider([], 'Other')).toEqual([])
    expect(
      modelsByProvider(catalogue, 'Other').map((group) => group.models.length)
    ).toEqual([2, 2, 1, 1])
  })
})
