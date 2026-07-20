import type {
  SecretProvider as SecretProviderSchema,
  SecretResponse
} from '@comfyorg/ingest-types'

/**
 * Secret metadata as returned by the ingest API, sourced from the generated
 * OpenAPI types (`SecretResponse`). The secret value itself is never returned
 * after creation. `provider` is a free-form identifier (huggingface, civitai,
 * and BYOK providers); the `SecretProvider` union below is only the subset the
 * UI renders first-class.
 */
export type SecretMetadata = SecretResponse

/**
 * Base providers the UI renders with a dedicated first-class label/logo. This
 * union documents the historically-known providers only — the full set of
 * configurable providers is data-driven via `GET /secrets/providers`, so the
 * selected provider is stored/sent as a free-form string.
 */
export type SecretProvider = 'huggingface' | 'civitai'

/**
 * A configurable provider as returned by `GET /secrets/providers`: its id plus
 * optional presentation (`label`) and credential-entry (`input_type`) metadata.
 */
export type SecretProviderInfo = SecretProviderSchema

/**
 * How a provider's credential is entered. `text` is a single-line secret (an API
 * key); `json_file` is an uploaded/pasted JSON document (e.g. a Vertex
 * service-account key). Providers omitting `input_type` are treated as `text`.
 */
export type SecretInputType = NonNullable<SecretProviderInfo['input_type']>

export interface SecretCreateRequest {
  name: string
  secret_value: string
  /** Provider identifier as returned by `GET /secrets/providers`. */
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
