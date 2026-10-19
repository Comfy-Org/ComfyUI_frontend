import axios from 'axios'
import { watch } from 'vue'

import { useApiRequest } from '@/composables/useApiRequest'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import type { components, operations } from '@/types/comfyRegistryTypes'

// Use generated types from OpenAPI spec
export type ReleaseNote = components['schemas']['ReleaseNote']
type GetReleasesParams = operations['getReleaseNotes']['parameters']['query']

// Use generated error response type
type ErrorResponse = components['schemas']['ErrorResponse']

const releaseApiClient = axios.create({
  baseURL: getComfyApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
})

// Release service for fetching release notes
export const useReleaseService = () => {
  watch(
    () => getComfyApiBaseUrl(),
    (url) => {
      releaseApiClient.defaults.baseURL = url
    }
  )

  const mapError = (
    err: unknown,
    context: string,
    routeSpecificErrors?: Record<number, string>
  ): string => {
    if (!axios.isAxiosError<ErrorResponse>(err))
      return err instanceof Error
        ? `${context}: ${err.message}`
        : `${context}: Unknown error occurred`

    if (err.response) {
      const { status, data } = err.response

      if (routeSpecificErrors && routeSpecificErrors[status])
        return routeSpecificErrors[status]

      switch (status) {
        case 400:
          return `Bad request: ${data.message || 'Invalid input'}`
        case 401:
          return 'Unauthorized: Authentication required'
        case 403:
          return `Forbidden: ${data.message || 'Access denied'}`
        case 404:
          return `Not found: ${data.message || 'Resource not found'}`
        case 500:
          return `Server error: ${data.message || 'Internal server error'}`
        default:
          return `${context}: ${data.message || err.message}`
      }
    }

    return `${context}: ${err.message}`
  }

  const { isLoading, error, executeRequest } = useApiRequest({
    client: releaseApiClient,
    mapError
  })

  // Fetch release notes from API
  const getReleases = async (
    params: GetReleasesParams,
    options: { signal?: AbortSignal; deployEnvironment?: string } = {}
  ): Promise<ReleaseNote[] | null> => {
    const { signal, deployEnvironment } = options
    const endpoint = '/releases'
    const errorContext = 'Failed to get releases'
    const routeSpecificErrors = {
      400: 'Invalid project or version parameter'
    }

    const apiResponse = await executeRequest(
      (client) =>
        client.get<ReleaseNote[]>(endpoint, {
          params,
          signal,
          headers: deployEnvironment
            ? { 'Comfy-Env': deployEnvironment }
            : undefined
        }),
      { errorContext, routeSpecificErrors }
    )

    return apiResponse
  }

  return {
    isLoading,
    error,
    getReleases
  }
}
