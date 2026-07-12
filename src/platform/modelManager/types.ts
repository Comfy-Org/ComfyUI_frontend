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
}

export interface EnqueueResponse {
  download_id: string
  accepted: boolean
}

/**
 * Providers whose gated/private downloads can require server-side auth. The
 * backend resolves a token per request (env key first, then OAuth), so the
 * frontend only ever reads status — never a token value.
 */
export const DOWNLOAD_PROVIDERS = ['huggingface', 'civitai'] as const
export type DownloadProvider = (typeof DOWNLOAD_PROVIDERS)[number]

/**
 * Per-provider auth status from `GET /download/auth`. A provider is
 * authenticated (the frontend needs to do nothing) when
 * `env_key_present || logged_in`.
 */
export interface ProviderAuthStatus {
  provider: DownloadProvider
  /** An API-key env var is set on the server for this provider. */
  env_key_present: boolean
  /** A stored OAuth token exists for this provider. */
  logged_in: boolean
  /** An OAuth login is awaiting its browser callback. */
  login_in_progress: boolean
}

export interface LoginStartResponse {
  authorize_url: string
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
  'ALREADY_AVAILABLE',
  'ALREADY_DOWNLOADING',
  'DOWNLOAD_ACTIVE',
  'NOT_FOUND',
  // Auth failures surfaced by enqueue when the URL needs a network resolve.
  'GATED_REPO',
  'CREDENTIALS_REQUIRED',
  // Provider OAuth login (`/download/auth/{provider}/login`).
  'UNKNOWN_PROVIDER',
  'OAUTH_NOT_CONFIGURED',
  'LOGIN_IN_PROGRESS'
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
