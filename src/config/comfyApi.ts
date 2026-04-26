import { isCloud } from '@/platform/distribution/types'
import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'

const PROD_API_BASE_URL = 'https://api.comfy.org'
const STAGING_API_BASE_URL = 'https://stagingapi.comfy.org'

const PROD_PLATFORM_BASE_URL = 'https://platform.comfy.org'
const STAGING_PLATFORM_BASE_URL = 'https://stagingplatform.comfy.org'

const BUILD_TIME_API_BASE_URL = __USE_PROD_CONFIG__
  ? PROD_API_BASE_URL
  : STAGING_API_BASE_URL

const BUILD_TIME_PLATFORM_BASE_URL = __USE_PROD_CONFIG__
  ? PROD_PLATFORM_BASE_URL
  : STAGING_PLATFORM_BASE_URL

export function getComfyApiBaseUrl(): string {
  if (!isCloud) {
    return BUILD_TIME_API_BASE_URL
  }

  return configValueOrDefault(
    remoteConfig.value,
    'comfy_api_base_url',
    BUILD_TIME_API_BASE_URL
  )
}

export function getComfyPlatformBaseUrl(): string {
  if (!isCloud) {
    return BUILD_TIME_PLATFORM_BASE_URL
  }

  return configValueOrDefault(
    remoteConfig.value,
    'comfy_platform_base_url',
    BUILD_TIME_PLATFORM_BASE_URL
  )
}

/**
 * Maps a Comfy Cloud API base URL (as reported by the backend) to its paired
 * platform URL where users manage their account / API keys. Returns null for
 * unknown bases so callers can hide the link rather than guess.
 */
export function getPlatformBaseUrlForApiBase(apiBase: string): string | null {
  const normalized = apiBase.replace(/\/+$/, '')
  if (normalized === PROD_API_BASE_URL) return PROD_PLATFORM_BASE_URL
  if (normalized === STAGING_API_BASE_URL) return STAGING_PLATFORM_BASE_URL
  return null
}
