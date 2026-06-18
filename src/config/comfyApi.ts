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
  : (import.meta.env.VITE_STAGING_API_BASE_URL ?? STAGING_API_BASE_URL)

const BUILD_TIME_PLATFORM_BASE_URL = __USE_PROD_CONFIG__
  ? PROD_PLATFORM_BASE_URL
  : (import.meta.env.VITE_STAGING_PLATFORM_BASE_URL ??
    STAGING_PLATFORM_BASE_URL)

/**
 * Resolves the ComfyUI API base URL.
 *
 * The local server (any distribution) is authoritative: whatever
 * `/api/features` returns for `comfy_api_base_url` wins, falling back to
 * the build-time default. This lets a self-hosted comfyui — including
 * ephemeral envs — point its frontend at a different api host without
 * rebuilding the frontend package.
 */
export function getComfyApiBaseUrl(): string {
  return configValueOrDefault(
    remoteConfig.value,
    'comfy_api_base_url',
    BUILD_TIME_API_BASE_URL
  )
}

export function getComfyPlatformBaseUrl(): string {
  return configValueOrDefault(
    remoteConfig.value,
    'comfy_platform_base_url',
    BUILD_TIME_PLATFORM_BASE_URL
  )
}
