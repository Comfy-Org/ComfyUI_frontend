export type SecretProvider = 'huggingface' | 'civitai'

export interface SecretMetadata {
  id: string
  name: string
  provider?: SecretProvider
  last_used_at?: string
  created_at: string
  updated_at: string
}

export interface SecretCreateRequest {
  name: string
  secret_value: string
  provider?: SecretProvider
}

export interface SecretUpdateRequest {
  name?: string
  secret_value?: string
}

export type SecretErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_PROVIDER'
  | 'DUPLICATE_NAME'
  | 'DUPLICATE_PROVIDER'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
