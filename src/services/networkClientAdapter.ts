import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import axios from 'axios'

import { headerRegistry } from '@/services/headerRegistry'
import type { HeaderProviderContext } from '@/types/headerTypes'

/**
 * Creates an axios instance with automatic header injection from the registry
 * @param config - Base axios configuration
 * @returns Axios instance with header injection
 */
export function createAxiosWithHeaders(
  config?: AxiosRequestConfig
): AxiosInstance {
  const instance = axios.create(config)

  // Add request interceptor to inject headers
  instance.interceptors.request.use(
    async (requestConfig) => {
      // Build context for header providers
      const context: HeaderProviderContext = {
        url: requestConfig.url || '',
        method: requestConfig.method || 'GET',
        body: requestConfig.data,
        config: requestConfig
      }

      // Get headers from registry
      const registryHeaders = await headerRegistry.getHeaders(context)

      // Merge with existing headers (registry headers take precedence)
      for (const [key, value] of Object.entries(registryHeaders)) {
        requestConfig.headers[key] = value
      }

      return requestConfig
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  return instance
}

/**
 * Wraps the native fetch API with header injection from the registry
 * @param input - Request URL or Request object
 * @param init - Request initialization options
 * @returns Promise resolving to Response
 */
export async function fetchWithHeaders(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Extract URL and method for context
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
  const method =
    init?.method || (input instanceof Request ? input.method : 'GET')

  // Build context for header providers
  const context: HeaderProviderContext = {
    url,
    method,
    body: init?.body
  }

  // Get headers from registry
  const registryHeaders = await headerRegistry.getHeaders(context)

  // Convert registry headers to Headers object format
  const headers = new Headers(init?.headers)
  for (const [key, value] of Object.entries(registryHeaders)) {
    headers.set(key, String(value))
  }

  // Perform fetch with merged headers
  return fetch(input, {
    ...init,
    headers
  })
}
