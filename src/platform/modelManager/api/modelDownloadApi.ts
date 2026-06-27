import { api } from '@/scripts/api'

import type {
  AvailabilityResponse,
  DownloadStatus,
  EnqueueRequest,
  EnqueueResponse,
  HostCredentialUpsert,
  HostCredentialView
} from '../types'
import { DownloadApiError } from '../types'

const BASE = '/download'

interface ErrorEnvelope {
  error?: {
    code?: string
    message?: string
    details?: Record<string, unknown>
  }
}

async function throwFromResponse(response: Response): Promise<never> {
  let body: ErrorEnvelope = {}
  try {
    body = await response.json()
  } catch {
    // Non-JSON error body
  }
  const error = body.error
  throw new DownloadApiError(
    error?.message ?? response.statusText,
    error?.code ?? 'UNKNOWN',
    response.status,
    error?.details
  )
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) return throwFromResponse(response)
  return response.json() as Promise<T>
}

function postJson(route: string, body: unknown): Promise<Response> {
  return api.fetchApi(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function enqueueDownload(
  body: EnqueueRequest
): Promise<EnqueueResponse> {
  const response = await postJson(`${BASE}/enqueue`, body)
  if (response.status === 202) {
    return response.json() as Promise<EnqueueResponse>
  }
  return throwFromResponse(response)
}

export async function listDownloads(): Promise<DownloadStatus[]> {
  const response = await api.fetchApi(BASE)
  const data = await parseJson<{ downloads: DownloadStatus[] }>(response)
  return data.downloads
}

async function postAction(id: string, action: string): Promise<void> {
  const response = await postJson(`${BASE}/${id}/${action}`, undefined)
  await parseJson<{ ok: boolean }>(response)
}

export const pauseDownload = (id: string) => postAction(id, 'pause')
export const resumeDownload = (id: string) => postAction(id, 'resume')
export const cancelDownload = (id: string) => postAction(id, 'cancel')

export async function setDownloadPriority(
  id: string,
  priority: number
): Promise<void> {
  const response = await postJson(`${BASE}/${id}/priority`, { priority })
  await parseJson<{ ok: boolean }>(response)
}

export async function checkAvailability(
  models: Record<string, string>
): Promise<AvailabilityResponse> {
  const response = await postJson(`${BASE}/availability`, { models })
  return parseJson<AvailabilityResponse>(response)
}

export async function listCredentials(): Promise<HostCredentialView[]> {
  const response = await api.fetchApi(`${BASE}/credentials`)
  const data = await parseJson<{ credentials: HostCredentialView[] }>(response)
  return data.credentials
}

export async function upsertCredential(
  body: HostCredentialUpsert
): Promise<HostCredentialView> {
  const response = await postJson(`${BASE}/credentials`, body)
  return parseJson<HostCredentialView>(response)
}

export async function deleteCredential(id: string): Promise<void> {
  const response = await api.fetchApi(`${BASE}/credentials/${id}`, {
    method: 'DELETE'
  })
  await parseJson<{ deleted: boolean }>(response)
}
