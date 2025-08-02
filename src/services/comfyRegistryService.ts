import axios, { AxiosError, AxiosResponse } from 'axios'
import { ref } from 'vue'

import type { components, operations } from '@/types/comfyRegistryTypes'
import { isAbortError } from '@/utils/typeGuardUtil'

const API_BASE_URL = 'https://api.comfy.org'

const registryApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  paramsSerializer: {
    // Disables PHP-style notation (e.g. param[]=value) in favor of repeated params (e.g. param=value1&param=value2)
    indexes: null
  }
})

/**
 * Service for interacting with the Comfy Registry API
 */
export const useComfyRegistryService = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const handleApiError = (
    err: unknown,
    context: string,
    routeSpecificErrors?: Record<number, string>
  ): string => {
    if (!axios.isAxiosError(err))
      return err instanceof Error
        ? `${context}: ${err.message}`
        : `${context}: Unknown error occurred`

    const axiosError = err as AxiosError<components['schemas']['ErrorResponse']>

    if (axiosError.response) {
      const { status, data } = axiosError.response

      if (routeSpecificErrors && routeSpecificErrors[status])
        return routeSpecificErrors[status]

      switch (status) {
        case 400:
          return `Bad request: ${data?.message || 'Invalid input'}`
        case 401:
          return 'Unauthorized: Authentication required'
        case 403:
          return `Forbidden: ${data?.message || 'Access denied'}`
        case 404:
          return `Not found: ${data?.message || 'Resource not found'}`
        case 409:
          return `Conflict: ${data?.message || 'Resource conflict'}`
        case 500:
          return `Server error: ${data?.message || 'Internal server error'}`
        default:
          return `${context}: ${data?.message || axiosError.message}`
      }
    }

    return `${context}: ${axiosError.message}`
  }

  /**
   * Execute an API request with error and loading state handling
   * @param apiCall - Function that returns a promise with the API call
   * @param errorContext - Context description for error messages
   * @param routeSpecificErrors - Optional map of status codes to custom error messages
   * @returns Promise with the API response data or null if the request failed
   */
  const executeApiRequest = async <T>(
    apiCall: () => Promise<AxiosResponse<T>>,
    errorContext: string,
    routeSpecificErrors?: Record<number, string>
  ): Promise<T | null> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiCall()
      return response.data
    } catch (err) {
      // Don't treat cancellations as errors
      if (isAbortError(err)) return null

      error.value = handleApiError(err, errorContext, routeSpecificErrors)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get the Comfy Node definitions in a specific version of a node pack
   * @param packId - The ID of the node pack
   * @param versionId - The version of the node pack
   * @returns The node definitions or null if not found or an error occurred
   */
  const getNodeDefs = async (
    params: {
      packId: components['schemas']['Node']['id']
      version: components['schemas']['NodeVersion']['version']
    } & operations['ListComfyNodes']['parameters']['query'],
    signal?: AbortSignal
  ) => {
    const { packId, version: versionId, ...queryParams } = params
    if (!packId || !versionId) return null

    const endpoint = `/nodes/${packId}/versions/${versionId}/comfy-nodes`
    const errorContext = 'Failed to get node definitions'
    const routeSpecificErrors = {
      403: 'This pack has been banned and its definition is not available',
      404: 'The requested node, version, or comfy node does not exist'
    }

    return executeApiRequest(
      () =>
        registryApiClient.get<
          operations['ListComfyNodes']['responses'][200]['content']['application/json']
        >(endpoint, {
          params: queryParams,
          signal
        }),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * Get a paginated list of packs matching specific criteria.
   * Search packs using `search` param. Search individual nodes using `comfy_node_search` param.
   */
  const search = async (
    params?: operations['searchNodes']['parameters']['query'],
    signal?: AbortSignal
  ) => {
    const endpoint = '/nodes/search'
    const errorContext = 'Failed to perform search'

    return executeApiRequest(
      () =>
        registryApiClient.get<
          operations['searchNodes']['responses'][200]['content']['application/json']
        >(endpoint, { params, signal }),
      errorContext
    )
  }

  /**
   * Get publisher information
   */
  const getPublisherById = async (
    publisherId: components['schemas']['Publisher']['id'],
    signal?: AbortSignal
  ) => {
    const endpoint = `/publishers/${publisherId}`
    const errorContext = 'Failed to get publisher'
    const routeSpecificErrors = {
      404: `Publisher not found: The publisher with ID ${publisherId} does not exist`
    }

    return executeApiRequest(
      () =>
        registryApiClient.get<components['schemas']['Publisher']>(endpoint, {
          signal
        }),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * List all packs associated with a specific publisher
   */
  const listPacksForPublisher = async (
    publisherId: components['schemas']['Publisher']['id'],
    includeBanned?: boolean,
    signal?: AbortSignal
  ) => {
    const params = includeBanned ? { include_banned: true } : undefined
    const endpoint = `/publishers/${publisherId}/nodes`
    const errorContext = 'Failed to list packs for publisher'
    const routeSpecificErrors = {
      400: 'Bad request: Invalid input data',
      404: `Publisher not found: The publisher with ID ${publisherId} does not exist`
    }

    return executeApiRequest(
      () =>
        registryApiClient.get<components['schemas']['Node'][]>(endpoint, {
          params,
          signal
        }),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * Add a review for a pack
   */
  const postPackReview = async (
    packId: components['schemas']['Node']['id'],
    star: number,
    signal?: AbortSignal
  ) => {
    const endpoint = `/nodes/${packId}/reviews`
    const params = { star }
    const errorContext = 'Failed to add review'
    const routeSpecificErrors = {
      400: 'Bad request: Invalid review',
      404: `Pack not found: Pack with ID ${packId} does not exist`
    }

    return executeApiRequest(
      () =>
        registryApiClient.post<components['schemas']['Node']>(endpoint, null, {
          params,
          signal
        }),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * Get a paginated list of all packs on the registry
   */
  const listAllPacks = async (
    params?: operations['listAllNodes']['parameters']['query'],
    signal?: AbortSignal
  ) => {
    const endpoint = '/nodes'
    const errorContext = 'Failed to list packs'

    return executeApiRequest(
      () =>
        registryApiClient.get<
          operations['listAllNodes']['responses'][200]['content']['application/json']
        >(endpoint, { params, signal }),
      errorContext
    )
  }

  /**
   * Get a list of all pack versions
   */
  const getPackVersions = async (
    packId: components['schemas']['Node']['id'],
    params?: operations['listNodeVersions']['parameters']['query'],
    signal?: AbortSignal
  ) => {
    const endpoint = `/nodes/${packId}/versions`
    const errorContext = 'Failed to get pack versions'
    const routeSpecificErrors = {
      403: 'This pack has been banned and its versions are not available',
      404: `Pack not found: Pack with ID ${packId} does not exist`
    }

    return executeApiRequest(
      () =>
        registryApiClient.get<components['schemas']['NodeVersion'][]>(
          endpoint,
          { params, signal }
        ),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * Get a specific pack by ID and version
   */
  const getPackByVersion = async (
    packId: components['schemas']['Node']['id'],
    versionId: components['schemas']['NodeVersion']['id'],
    signal?: AbortSignal
  ) => {
    const endpoint = `/nodes/${packId}/versions/${versionId}`
    const errorContext = 'Failed to get pack version'
    const routeSpecificErrors = {
      403: 'This pack has been banned and its versions are not available',
      404: `Pack not found: Pack with ID ${packId} does not exist`
    }

    return executeApiRequest(
      () =>
        registryApiClient.get<components['schemas']['NodeVersion']>(endpoint, {
          signal
        }),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * Get a specific pack by ID
   */
  const getPackById = async (
    packId: operations['getNode']['parameters']['path']['nodeId'],
    signal?: AbortSignal
  ) => {
    const endpoint = `/nodes/${packId}`
    const errorContext = 'Failed to get pack'
    const routeSpecificErrors = {
      404: `Pack not found: The pack with ID ${packId} does not exist`
    }

    return executeApiRequest(
      () =>
        registryApiClient.get<components['schemas']['Node']>(endpoint, {
          signal
        }),
      errorContext,
      routeSpecificErrors
    )
  }

  return {
    isLoading,
    error,

    listAllPacks,
    search,
    getPackById,
    getPackVersions,
    getPackByVersion,
    getPublisherById,
    listPacksForPublisher,
    getNodeDefs,
    postPackReview
  }
}
