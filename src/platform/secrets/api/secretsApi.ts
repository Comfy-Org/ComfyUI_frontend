import type {
  SecretListResponse,
  SecretProvidersResponse
} from '@comfyorg/ingest-types'

import { api } from '@/scripts/api'
import { parseErrorResponse } from '@/platform/remote/comfyui/errors'

import type {
  SecretCreateRequest,
  SecretErrorCode,
  SecretMetadata,
  SecretProviderInfo,
  SecretUpdateRequest
} from '../types'
import { SECRET_ERROR_CODES } from '../types'

export class SecretsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: SecretErrorCode
  ) {
    super(message)
    this.name = 'SecretsApiError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await parseErrorResponse(response)
    const code = SECRET_ERROR_CODES.includes(
      errorData.code as (typeof SECRET_ERROR_CODES)[number]
    )
      ? (errorData.code as SecretErrorCode)
      : undefined
    throw new SecretsApiError(errorData.message, response.status, code)
  }
  return response.json()
}

export async function listSecrets(): Promise<SecretMetadata[]> {
  const response = await api.fetchApi('/secrets')
  const data = await handleResponse<SecretListResponse>(response)
  return data.data
}

export async function listSecretProviders(): Promise<SecretProviderInfo[]> {
  const response = await api.fetchApi('/secrets/providers')
  const data = await handleResponse<SecretProvidersResponse>(response)
  return data.data ?? []
}

export async function createSecret(
  payload: SecretCreateRequest
): Promise<SecretMetadata> {
  const response = await api.fetchApi('/secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return handleResponse<SecretMetadata>(response)
}

export async function updateSecret(
  id: string,
  payload: SecretUpdateRequest
): Promise<SecretMetadata> {
  const response = await api.fetchApi(`/secrets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return handleResponse<SecretMetadata>(response)
}

export async function deleteSecret(id: string): Promise<void> {
  const response = await api.fetchApi(`/secrets/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    await handleResponse<void>(response)
  }
}
