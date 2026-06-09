import axios from 'axios'
import type { AxiosInstance } from 'axios'

import { getComfyApiBaseUrl, getComfyPlatformBaseUrl } from '@/config/comfyApi'
import {
  isAccountBannedResponseBody,
  notifyAccountBanned
} from '@/platform/auth/accountBanned'

/**
 * Registers a response interceptor that reports an account ban whenever the
 * client receives a 403 carrying the ACCOUNT_BANNED code, then rethrows so each
 * caller's existing error handling is unaffected.
 */
export function addAccountBannedInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(undefined, (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      isAccountBannedResponseBody(error.response.data)
    ) {
      notifyAccountBanned()
    }
    return Promise.reject(error)
  })
}

/**
 * Wraps the global fetch so a banned 403 from a fetch-based call to one of our
 * cloud hosts (the comfy-api registry, the cloud ingest server, the platform,
 * subscriptions, etc.) reports an account ban. Responses from third-party hosts
 * are ignored, and the original response is returned untouched to callers.
 */
export function installAccountBannedFetchInterceptor(): void {
  const originalFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (
    ...args: Parameters<typeof fetch>
  ): Promise<Response> => {
    const response = await originalFetch(...args)
    if (response.status === 403 && isOurCloudUrl(requestUrl(args[0]))) {
      void reportIfBanned(response.clone())
    }
    return response
  }
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function isOurCloudUrl(url: string): boolean {
  try {
    const host = new URL(url, globalThis.location?.href).host
    return ourCloudHosts().has(host)
  } catch {
    return false
  }
}

function ourCloudHosts(): Set<string> {
  const hosts = new Set<string>()
  hosts.add(new URL(getComfyApiBaseUrl()).host)
  hosts.add(new URL(getComfyPlatformBaseUrl()).host)
  if (globalThis.location?.host) {
    hosts.add(globalThis.location.host)
  }
  return hosts
}

async function reportIfBanned(response: Response): Promise<void> {
  try {
    const body: unknown = await response.json()
    if (isAccountBannedResponseBody(body)) {
      notifyAccountBanned()
    }
  } catch {
    // Body was not banned-shaped JSON; treat as an ordinary 403.
  }
}
