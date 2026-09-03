import type { AuthHeader } from '@/types/authTypes'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import {
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest
} from '@/platform/auth/unified/remintRetry'

export class AccountSettingsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'AccountSettingsApiError'
  }
}

function accountSettingUrl(id: string): string {
  return `${getComfyApiBaseUrl()}/api/settings/${encodeURIComponent(id)}`
}

export async function getAccountSetting(
  id: string,
  authHeader: AuthHeader
): Promise<unknown> {
  const response = await fetchWithUnifiedRemint(
    accountSettingUrl(id),
    { headers: authHeader },
    await shouldRemintCloudRequest()
  )
  if (response.status === 404) return undefined
  if (!response.ok) {
    throw new AccountSettingsApiError(
      `Failed to load account setting ${id}: ${response.status}`,
      response.status
    )
  }

  const payload: unknown = await response.json()
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('value' in payload)
  ) {
    throw new AccountSettingsApiError(
      `Account setting ${id} returned an invalid response`
    )
  }
  return payload.value
}

export async function setAccountSetting(
  id: string,
  value: unknown,
  authHeader: AuthHeader
): Promise<void> {
  const response = await fetchWithUnifiedRemint(
    accountSettingUrl(id),
    {
      method: 'POST',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(value)
    },
    await shouldRemintCloudRequest()
  )
  if (!response.ok) {
    throw new AccountSettingsApiError(
      `Failed to save account setting ${id}: ${response.status}`,
      response.status
    )
  }
}
