import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PROVIDER_IDS,
  getProviderHelpKey,
  getProviderLabel,
  getProviderLogo
} from './providers'

describe('secret provider registry', () => {
  it('maps known providers (including BYOK) to display labels', () => {
    expect(getProviderLabel('huggingface')).toBe('HuggingFace')
    expect(getProviderLabel('civitai')).toBe('Civitai')
    expect(getProviderLabel('runway')).toBe('Runway')
    expect(getProviderLabel('gemini')).toBe('Google Gemini')
  })

  it('maps known providers to logos under public/assets/images', () => {
    expect(getProviderLogo('huggingface')).toBe('/assets/images/hf-logo.svg')
    expect(getProviderLogo('civitai')).toBe('/assets/images/civitai.svg')
    expect(getProviderLogo('runway')).toBe('/assets/images/runway.svg')
    expect(getProviderLogo('gemini')).toBe('/assets/images/gemini.svg')
  })

  it('exposes per-provider help keys for the BYOK providers', () => {
    expect(getProviderHelpKey('runway')).toBe('secrets.providerHelp.runway')
    expect(getProviderHelpKey('gemini')).toBe('secrets.providerHelp.gemini')
    // Model-download providers reuse the generic hint (no dedicated help key).
    expect(getProviderHelpKey('huggingface')).toBeUndefined()
    expect(getProviderHelpKey('civitai')).toBeUndefined()
  })

  it('falls back to the raw id with no logo/help for unknown providers', () => {
    // A provider added server-side but absent from the registry still renders.
    expect(getProviderLabel('brand-new-provider')).toBe('brand-new-provider')
    expect(getProviderLogo('brand-new-provider')).toBeUndefined()
    expect(getProviderHelpKey('brand-new-provider')).toBeUndefined()
  })

  it('returns an empty label and no logo for an undefined provider', () => {
    expect(getProviderLabel(undefined)).toBe('')
    expect(getProviderLogo(undefined)).toBeUndefined()
    expect(getProviderHelpKey(undefined)).toBeUndefined()
  })

  it('keeps the not-loaded fallback list to the pre-BYOK baseline', () => {
    // Defaults are a transient placeholder only; the authoritative list is the
    // server response. They must not silently include BYOK providers.
    expect([...DEFAULT_PROVIDER_IDS]).toEqual(['huggingface', 'civitai'])
  })
})
