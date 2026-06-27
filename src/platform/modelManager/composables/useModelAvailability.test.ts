import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as downloadApi from '../api/modelDownloadApi'
import { useModelAvailability } from './useModelAvailability'

vi.mock('../api/modelDownloadApi', () => ({
  checkAvailability: vi.fn()
}))

describe('useModelAvailability', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('short-circuits without calling the API for an empty map', async () => {
    const { check, results } = useModelAvailability()

    await check({})

    expect(downloadApi.checkAvailability).not.toHaveBeenCalled()
    expect(results.value).toEqual({})
  })

  it('stores the availability map from the response', async () => {
    vi.mocked(downloadApi.checkAvailability).mockResolvedValue({
      models: {
        'loras/x.safetensors': { state: 'available', url_allowed: true }
      }
    })
    const { check, results, isChecking } = useModelAvailability()

    await check({ 'loras/x.safetensors': 'https://h.co/x' })

    expect(results.value['loras/x.safetensors']).toEqual({
      state: 'available',
      url_allowed: true
    })
    expect(isChecking.value).toBe(false)
  })

  it('captures errors and resets the checking flag', async () => {
    vi.mocked(downloadApi.checkAvailability).mockRejectedValue(
      new Error('boom')
    )
    const { check, error, isChecking } = useModelAvailability()

    await expect(check({ 'loras/x.safetensors': 'u' })).rejects.toThrow('boom')
    expect(error.value).toBeInstanceOf(Error)
    expect(isChecking.value).toBe(false)
  })
})
