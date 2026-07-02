import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import {
  createSecret,
  deleteSecret,
  listSecrets,
  updateSecret
} from './secretsApi'
import type { SecretsApiError } from './secretsApi'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

const fetchApi = vi.mocked(api.fetchApi)

const secret = {
  id: 'secret-1',
  name: 'HF token',
  provider: 'huggingface' as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers
  })
}

describe('secretsApi', () => {
  beforeEach(() => {
    fetchApi.mockReset()
  })

  it('lists secrets from the API response data field', async () => {
    fetchApi.mockResolvedValue(jsonResponse({ data: [secret] }))

    await expect(listSecrets()).resolves.toEqual([secret])
    expect(fetchApi).toHaveBeenCalledWith('/secrets')
  })

  it('creates and updates secrets with JSON payloads', async () => {
    fetchApi
      .mockResolvedValueOnce(jsonResponse(secret))
      .mockResolvedValueOnce(jsonResponse(secret))

    await expect(
      createSecret({
        name: 'HF token',
        secret_value: 'token',
        provider: 'huggingface'
      })
    ).resolves.toEqual(secret)
    expect(fetchApi).toHaveBeenLastCalledWith('/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'HF token',
        secret_value: 'token',
        provider: 'huggingface'
      })
    })

    await expect(
      updateSecret('secret-1', { name: 'New name' })
    ).resolves.toEqual(secret)
    expect(fetchApi).toHaveBeenLastCalledWith('/secrets/secret-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New name' })
    })
  })

  it('deletes secrets without reading a success body', async () => {
    fetchApi.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(deleteSecret('secret-1')).resolves.toBeUndefined()
    expect(fetchApi).toHaveBeenCalledWith('/secrets/secret-1', {
      method: 'DELETE'
    })
  })

  it('throws a typed error for known API error codes', async () => {
    fetchApi.mockResolvedValue(
      jsonResponse(
        { message: 'Duplicate provider', code: 'DUPLICATE_PROVIDER' },
        { status: 409, statusText: 'Conflict' }
      )
    )

    await expect(listSecrets()).rejects.toMatchObject({
      name: 'SecretsApiError',
      message: 'Duplicate provider',
      status: 409,
      code: 'DUPLICATE_PROVIDER'
    } satisfies Partial<SecretsApiError>)
  })

  it('falls back to status text for non-JSON error responses', async () => {
    fetchApi.mockResolvedValue(
      new Response('not-json', {
        status: 500,
        statusText: 'Server Error'
      })
    )

    await expect(listSecrets()).rejects.toMatchObject({
      message: 'Server Error',
      status: 500,
      code: undefined
    } satisfies Partial<SecretsApiError>)
  })

  it('ignores unknown API error codes', async () => {
    fetchApi.mockResolvedValue(
      jsonResponse(
        { message: 'Unexpected', code: 'SOMETHING_ELSE' },
        { status: 400, statusText: 'Bad Request' }
      )
    )

    await expect(listSecrets()).rejects.toMatchObject({
      message: 'Unexpected',
      status: 400,
      code: undefined
    } satisfies Partial<SecretsApiError>)
  })
})
