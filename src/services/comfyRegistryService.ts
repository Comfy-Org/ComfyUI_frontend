import type { AxiosError } from 'axios'
import axios from 'axios'

import { useApiRequest } from '@/composables/useApiRequest'
import { t } from '@/i18n'
import type { components, operations } from '@/types/comfyRegistryTypes'

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
  const mapError = (
    err: unknown,
    context: string,
    routeSpecificErrors?: Record<number, string>
  ): string => {
    if (!axios.isAxiosError(err))
      return err instanceof Error
        ? t('serviceErrors.contextWithMessage', {
            context,
            message: err.message
          })
        : t('serviceErrors.unknownError', { context })

    const axiosError = err as AxiosError<components['schemas']['ErrorResponse']>

    if (axiosError.response) {
      const { status, data } = axiosError.response

      if (routeSpecificErrors && routeSpecificErrors[status])
        return routeSpecificErrors[status]

      switch (status) {
        case 400:
          return t('serviceErrors.badRequest', {
            message: data?.message || t('serviceErrors.invalidInput')
          })
        case 401:
          return t('serviceErrors.unauthorized')
        case 403:
          return t('serviceErrors.forbidden', {
            message: data?.message || t('serviceErrors.accessDenied')
          })
        case 404:
          return t('serviceErrors.notFound', {
            message: data?.message || t('serviceErrors.resourceNotFound')
          })
        case 409:
          return t('serviceErrors.conflict', {
            message: data?.message || t('serviceErrors.resourceConflict')
          })
        case 500:
          return t('serviceErrors.serverError', {
            message: data?.message || t('serviceErrors.internalServerError')
          })
        default:
          return t('serviceErrors.contextWithMessage', {
            context,
            message: data?.message || axiosError.message
          })
      }
    }

    return t('serviceErrors.contextWithMessage', {
      context,
      message: axiosError.message
    })
  }

  const { isLoading, error, executeRequest } = useApiRequest({
    client: registryApiClient,
    mapError
  })

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
    const errorContext = t('serviceErrors.context.getNodeDefs')
    const routeSpecificErrors = {
      403: t('serviceErrors.route.packBannedDefinition'),
      404: t('serviceErrors.route.nodeVersionNotFound')
    }

    return executeRequest(
      (client) =>
        client.get<
          operations['ListComfyNodes']['responses'][200]['content']['application/json']
        >(endpoint, {
          params: queryParams,
          signal
        }),
      { errorContext, routeSpecificErrors }
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
    const errorContext = t('serviceErrors.context.search')

    return executeRequest(
      (client) =>
        client.get<
          operations['searchNodes']['responses'][200]['content']['application/json']
        >(endpoint, { params, signal }),
      { errorContext }
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
    const errorContext = t('serviceErrors.context.getPublisher')
    const routeSpecificErrors = {
      404: t('serviceErrors.route.publisherNotFound', { publisherId })
    }

    return executeRequest(
      (client) =>
        client.get<components['schemas']['Publisher']>(endpoint, {
          signal
        }),
      { errorContext, routeSpecificErrors }
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
    const errorContext = t('serviceErrors.context.listPacksForPublisher')
    const routeSpecificErrors = {
      400: t('serviceErrors.route.invalidInputData'),
      404: t('serviceErrors.route.publisherNotFound', { publisherId })
    }

    return executeRequest(
      (client) =>
        client.get<components['schemas']['Node'][]>(endpoint, {
          params,
          signal
        }),
      { errorContext, routeSpecificErrors }
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
    const errorContext = t('serviceErrors.context.addReview')
    const routeSpecificErrors = {
      400: t('serviceErrors.route.invalidReview'),
      404: t('serviceErrors.route.packNotFound', { packId })
    }

    return executeRequest(
      (client) =>
        client.post<components['schemas']['Node']>(endpoint, null, {
          params,
          signal
        }),
      { errorContext, routeSpecificErrors }
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
    const errorContext = t('serviceErrors.context.listPacks')

    return executeRequest(
      (client) =>
        client.get<
          operations['listAllNodes']['responses'][200]['content']['application/json']
        >(endpoint, { params, signal }),
      { errorContext }
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
    const errorContext = t('serviceErrors.context.getPackVersions')
    const routeSpecificErrors = {
      403: t('serviceErrors.route.packBannedVersions'),
      404: t('serviceErrors.route.packNotFound', { packId })
    }

    return executeRequest(
      (client) =>
        client.get<components['schemas']['NodeVersion'][]>(endpoint, {
          params,
          signal
        }),
      { errorContext, routeSpecificErrors }
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
    const errorContext = t('serviceErrors.context.getPackVersion')
    const routeSpecificErrors = {
      403: t('serviceErrors.route.packBannedVersions'),
      404: t('serviceErrors.route.packNotFound', { packId })
    }

    return executeRequest(
      (client) =>
        client.get<components['schemas']['NodeVersion']>(endpoint, {
          signal
        }),
      { errorContext, routeSpecificErrors }
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
    const errorContext = t('serviceErrors.context.getPack')
    const routeSpecificErrors = {
      404: t('serviceErrors.route.packByIdNotFound', { packId })
    }

    return executeRequest(
      (client) =>
        client.get<components['schemas']['Node']>(endpoint, {
          signal
        }),
      { errorContext, routeSpecificErrors }
    )
  }

  /**
   * Get the node pack that contains a specific ComfyUI node by its name.
   * This method queries the registry to find which pack provides the given node.
   *
   * When multiple packs contain a node with the same name, the API returns the best match based on:
   * 1. Preemption match - If the node name matches any in the pack's preempted_comfy_node_names array
   * 2. Search ranking - Lower search_ranking values are preferred
   * 3. Total installs - Higher installation counts are preferred as a tiebreaker
   *
   * @param nodeName - The name of the ComfyUI node (e.g., 'KSampler', 'CLIPTextEncode')
   * @param signal - Optional AbortSignal for request cancellation
   * @returns The node pack containing the specified node, or null if not found or on error
   *
   * @example
   * ```typescript
   * const pack = await inferPackFromNodeName('KSampler')
   * if (pack) {
   *   console.log(`Node found in pack: ${pack.name}`)
   * }
   * ```
   */
  const inferPackFromNodeName = async (
    nodeName:
      | operations['getNodeByComfyNodeName']['parameters']['path']['comfyNodeName']
      | null
      | undefined,
    signal?: AbortSignal
  ) => {
    if (!nodeName || nodeName === 'undefined') return null

    const endpoint = `/comfy-nodes/${nodeName}/node`
    const errorContext = t('serviceErrors.context.inferPackFromNodeName')
    const routeSpecificErrors = {
      404: t('serviceErrors.route.comfyNodeNotFound', { nodeName })
    }

    return executeRequest(
      (client) =>
        client.get<components['schemas']['Node']>(endpoint, {
          signal
        }),
      { errorContext, routeSpecificErrors }
    )
  }

  /**
   * Get multiple pack versions in a single bulk request.
   * This is more efficient than making individual requests for each pack version.
   *
   * @param nodeVersions - Array of node ID and version pairs to retrieve
   * @param signal - Optional AbortSignal for request cancellation
   * @returns Bulk response containing the requested node versions or null on error
   *
   * @example
   * ```typescript
   * const versions = await getBulkNodeVersions([
   *   { node_id: 'ComfyUI-Manager', version: '1.0.0' },
   *   { node_id: 'ComfyUI-Impact-Pack', version: '2.0.0' }
   * ])
   * if (versions) {
   *   versions.node_versions.forEach(result => {
   *     if (result.status === 'success' && result.node_version) {
   *       console.log(`Retrieved ${result.identifier.node_id}@${result.identifier.version}`)
   *     }
   *   })
   * }
   * ```
   */
  const getBulkNodeVersions = async (
    nodeVersions: components['schemas']['NodeVersionIdentifier'][],
    signal?: AbortSignal
  ) => {
    const endpoint = '/bulk/nodes/versions'
    const errorContext = t('serviceErrors.context.getBulkNodeVersions')
    const routeSpecificErrors = {
      400: t('serviceErrors.route.invalidNodeVersionIdentifiers')
    }

    const requestBody: components['schemas']['BulkNodeVersionsRequest'] = {
      node_versions: nodeVersions
    }

    return executeRequest(
      (client) =>
        client.post<components['schemas']['BulkNodeVersionsResponse']>(
          endpoint,
          requestBody,
          {
            signal
          }
        ),
      { errorContext, routeSpecificErrors }
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
    postPackReview,
    inferPackFromNodeName,
    getBulkNodeVersions
  }
}
