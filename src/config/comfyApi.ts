import { isCloud } from '@/platform/distribution/types'
import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'

const PROD_API_BASE_URL = 'https://api.comfy.org'
const STAGING_API_BASE_URL = 'https://stagingapi.comfy.org'

const PROD_PLATFORM_BASE_URL = 'https://platform.comfy.org'
const STAGING_PLATFORM_BASE_URL = 'https://stagingplatform.comfy.org'

type ComfyApiEnvironment = {
  isCloudDistribution: boolean
  isDev: boolean
  devServerComfyUIUrl?: string
  useProdConfig: boolean
}

const localOriginPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/

function buildTimeApiBaseUrl(useProdConfig: boolean): string {
  return useProdConfig ? PROD_API_BASE_URL : STAGING_API_BASE_URL
}

function buildTimePlatformBaseUrl(useProdConfig: boolean): string {
  return useProdConfig ? PROD_PLATFORM_BASE_URL : STAGING_PLATFORM_BASE_URL
}

function isLocalDevServer(url?: string): boolean {
  return url ? localOriginPattern.test(url) : false
}

export function getComfyApiBaseUrlForEnvironment({
  isCloudDistribution,
  isDev,
  devServerComfyUIUrl,
  useProdConfig
}: ComfyApiEnvironment): string {
  const buildTimeApiBaseUrlValue = buildTimeApiBaseUrl(useProdConfig)
  if (!isCloudDistribution) {
    return buildTimeApiBaseUrlValue
  }
  if (isDev && isLocalDevServer(devServerComfyUIUrl)) {
    return ''
  }

  return configValueOrDefault(
    remoteConfig.value,
    'comfy_api_base_url',
    buildTimeApiBaseUrlValue
  )
}

export function getComfyApiBaseUrl(): string {
  return getComfyApiBaseUrlForEnvironment({
    isCloudDistribution: isCloud,
    isDev: import.meta.env.DEV,
    devServerComfyUIUrl: __DEV_SERVER_COMFYUI_URL__,
    useProdConfig: __USE_PROD_CONFIG__
  })
}

export function getComfyPlatformBaseUrl(): string {
  const buildTimePlatformBaseUrlValue =
    buildTimePlatformBaseUrl(__USE_PROD_CONFIG__)
  if (!isCloud) {
    return buildTimePlatformBaseUrlValue
  }

  return configValueOrDefault(
    remoteConfig.value,
    'comfy_platform_base_url',
    buildTimePlatformBaseUrlValue
  )
}
