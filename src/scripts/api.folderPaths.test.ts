import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { FETCH_RESPONSE_HEADERS_TIMEOUT_MS } from '@comfyorg/api-client/apiTimeouts'

import { api } from '@/scripts/api'

vi.mock(import('axios'))

describe('getFolderPaths', () => {
  it('returns legacy API response when available', async () => {
    const mockResponse = { checkpoints: ['/test/checkpoints'] }
    vi.mocked(axios.get).mockResolvedValueOnce({ data: mockResponse })

    const result = await api.getFolderPaths()

    expect(result).toEqual(mockResponse)
  })

  it('returns empty object when legacy API unavailable (dynamic discovery)', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error())

    const result = await api.getFolderPaths()

    // With dynamic discovery, we don't pre-generate directories when API is unavailable
    expect(result).toEqual({})
  })

  it('bounds the request and cancels it with the caller signal', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: {} })
    const { signal } = new AbortController()

    await api.getFolderPaths({ signal })

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/folder_paths$/),
      {
        signal,
        timeout: FETCH_RESPONSE_HEADERS_TIMEOUT_MS
      }
    )
  })

  it('rejects when the caller aborts the request', async () => {
    const controller = new AbortController()
    const canceled = new Error('canceled')
    vi.mocked(axios.get).mockImplementationOnce(async () => {
      controller.abort()
      throw canceled
    })

    await expect(
      api.getFolderPaths({ signal: controller.signal })
    ).rejects.toBe(canceled)
  })
})
