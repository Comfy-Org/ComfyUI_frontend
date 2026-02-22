import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getServerCapability,
  initServerCapabilities
} from '@/services/serverCapabilities'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

describe('serverCapabilities', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            supports_preview_metadata: true,
            max_upload_size: 104857600,
            node_replacements: false,
            extension: { manager: { supports_v4: true } }
          })
      })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('initServerCapabilities', () => {
    it('fetches and freezes capabilities on success', async () => {
      await initServerCapabilities()

      expect(getServerCapability('supports_preview_metadata')).toBe(true)
      expect(getServerCapability('max_upload_size')).toBe(104857600)
    })

    it('retries and falls back to empty object on persistent failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await initServerCapabilities()

      expect(fetch).toHaveBeenCalledTimes(3)
      expect(getServerCapability('supports_preview_metadata')).toBeUndefined()
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to fetch server capabilities after retries'
      )
    })

    it('succeeds on retry after initial failure', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ supports_preview_metadata: true })
        } as Response)

      await initServerCapabilities()

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(getServerCapability('supports_preview_metadata')).toBe(true)
    })

    it('falls back to empty object on persistent non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({})
      } as Response)

      await initServerCapabilities()

      expect(fetch).toHaveBeenCalledTimes(3)
      expect(getServerCapability('supports_preview_metadata')).toBeUndefined()
    })
  })

  describe('getServerCapability', () => {
    it('returns default value when called before init', () => {
      expect(getServerCapability('some_key', 'fallback')).toBe('fallback')
    })

    beforeEach(async () => {
      await initServerCapabilities()
    })

    it('returns value for existing key', () => {
      expect(getServerCapability('supports_preview_metadata')).toBe(true)
    })

    it('returns default value for missing key', () => {
      expect(getServerCapability('non_existent', 'fallback')).toBe('fallback')
    })

    it('supports dot notation for nested values', () => {
      expect(getServerCapability('extension.manager.supports_v4')).toBe(true)
    })

    it('returns undefined for missing key with no default', () => {
      expect(getServerCapability('missing_key')).toBeUndefined()
    })
  })

  describe('dev override via localStorage', () => {
    beforeEach(async () => {
      await initServerCapabilities()
    })

    afterEach(() => {
      localStorage.clear()
    })

    it('returns localStorage override over server value', () => {
      localStorage.setItem('ff:supports_preview_metadata', 'false')
      expect(getServerCapability('supports_preview_metadata')).toBe(false)
    })

    it('falls through to server value when no override is set', () => {
      expect(getServerCapability('supports_preview_metadata')).toBe(true)
    })

    it('override works with numeric values', () => {
      localStorage.setItem('ff:max_upload_size', '999')
      expect(getServerCapability('max_upload_size')).toBe(999)
    })
  })
})
