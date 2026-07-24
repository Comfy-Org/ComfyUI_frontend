import type {
  CredentialOption,
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
 * optional presentation (`label`) and credential-entry (`credential_options`)
 * metadata.
 */
export type SecretProviderInfo = SecretProviderSchema

/**
 * How a provider's credential is entered. `text` is a single-line secret (an API
 * key); `json_file` is an uploaded/pasted JSON document (e.g. a Vertex
 * service-account key). Providers advertising no `credential_options` are
 * treated as `text`.
 */
export type SecretInputType = CredentialOption['input_type']

/**
 * Which credential class a value belongs to. `api_key` is an opaque key/token;
 * `gcp_service_account` is a Google Cloud service-account key JSON, which routes
 * the provider through Vertex AI. Immutable once stored — an update re-validates
 * the replacement value against the stored class.
 */
export type SecretCredentialType = CredentialOption['credential_type']

/**
 * One way a provider's credential can be entered, as advertised by
 * `GET /secrets/providers`. Providers offering more than one (e.g. Gemini's AI
 * Studio key vs a Vertex service account) drive a client-side sub-selection.
 */
export type SecretCredentialOption = CredentialOption

export interface SecretCreateRequest {
  name: string
  secret_value: string
  /** Provider identifier as returned by `GET /secrets/providers`. */
  provider?: string
  /**
   * Which credential class `secret_value` holds. Omitted when the provider
   * advertises no options; the server then defaults to `api_key`.
   */
  credential_type?: SecretCredentialType
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
