import { isCloud } from '@/platform/distribution/types'
import { getRuntimeConfig } from '@/platform/remoteConfig/remoteConfig'

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

const getCloudRuntimeUrl = (key: 'comfy_api_base_url' | 'comfy_platform_base_url') => {
  if (!isCloud) return undefined

  const runtimeConfig = getRuntimeConfig()
  const value = runtimeConfig[key]

  if (value && typeof value === 'string') {
    return value
  }

  return undefined
}

export function getComfyApiBaseUrl(): string {
  return getCloudRuntimeUrl('comfy_api_base_url') ?? BUILD_TIME_API_BASE_URL
}

export function getComfyPlatformBaseUrl(): string {
  return getCloudRuntimeUrl('comfy_platform_base_url') ?? BUILD_TIME_PLATFORM_BASE_URL
}
