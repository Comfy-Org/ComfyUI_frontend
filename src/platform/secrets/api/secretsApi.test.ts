import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { listSecretProviders } from './secretsApi'

vi.mock(import('@/scripts/api'))

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
  it('requests the providers endpoint and returns the provider list', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      jsonResponse({ data: [{ id: 'huggingface' }, { id: 'civitai' }] })
    )

    const providers = await listSecretProviders()

    expect(api.fetchApi).toHaveBeenCalledWith('/secrets/providers')
    expect(providers).toEqual([{ id: 'huggingface' }, { id: 'civitai' }])
  })

  it('passes through per-provider credential options and label metadata', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'gemini',
            label: 'Gemini',
            credential_options: [
              {
                credential_type: 'gcp_service_account',
                input_type: 'json_file',
                label: 'Service account (Vertex AI)'
              }
            ]
          }
        ]
      })
    )

    const providers = await listSecretProviders()

    expect(providers).toEqual([
      {
        id: 'gemini',
        label: 'Gemini',
        credential_options: [
          {
            credential_type: 'gcp_service_account',
            input_type: 'json_file',
            label: 'Service account (Vertex AI)'
          }
        ]
      }
    ])
  })

  it('returns an empty list when data is missing', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(jsonResponse({}))

    const providers = await listSecretProviders()

    expect(providers).toEqual([])
  })

  it('throws SecretsApiError on a failed response', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
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
    vi.mocked(api.fetchApi).mockResolvedValue(
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
