import { describe, expect, it } from 'vitest'

import { getProviderLabel, getProviderLogo } from './providers'

import type { SecretProvider } from './types'

describe('secret providers', () => {
  it('returns empty display values when provider is missing', () => {
    expect(getProviderLabel(undefined)).toBe('')
    expect(getProviderLogo(undefined)).toBeUndefined()
  })

  it('returns configured labels and logos', () => {
    expect(getProviderLabel('huggingface')).toBe('HuggingFace')
    expect(getProviderLogo('civitai')).toBe('/assets/images/civitai.svg')
  })

  it('falls back to the provider value for unknown labels', () => {
    const provider = 'custom' as SecretProvider

    expect(getProviderLabel(provider)).toBe('custom')
    expect(getProviderLogo(provider)).toBeUndefined()
  })
})
