import axios from 'axios'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { useAuthStore } from '@/stores/authStore'

/**
 * Check if a route is a comfy-api proxy route.
 * These routes need the comfy-api base URL prepended and always require auth.
 */
function isProxyRoute(route: string): boolean {
  return route.startsWith('/proxy/')
}

/**
 * Resolve a RemoteOptions route to a full URL.
 * - "/proxy/..." routes → prepend getComfyApiBaseUrl()
 * - Everything else → use as-is
 */
export function resolveRoute(route: string): string {
  if (isProxyRoute(route)) {
    return getComfyApiBaseUrl() + route
  }
  return route
}

/**
 * Get auth headers for a remote request.
 * - "/proxy/..." routes → ALWAYS inject auth (comfy-api requires it)
 * - Other routes → only inject auth in cloud mode
 */
export async function getRemoteAuthHeaders(
  route: string
): Promise<Record<string, any>> {
  if (isProxyRoute(route)) {
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
  } = {}
) {
  const url = resolveRoute(route)
  const authHeaders = await getRemoteAuthHeaders(route)
  return axios.get(url, { ...options, ...authHeaders })
}
