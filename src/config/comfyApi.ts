import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'

const PROD_API_BASE_URL = 'https://api.comfy.org'
const STAGING_API_BASE_URL = 'https://stagingapi.comfy.org'

const PROD_CLOUD_BASE_URL = 'https://cloud.comfy.org'
const STAGING_CLOUD_BASE_URL = 'https://testcloud.comfy.org'

const PROD_PLATFORM_BASE_URL = 'https://platform.comfy.org'
const STAGING_PLATFORM_BASE_URL = 'https://stagingplatform.comfy.org'

const BUILD_TIME_API_BASE_URL = __USE_PROD_CONFIG__
  ? PROD_API_BASE_URL
  : (import.meta.env.VITE_STAGING_API_BASE_URL ?? STAGING_API_BASE_URL)

const BUILD_TIME_CLOUD_BASE_URL = __USE_PROD_CONFIG__
  ? PROD_CLOUD_BASE_URL
  : (import.meta.env.VITE_STAGING_CLOUD_BASE_URL ?? STAGING_CLOUD_BASE_URL)

const BUILD_TIME_PLATFORM_BASE_URL = __USE_PROD_CONFIG__
  ? PROD_PLATFORM_BASE_URL
  : (import.meta.env.VITE_STAGING_PLATFORM_BASE_URL ??
    STAGING_PLATFORM_BASE_URL)

function resolveBaseUrl(
  key:
    | 'comfy_api_base_url'
    | 'comfy_cloud_base_url'
    | 'comfy_platform_base_url',
  defaultValue: string
): string {
  const value = configValueOrDefault(remoteConfig.value, key, defaultValue)

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname) return defaultValue
    return url.href.replace(/\/$/, '')
  } catch {
    return defaultValue
  }
}

export function getComfyApiBaseUrl(): string {
  return resolveBaseUrl('comfy_api_base_url', BUILD_TIME_API_BASE_URL)
}

export function getComfyCloudBaseUrl(): string {
  return resolveBaseUrl('comfy_cloud_base_url', BUILD_TIME_CLOUD_BASE_URL)
}

export function getComfyPlatformBaseUrl(): string {
  return resolveBaseUrl('comfy_platform_base_url', BUILD_TIME_PLATFORM_BASE_URL)
}
