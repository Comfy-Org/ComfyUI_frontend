/**
 * Typed wrappers around the server-side model download endpoints.
 *
 * One polling endpoint (``models-availability-status``) returns
 * per-id state + metadata + HF auth snapshot. There's no separate
 * metadata cache to maintain on the client.
 */

import { api } from '@/scripts/api'

// --- per-model status ----------------------------------------------------- //

type ModelState = 'available' | 'missing' | 'downloading'

interface DownloadProgress {
  bytes_downloaded: number
  total_bytes: number | null
  /** Fraction in [0,1]; null until total_bytes is known. */
  progress: number | null
}

export interface ModelStatusEntry {
  state: ModelState
  progress: DownloadProgress | null
  file_size: number | null
  /** HF-only signal: true if server can fetch with current auth state,
   *  false if gated and lacking access, null for non-HF / probe failure. */
  is_hf_downloadable: boolean | null
}

export interface HfAuthStatus {
  token_available: boolean
  eligible: boolean
}

export interface AvailabilityStatusResponse {
  models: Record<string, ModelStatusEntry>
  hf_auth: HfAuthStatus
}

// --- response envelopes for the other endpoints --------------------------- //

export interface DownloadModelsResponse {
  accepted: boolean
  scheduled: string[]
}

interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Error thrown by every endpoint wrapper in this module. Carries the
 * backend error `code`, the HTTP `status`, and any structured `details`
 * so callers can branch on the failure or surface it to the user.
 */
export class ServerDownloadError extends Error {
  readonly code: string
  readonly status: number
  readonly details: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown> = {}
  ) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

/** POST `body` as JSON, returning the parsed response or throwing a
 * {@link ServerDownloadError} for any non-2xx status. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await api.fetchApi(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    let parsed: ApiErrorBody | null = null
    try {
      parsed = (await res.json()) as ApiErrorBody
    } catch {
      // Body wasn't JSON; surface a generic error.
    }
    const code = parsed?.error?.code ?? `HTTP_${res.status}`
    const message = parsed?.error?.message ?? res.statusText
    const details = parsed?.error?.details ?? {}
    throw new ServerDownloadError(code, message, res.status, details)
  }
  return (await res.json()) as T
}

// --- model_id helper ------------------------------------------------------ //

/** ``model_id`` = ``"<directory>/<filename>"``, matching the backend's contract. */
export function modelIdFor(directory: string, name: string): string {
  return `${directory}/${name}`
}

/** Per-row state derived for the UI. Pure function of a ModelStatusEntry. */
export type ServerDownloadStatus =
  | 'available'
  | 'missing'
  | 'downloading'
  | 'gated'

// --- endpoints ------------------------------------------------------------ //

/** Poll per-model availability/state plus the current HF auth snapshot.
 * Short-circuits with an empty result when no models are requested. */
export async function fetchAvailabilityStatus(
  models: Record<string, string>
): Promise<AvailabilityStatusResponse> {
  if (Object.keys(models).length === 0) {
    return {
      models: {},
      hf_auth: { token_available: false, eligible: false }
    }
  }
  return postJson<AvailabilityStatusResponse>('/models-availability-status', {
    models
  })
}

/** Schedule server-side downloads for the given `model_id` → URL map. */
export async function startModelDownloads(
  models: Record<string, string>
): Promise<DownloadModelsResponse> {
  return postJson<DownloadModelsResponse>('/download-models', { models })
}

/** Cancel an in-flight download. Throws if the server does not confirm
 * the cancellation (`{ cancelled: false }`) so callers don't assume success. */
export async function cancelModelDownload(modelId: string): Promise<void> {
  const { cancelled } = await postJson<{ cancelled: boolean }>(
    '/cancel-model-download-session',
    { model_id: modelId }
  )
  if (!cancelled) {
    throw new ServerDownloadError(
      'CANCEL_NOT_CONFIRMED',
      'Server did not confirm cancellation',
      200,
      { model_id: modelId }
    )
  }
}

// --- HF auth -------------------------------------------------------------- //

export interface HfAuthTokenStatusResponse {
  token_available: boolean
  username: string | null
}

export interface HfAuthLoginStartResponse {
  authorize_url: string
}

/** Read whether a HuggingFace token is stored server-side and, if so, the username. */
export async function fetchHfAuthTokenStatus(): Promise<HfAuthTokenStatusResponse> {
  const res = await api.fetchApi('/hf-auth-token-status')
  if (!res.ok) {
    throw new ServerDownloadError(
      `HTTP_${res.status}`,
      res.statusText,
      res.status
    )
  }
  return (await res.json()) as HfAuthTokenStatusResponse
}

/** Begin the HuggingFace OAuth flow, returning the URL to open for authorization. */
export async function startHfAuthLogin(): Promise<HfAuthLoginStartResponse> {
  return postJson<HfAuthLoginStartResponse>('/hf-auth-login-start', {})
}

/** Clear the stored HuggingFace token. Throws if the server does not confirm
 * the logout (`{ logged_out: false }`) so callers don't assume success. */
export async function logoutHfAuth(): Promise<void> {
  const { logged_out } = await postJson<{ logged_out: boolean }>(
    '/hf-auth-logout',
    {}
  )
  if (!logged_out) {
    throw new ServerDownloadError(
      'LOGOUT_NOT_CONFIRMED',
      'Server did not confirm logout',
      200
    )
  }
}
