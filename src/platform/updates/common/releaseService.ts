import axios from 'axios'
import { watch } from 'vue'

import { createDefaultErrorMapper } from '@/composables/apiErrorMapper'
import { useApiRequest } from '@/composables/useApiRequest'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import type { components, operations } from '@/types/comfyRegistryTypes'

// Use generated types from OpenAPI spec
export type ReleaseNote = components['schemas']['ReleaseNote']
type GetReleasesParams = operations['getReleaseNotes']['parameters']['query']

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

  const mapError = createDefaultErrorMapper({
    formatFallback: (context, message) => `${context}: ${message}`,
    unknownErrorMessage: 'Unknown error occurred',
    statusMessages: {
      400: (message) => `Bad request: ${message || 'Invalid input'}`,
      401: 'Unauthorized: Authentication required',
      403: (message) => `Forbidden: ${message || 'Access denied'}`,
      404: (message) => `Not found: ${message || 'Resource not found'}`,
      500: (message) => `Server error: ${message || 'Internal server error'}`
    },
    responseFallback: ({ context, dataMessage, axiosMessage }) =>
      `${context}: ${dataMessage || axiosMessage}`
  })

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
