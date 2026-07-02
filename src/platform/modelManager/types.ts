import { z } from 'zod'

import type { DownloadState, DownloadStatus } from '@/schemas/apiSchema'

export type { DownloadState, DownloadStatus }

/**
 * Known model file extensions accepted by the backend without
 * `allow_any_extension`. Mirrors the server's extension allowlist and is
 * used for instant client-side validation only — the server stays the source
 * of truth.
 */
export const MODEL_EXTENSIONS = [
  '.safetensors',
  '.sft',
  '.ckpt',
  '.pth',
  '.pt',
  '.gguf',
  '.bin'
] as const

/**
 * Hosts the backend allows out of the box. Admins can extend this
 * server-side, so this list is only for optimistic client-side hints; rely on
 * the server's `URL_NOT_ALLOWED` / `url_allowed` as the source of truth.
 */
export const DEFAULT_ALLOWED_HOSTS = [
  'huggingface.co',
  'civitai.com',
  'localhost',
  '127.0.0.1'
] as const

export interface EnqueueRequest {
  url: string
  model_id: string
  priority?: number
  expected_sha256?: string | null
  allow_any_extension?: boolean
  credential_id?: string | null
}

export interface EnqueueResponse {
  download_id: string
  accepted: boolean
}

export const AUTH_SCHEMES = ['bearer', 'header', 'query'] as const
export type AuthScheme = (typeof AUTH_SCHEMES)[number]

const zHostCredentialView = z.object({
  id: z.string(),
  host: z.string(),
  auth_scheme: z.enum(AUTH_SCHEMES),
  header_name: z.string().nullable(),
  query_param: z.string().nullable(),
  label: z.string().nullable(),
  match_subdomains: z.boolean(),
  enabled: z.boolean(),
  secret_last4: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number()
})
export type HostCredentialView = z.infer<typeof zHostCredentialView>

export interface HostCredentialUpsert {
  host: string
  secret: string
  auth_scheme?: AuthScheme
  header_name?: string | null
  query_param?: string | null
  label?: string | null
  match_subdomains?: boolean
  enabled?: boolean
}

interface AvailabilityBase {
  url_allowed: boolean
}

export type AvailabilityEntry =
  | (AvailabilityBase & { state: 'available' })
  | (AvailabilityBase & { state: 'missing' })
  | (AvailabilityBase & {
      state: 'downloading'
      download_id: string
      progress: number | null
      bytes_done: number
      total_bytes: number | null
      speed_bps: number | null
    })

export interface AvailabilityResponse {
  models: Record<string, AvailabilityEntry>
}

const DOWNLOAD_ERROR_CODES = [
  'INVALID_JSON',
  'INVALID_BODY',
  'URL_NOT_ALLOWED',
  'INVALID_MODEL_ID',
  'INVALID_CREDENTIAL',
  'ALREADY_AVAILABLE',
  'ALREADY_DOWNLOADING',
  'DOWNLOAD_ACTIVE',
  'NOT_FOUND'
] as const
export type DownloadErrorCode = (typeof DOWNLOAD_ERROR_CODES)[number]

/**
 * Error envelope returned by every download-manager endpoint on failure.
 * `code` is the stable machine-readable discriminator; `message` is
 * user-facing; `details` is an open object (do not assume a shape).
 */
export class DownloadApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'DownloadApiError'
  }

  is(code: DownloadErrorCode): boolean {
    return this.code === code
  }
}
