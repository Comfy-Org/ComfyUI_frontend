import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as downloadApi from '../api/modelDownloadApi'
import type { HostCredentialUpsert, HostCredentialView } from '../types'
import { useHostCredentialsStore } from './hostCredentialsStore'

vi.mock('../api/modelDownloadApi', () => ({
  listCredentials: vi.fn(),
  upsertCredential: vi.fn(),
  deleteCredential: vi.fn()
}))

function createCredential(
  overrides: Partial<HostCredentialView> = {}
): HostCredentialView {
  return {
    id: 'c1',
    host: 'huggingface.co',
    auth_scheme: 'bearer',
    header_name: null,
    query_param: null,
    label: null,
    match_subdomains: false,
    enabled: true,
    secret_last4: '1234',
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

describe('useHostCredentialsStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetAllMocks()
  })

  describe('fetchCredentials', () => {
    it('toggles isLoading and stores the result', async () => {
      const credential = createCredential()
      vi.mocked(downloadApi.listCredentials).mockResolvedValue([credential])
      const store = useHostCredentialsStore()

      const promise = store.fetchCredentials()
      expect(store.isLoading).toBe(true)
      await promise

      expect(store.isLoading).toBe(false)
      expect(store.credentials).toEqual([credential])
    })

    it('clears isLoading even when the request fails', async () => {
      vi.mocked(downloadApi.listCredentials).mockRejectedValue(
        new Error('boom')
      )
      const store = useHostCredentialsStore()

      await expect(store.fetchCredentials()).rejects.toThrow('boom')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('upsert', () => {
    it('normalizes the host and appends a new credential', async () => {
      const created = createCredential({ id: 'new', host: 'huggingface.co' })
      vi.mocked(downloadApi.upsertCredential).mockResolvedValue(created)
      const store = useHostCredentialsStore()
      const body: HostCredentialUpsert = {
        host: '  HuggingFace.co  ',
        secret: 's3cret'
      }

      const result = await store.upsert(body)

      expect(downloadApi.upsertCredential).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'huggingface.co', secret: 's3cret' })
      )
      expect(result).toEqual(created)
      expect(store.credentials).toEqual([created])
    })

    it('replaces an existing credential by id', async () => {
      const original = createCredential({ id: 'c1', label: 'Old' })
      const updated = createCredential({ id: 'c1', label: 'New' })
      vi.mocked(downloadApi.upsertCredential).mockResolvedValue(updated)
      const store = useHostCredentialsStore()
      store.credentials.push(original)

      await store.upsert({ host: 'huggingface.co', secret: 's' })

      expect(store.credentials).toEqual([updated])
    })
  })

  describe('remove', () => {
    it('deletes and filters out the credential by id', async () => {
      vi.mocked(downloadApi.deleteCredential).mockResolvedValue(undefined)
      const store = useHostCredentialsStore()
      store.credentials.push(
        createCredential({ id: 'c1' }),
        createCredential({ id: 'c2' })
      )

      await store.remove('c1')

      expect(downloadApi.deleteCredential).toHaveBeenCalledWith('c1')
      expect(store.credentials.map((c) => c.id)).toEqual(['c2'])
    })
  })

  describe('enabledCredentialForHost', () => {
    it('matches an exact enabled host case-insensitively', () => {
      const store = useHostCredentialsStore()
      store.credentials.push(
        createCredential({ host: 'HuggingFace.co', enabled: true })
      )

      expect(store.enabledCredentialForHost('huggingface.co')?.host).toBe(
        'HuggingFace.co'
      )
    })

    it('returns undefined for a disabled exact match', () => {
      const store = useHostCredentialsStore()
      store.credentials.push(
        createCredential({ host: 'huggingface.co', enabled: false })
      )

      expect(store.enabledCredentialForHost('huggingface.co')).toBeUndefined()
    })

    it('falls back to a subdomain match only when match_subdomains is set', () => {
      const store = useHostCredentialsStore()
      store.credentials.push(
        createCredential({
          host: 'huggingface.co',
          match_subdomains: true,
          enabled: true
        })
      )

      expect(store.enabledCredentialForHost('cdn.huggingface.co')?.host).toBe(
        'huggingface.co'
      )
    })

    it('does not subdomain-match when match_subdomains is false', () => {
      const store = useHostCredentialsStore()
      store.credentials.push(
        createCredential({
          host: 'huggingface.co',
          match_subdomains: false,
          enabled: true
        })
      )

      expect(
        store.enabledCredentialForHost('cdn.huggingface.co')
      ).toBeUndefined()
    })

    it('returns undefined when no host matches', () => {
      const store = useHostCredentialsStore()
      expect(store.enabledCredentialForHost('example.com')).toBeUndefined()
    })
  })
})
