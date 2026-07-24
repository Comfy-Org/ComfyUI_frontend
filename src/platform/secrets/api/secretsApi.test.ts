import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listSecretProviders } from './secretsApi'

const mockFetchApi = vi.fn()

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: (...args: unknown[]) => mockFetchApi(...args)
  }
}))

function jsonResponse(body: unknown, init: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    ...init
  } as Response
}

describe('listSecretProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests the providers endpoint and returns the provider list', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse({ data: [{ id: 'huggingface' }, { id: 'civitai' }] })
    )

    const providers = await listSecretProviders()

    expect(mockFetchApi).toHaveBeenCalledWith('/secrets/providers')
    expect(providers).toEqual([{ id: 'huggingface' }, { id: 'civitai' }])
  })

  it('passes through per-provider input_type and label metadata', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse({
        data: [
          { id: 'gemini', input_type: 'json_file', label: 'Gemini (Vertex)' }
        ]
      })
    )

    const providers = await listSecretProviders()

    expect(providers).toEqual([
      { id: 'gemini', input_type: 'json_file', label: 'Gemini (Vertex)' }
    ])
  })

  it('returns an empty list when data is missing', async () => {
    mockFetchApi.mockResolvedValue(jsonResponse({}))

    const providers = await listSecretProviders()

    expect(providers).toEqual([])
  })

  it('throws SecretsApiError on a failed response', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse(
        { message: 'unavailable' },
        { ok: false, status: 503, statusText: 'Service Unavailable' }
      )
    )

    await expect(listSecretProviders()).rejects.toMatchObject({
      name: 'SecretsApiError',
      status: 503,
      message: 'unavailable'
    })
  })

  it('preserves a recognized error code on SecretsApiError', async () => {
    mockFetchApi.mockResolvedValue(
      jsonResponse(
        { code: 'DUPLICATE_NAME', message: 'exists' },
        { ok: false, status: 409, statusText: 'Conflict' }
      )
    )

    await expect(listSecretProviders()).rejects.toMatchObject({
      name: 'SecretsApiError',
      status: 409,
      code: 'DUPLICATE_NAME',
      message: 'exists'
    })
  })
})
