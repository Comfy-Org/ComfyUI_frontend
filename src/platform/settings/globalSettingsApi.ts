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

async function storedSetting(
  response: Response,
  key: GlobalSettingKey
): Promise<GlobalSetting> {
  if (!response.ok) {
    throw new GlobalSettingsApiError(
      `Global setting request failed: ${response.status}`,
      response.status
    )
  }
  const payload = zGlobalSetting.safeParse(await responseBody(response))
  if (!payload.success || payload.data.key !== key) {
    throw new GlobalSettingsApiError(
      'Global setting returned an invalid response',
      response.status
    )
  }
  return payload.data
}

export async function getGlobalSetting(
  key: GlobalSettingKey,
  authHeader: AuthHeader
): Promise<GlobalSetting | undefined> {
  const response = await fetchWithUnifiedRemint(
    globalSettingsUrl(key),
    { cache: 'no-cache', headers: authHeader },
    await shouldRemintCloudRequest()
  )
  if (response.status === 404) {
    const error = zErrorResponse.safeParse(await responseBody(response))
    if (error.success && error.data.code === 'NOT_FOUND') return undefined
  }
  return storedSetting(response, key)
}

export async function setGlobalSetting(
  setting: GlobalSettingValue,
  authHeader: AuthHeader
): Promise<GlobalSetting> {
  const response = await fetchWithUnifiedRemint(
    globalSettingsUrl(),
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(setting)
    },
    await shouldRemintCloudRequest()
  )
  return storedSetting(response, setting.key)
}
