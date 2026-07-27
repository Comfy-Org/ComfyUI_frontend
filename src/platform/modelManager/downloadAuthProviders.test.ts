import { describe, expect, it } from 'vitest'

import {
  DOWNLOAD_PROVIDER_CONFIGS,
  envExportSnippet,
  getProviderConfig,
  providerForHost,
  providerForUrl
} from './downloadAuthProviders'

describe('downloadAuthProviders', () => {
  it('exposes a config for every provider with a primary env var', () => {
    expect(DOWNLOAD_PROVIDER_CONFIGS.map((c) => c.id)).toEqual([
      'huggingface',
      'civitai'
    ])
    for (const config of DOWNLOAD_PROVIDER_CONFIGS) {
      expect(config.envVars.length).toBeGreaterThan(0)
    }
  })

  describe('providerForHost', () => {
    it('matches the exact host case-insensitively', () => {
      expect(providerForHost('HuggingFace.co')).toBe('huggingface')
      expect(providerForHost('civitai.com')).toBe('civitai')
    })

    it('matches subdomains of a provider host', () => {
      expect(providerForHost('cdn-lfs.huggingface.co')).toBe('huggingface')
    })

    it('returns undefined for unknown or empty hosts', () => {
      expect(providerForHost('example.com')).toBeUndefined()
      expect(providerForHost('')).toBeUndefined()
      expect(providerForHost(null)).toBeUndefined()
    })

    it('does not match a lookalike host that merely contains the base', () => {
      expect(providerForHost('nothuggingface.co')).toBeUndefined()
    })
  })

  describe('providerForUrl', () => {
    it('derives the provider from a full url', () => {
      expect(
        providerForUrl('https://huggingface.co/org/repo/model.safetensors')
      ).toBe('huggingface')
    })

    it('returns undefined for an unparseable url', () => {
      expect(providerForUrl('not a url')).toBeUndefined()
    })
  })

  describe('envExportSnippet', () => {
    it('uses the primary env var and a provider-appropriate placeholder', () => {
      expect(envExportSnippet('huggingface')).toBe('export HF_TOKEN="hf_xxx"')
      expect(envExportSnippet('civitai')).toBe(
        'export CIVITAI_API_TOKEN="xxxx"'
      )
    })
  })

  it('reports gated capability per provider', () => {
    expect(getProviderConfig('huggingface').canBeGated).toBe(true)
    expect(getProviderConfig('civitai').canBeGated).toBe(false)
  })
})
