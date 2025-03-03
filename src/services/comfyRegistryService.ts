import axios, { AxiosError, AxiosResponse } from 'axios'
import { ref } from 'vue'

import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { components, operations } from '@/types/comfyRegistryTypes'

const API_BASE_URL = 'https://api.comfy.org'

const registryApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Service for interacting with the Comfy Registry API
 */
export const useComfyRegistryService = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const nodeDefStore = useNodeDefStore()

  const isLocalNode = (nodeName: string, nodePackId: string) => {
    if (!nodeDefStore.nodeDefsByName[nodeName]) return false
    return (
      nodeDefStore.nodeDefsByName[nodeName].python_module.toLowerCase() ===
      nodePackId.toLowerCase()
    )
  }

  /**
   * Generic error handler for API requests
   * @param err - The error object
   * @param context - Context description for the error
   * @param routeSpecificErrors - Optional map of status codes to custom error messages for specific routes
   */
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
   * Helper function to execute API requests with consistent error and loading state handling
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
      const errorMessage = handleApiError(
        err,
        errorContext,
        routeSpecificErrors
      )
      error.value = errorMessage

      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get Comfy Node definition for a specific node in a specific version of a node pack
   * @param packId - The ID of the node pack
   * @param versionId - The version of the node pack
   * @param comfyNodeName - The name of the comfy node (corresponds to `ComfyNodeDef#name`)
   * @returns The node definition or null if not found or an error occurred
   */
  const getNodeDef = async (
    packId: components['schemas']['Node']['id'],
    versionId: components['schemas']['NodeVersion']['id'],
    comfyNodeName: components['schemas']['ComfyNode']['comfy_node_name']
  ) => {
    if (!comfyNodeName || !packId) return null
    if (isLocalNode(comfyNodeName, packId))
      return nodeDefStore.nodeDefsByName[comfyNodeName]

    const endpoint = `/nodes/${packId}/versions/${versionId}/comfy-nodes/${comfyNodeName}`
    const errorContext = 'Failed to get node definition'
    const routeSpecificErrors = {
      403: 'This pack has been banned and its definition is not available',
      404: 'The requested node, version, or comfy node does not exist'
    }

    return executeApiRequest(
      () => registryApiClient.get<components['schemas']['ComfyNode']>(endpoint),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * Get a paginated list of packs matching specific criteria.
   * Search packs using `search` param. Search individual nodes using `comfy_node_search` param.
   */
  const search = async (
    params?: operations['searchNodes']['parameters']['query']
  ) => {
    const endpoint = '/nodes/search'
    const errorContext = 'Failed to perform search'

    return executeApiRequest(
      () =>
        registryApiClient.get<
          operations['searchNodes']['responses'][200]['content']['application/json']
        >(endpoint, { params }),
      errorContext
    )
  }

  /**
   * Get publisher information
   */
  const getPublisherById = async (
    publisherId: components['schemas']['Publisher']['id']
  ) => {
    const endpoint = `/publishers/${publisherId}`
    const errorContext = 'Failed to get publisher'
    const routeSpecificErrors = {
      404: `Publisher not found: The publisher with ID ${publisherId} does not exist`
    }

    return executeApiRequest(
      () => registryApiClient.get<components['schemas']['Publisher']>(endpoint),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * List all packs associated with a specific publisher
   */
  const listPacksForPublisher = async (
    publisherId: components['schemas']['Publisher']['id'],
    includeBanned?: boolean
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
          params
        }),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * Add a review for a pack
   * @param packId - The ID of the pack
   * @param star - The star rating
   */
  const postPackReview = async (
    packId: components['schemas']['Node']['id'],
    star: number
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
          params
        }),
      errorContext,
      routeSpecificErrors
    )
  }
  /**
   * Get a paginated list of all packs on the registry
   */
  const listAllPacks = async (
    params?: operations['listAllNodes']['parameters']['query']
  ) => {
    const endpoint = '/nodes'
    const errorContext = 'Failed to list packs'

    return executeApiRequest(
      () =>
        registryApiClient.get<
          operations['listAllNodes']['responses'][200]['content']['application/json']
        >(endpoint, { params }),
      errorContext
    )
  }

  /**
   * Get a list of all pack versions
   */
  const getPackVersions = async (
    packId: components['schemas']['Node']['id'],
    params?: operations['listNodeVersions']['parameters']['query']
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
          { params }
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
    versionId: components['schemas']['NodeVersion']['id']
  ) => {
    const endpoint = `/nodes/${packId}/versions/${versionId}`
    const errorContext = 'Failed to get pack version'
    const routeSpecificErrors = {
      403: 'This pack has been banned and its versions are not available',
      404: `Pack not found: Pack with ID ${packId} does not exist`
    }

    return executeApiRequest(
      () =>
        registryApiClient.get<components['schemas']['NodeVersion']>(endpoint),
      errorContext,
      routeSpecificErrors
    )
  }

  /**
   * Get a specific pack by ID
   */
  const getPackById = async (
    packId: operations['getNode']['parameters']['path']['nodeId']
  ) => {
    const endpoint = `/nodes/${packId}`
    const errorContext = 'Failed to get pack'
    const routeSpecificErrors = {
      404: `Pack not found: The pack with ID ${packId} does not exist`
    }

    return executeApiRequest(
      () => registryApiClient.get<components['schemas']['Node']>(endpoint),
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
    getNodeDef,
    postPackReview
  }
}
