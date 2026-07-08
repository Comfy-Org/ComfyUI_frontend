import type { SecretResponse } from '@comfyorg/ingest-types'

/**
 * Secret metadata as returned by the ingest API, sourced from the generated
 * OpenAPI types (`SecretResponse`). The secret value itself is never returned
 * after creation. `provider` is a free-form identifier (huggingface, civitai,
 * and BYOK providers); the `SecretProvider` union below is only the subset the
 * UI renders first-class.
 */
export type SecretMetadata = SecretResponse

/**
 * Base providers the UI renders with a dedicated label/logo. The full set of
 * configurable providers is data-driven via `GET /secrets/providers`.
 */
export type SecretProvider = 'huggingface' | 'civitai'

export interface SecretCreateRequest {
  name: string
  secret_value: string
  provider?: string
}

export interface SecretUpdateRequest {
  name?: string
  secret_value?: string
}

export const SECRET_ERROR_CODES = [
  'INVALID_REQUEST',
  'INVALID_PROVIDER',
  'DUPLICATE_NAME',
  'DUPLICATE_PROVIDER',
  'FORBIDDEN',
  'NOT_FOUND'
] as const

export type SecretErrorCode = (typeof SECRET_ERROR_CODES)[number]
