import type {
  GlobalSetting,
  GlobalSettingKey,
  GlobalSettingValue
} from '@comfyorg/ingest-types'
import { zErrorResponse, zGlobalSetting } from '@comfyorg/ingest-types/zod'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import {
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest
} from '@/platform/auth/unified/remintRetry'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import type { WebSessionSend } from '@/platform/auth/session/webSessionFetch'
import type { AuthHeader } from '@/types/authTypes'

export class GlobalSettingsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'GlobalSettingsApiError'
  }
}

function globalSettingsUrl(key?: GlobalSettingKey): string {
  const path = `/global-settings${key ? `/${encodeURIComponent(key)}` : ''}`
  return isCloud ? api.apiURL(path) : `${getComfyApiBaseUrl()}/api${path}`
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new GlobalSettingsApiError(
      'Global setting returned invalid JSON',
      response.status
    )
  }
}

type GlobalSettingsAuth = AuthHeader | WebSessionSend

function sendGlobalSetting(
  url: string,
  init: RequestInit,
  auth: GlobalSettingsAuth,
  headers: Record<string, string> = {}
): Promise<Response> {
  if (typeof auth === 'function') return auth(url, { ...init, headers })
  return shouldRemintCloudRequest().then((remint) =>
    fetchWithUnifiedRemint(
      url,
      { ...init, headers: { ...headers, ...auth } },
      remint
    )
  )
}

async function storedSetting(response: Response): Promise<GlobalSetting> {
  if (!response.ok) {
    throw new GlobalSettingsApiError(
      `Global setting request failed: ${response.status}`,
      response.status
    )
  }
  const payload = zGlobalSetting.safeParse(await responseBody(response))
  if (!payload.success) {
    throw new GlobalSettingsApiError(
      'Global setting returned an invalid response',
      response.status
    )
  }
  return payload.data
}

export async function getGlobalSetting(
  key: GlobalSettingKey,
  auth: GlobalSettingsAuth
): Promise<GlobalSetting | undefined> {
  const response = await sendGlobalSetting(
    globalSettingsUrl(key),
    { cache: 'no-store' },
    auth
  )
  if (response.status === 404) {
    const error = zErrorResponse.safeParse(await responseBody(response))
    if (error.success && error.data.code === 'NOT_FOUND') return undefined
  }
  return storedSetting(response)
}

export async function setGlobalSetting(
  setting: GlobalSettingValue,
  auth: GlobalSettingsAuth
): Promise<GlobalSetting> {
  const response = await sendGlobalSetting(
    globalSettingsUrl(),
    { method: 'POST', body: JSON.stringify(setting) },
    auth,
    { 'Content-Type': 'application/json' }
  )
  return storedSetting(response)
}
