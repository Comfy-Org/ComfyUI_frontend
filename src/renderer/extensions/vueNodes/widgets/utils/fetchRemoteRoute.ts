import axios from 'axios'

import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'

/**
 * Resolve a RemoteComboOptions route to a full URL. Routes are always relative
 * paths and are prepended with the comfy-api base URL.
 */
function resolveRoute(route: string): string {
  return getComfyApiBaseUrl() + route
}

/**
 * Get auth headers for a remote request. Always injected — comfy-api requires it.
 */
async function getRemoteAuthHeaders(): Promise<{ headers?: AuthHeader }> {
  const authStore = useAuthStore()
  const authHeader = await authStore.getAuthHeader()
  if (authHeader) {
    return { headers: authHeader }
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
  const authHeaders = await getRemoteAuthHeaders()
  return axios.get(url, { ...options, ...authHeaders })
}
