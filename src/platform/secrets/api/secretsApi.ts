import axios from 'axios'

import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

import type {
  SecretCreateRequest,
  SecretErrorCode,
  SecretMetadata,
  SecretUpdateRequest
} from '../types'

interface ListSecretsResponse {
  data: SecretMetadata[]
}

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

const secretsApiClient = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
})

async function getAuthHeaderOrThrow() {
  const authHeader = await useFirebaseAuthStore().getAuthHeader()
  if (!authHeader) {
    throw new SecretsApiError(
      t('toastMessages.userNotAuthenticated'),
      401,
      'FORBIDDEN'
    )
  }
  return authHeader
}

function handleAxiosError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const code = err.response?.data?.code as SecretErrorCode | undefined
    const message = err.response?.data?.message ?? err.message
    throw new SecretsApiError(message, status, code)
  }
  throw err
}

export const secretsApi = {
  async list(): Promise<SecretMetadata[]> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await secretsApiClient.get<ListSecretsResponse>(
        api.apiURL('/secrets'),
        { headers }
      )
      return response.data.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  async get(id: string): Promise<SecretMetadata> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await secretsApiClient.get<SecretMetadata>(
        api.apiURL(`/secrets/${id}`),
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  async create(payload: SecretCreateRequest): Promise<SecretMetadata> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await secretsApiClient.post<SecretMetadata>(
        api.apiURL('/secrets'),
        payload,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  async update(
    id: string,
    payload: SecretUpdateRequest
  ): Promise<SecretMetadata> {
    const headers = await getAuthHeaderOrThrow()
    try {
      const response = await secretsApiClient.patch<SecretMetadata>(
        api.apiURL(`/secrets/${id}`),
        payload,
        { headers }
      )
      return response.data
    } catch (err) {
      handleAxiosError(err)
    }
  },

  async delete(id: string): Promise<void> {
    const headers = await getAuthHeaderOrThrow()
    try {
      await secretsApiClient.delete(api.apiURL(`/secrets/${id}`), { headers })
    } catch (err) {
      handleAxiosError(err)
    }
  }
}
