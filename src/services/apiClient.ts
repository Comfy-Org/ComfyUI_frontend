import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import axios from 'axios'

// A hung socket (e.g. no internet, captive portal) never rejects without a
// timeout, leaving callers stuck in their loading state. This is the single
// home for that policy; callers override `timeout` when they need a different
// ceiling.
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000

/**
 * Create an axios client with the shared defaults (JSON content type and a
 * request timeout). Each service still supplies its own `baseURL` and may
 * override the `timeout` or add other axios options (e.g. `paramsSerializer`).
 */
export function createApiClient(
  config: Omit<AxiosRequestConfig, 'headers'> = {}
): AxiosInstance {
  return axios.create({
    timeout: DEFAULT_REQUEST_TIMEOUT_MS,
    ...config,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
