import axios from 'axios'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { useAuthStore } from '@/stores/authStore'

/**
 * Resolve a RemoteOptions route to a full URL.
 * - useComfyApi=true → prepend getComfyApiBaseUrl()
 * - Otherwise → use as-is
 */
export function resolveRoute(
  route: string,
  useComfyApi?: boolean
): string {
  if (useComfyApi) {
    return getComfyApiBaseUrl() + route
  }
  return route
}

/**
 * Get auth headers for a remote request.
 * - useComfyApi=true → inject auth headers (comfy-api requires it)
 * - Otherwise → no auth headers injected
 */
export async function getRemoteAuthHeaders(
  useComfyApi?: boolean
): Promise<Record<string, any>> {
  if (useComfyApi) {
    const authStore = useAuthStore()
    const authHeader = await authStore.getAuthHeader()
    if (authHeader) {
      return { headers: authHeader }
    }
  }
  return {}
}

/**
 * Convenience: make an authenticated GET request to a remote route.
 */
export async function fetchRemoteRoute(
  route: string,
  options: {
    params?: Record<string, string>
    timeout?: number
    signal?: AbortSignal
    useComfyApi?: boolean
  } = {}
) {
  const { useComfyApi, ...requestOptions } = options
  const url = resolveRoute(route, useComfyApi)
  const authHeaders = await getRemoteAuthHeaders(useComfyApi)
  return axios.get(url, { ...requestOptions, ...authHeaders })
}
