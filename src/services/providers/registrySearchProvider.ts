import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { SearchNodePacksParams } from '@/types/algoliaTypes'
import type { components, operations } from '@/types/comfyRegistryTypes'
import type {
  NodePackSearchProvider,
  SearchFilter,
  SearchPacksResult,
  SortableField
} from '@/types/searchServiceTypes'

type RegistryNodePack = components['schemas']['Node']
type ListNodesParams = operations['listAllNodes']['parameters']['query']
type SearchNodesParams = operations['searchNodes']['parameters']['query']

/**
 * Search provider for the Comfy Registry.
 * Uses public Comfy Registry API.
 */
export const useComfyRegistrySearchProvider = (): NodePackSearchProvider => {
  const registryStore = useComfyRegistryStore()
  const systemStatsStore = useSystemStatsStore()

  /**
   * Search for node packs using the Comfy Registry API.
   */
  const searchPacks = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksResult> => {
    const {
      pageSize,
      pageNumber,
      restrictSearchableAttributes,
      filters,
      sortField,
      sortDirection
    } = params

    // Determine search mode based on searchable attributes
    const isNodeSearch = restrictSearchableAttributes?.includes('comfy_nodes')
    const hasSearchQuery = query && query.trim().length > 0

    let searchResult: { nodes?: RegistryNodePack[] } | null = null

    if (hasSearchQuery) {
      // Use /nodes/search endpoint when there's a search query
      const searchParams: SearchNodesParams = {
        search: isNodeSearch ? undefined : query,
        comfy_node_search: isNodeSearch ? query : undefined,
        limit: pageSize,
        page: pageNumber + 1 // API uses 1-based page numbers
      }

      // Apply filters that are supported by search endpoint
      if (filters) {
        if (typeof filters.supported_os === 'string') {
          searchParams.supported_os = filters.supported_os
        }
        // Map from our unified filter name to the search endpoint's parameter name
        if (typeof filters.supported_accelerator === 'string') {
          searchParams.supported_accelerator = filters.supported_accelerator
        }
      }

      searchResult = await registryStore.search.call(searchParams)
    } else {
      // Use /nodes endpoint when there's no search query (supports more parameters)
      const listParams: ListNodesParams = {
        limit: pageSize,
        page: pageNumber + 1 // API uses 1-based page numbers
      }

      // Apply filters that are supported by list endpoint
      if (filters) {
        if (typeof filters.supported_os === 'string') {
          listParams.supported_os = filters.supported_os
        }
        if (typeof filters.supported_accelerator === 'string') {
          listParams.supported_accelerator = filters.supported_accelerator
        }
        if (typeof filters.timestamp === 'string') {
          listParams.timestamp = filters.timestamp
        }
      }

      // Apply sort if provided (only supported by list endpoint)
      if (sortField) {
        // Validate sort field to prevent malformed API requests
        if (!/^[a-zA-Z_]+$/.test(sortField)) {
          throw new Error(`Invalid sort field: ${sortField}`)
        }
        const sortParam =
          sortDirection === 'desc' ? `${sortField};desc` : sortField
        listParams.sort = [sortParam]
      }

      searchResult = await registryStore.listAllPacks.call(listParams)
    }

    if (!searchResult || !searchResult.nodes) {
      return {
        nodePacks: [],
        querySuggestions: []
      }
    }

    return {
      nodePacks: searchResult.nodes,
      querySuggestions: [] // Registry doesn't support query suggestions
    }
  }

  const clearSearchCache = () => {
    registryStore.search.clear()
  }

  const getSortValue = (
    pack: RegistryNodePack,
    sortField: string
  ): string | number => {
    switch (sortField) {
      case 'total_install':
        return pack.downloads ?? 0
      case 'name':
        return pack.name ?? ''
      case 'publisher_name':
        return pack.publisher?.name ?? ''
      case 'last_updated':
        return pack.latest_version?.createdAt
          ? new Date(pack.latest_version.createdAt).getTime()
          : 0
      default:
        return 0
    }
  }

  const getSortableFields = (): SortableField[] => {
    return [
      { id: 'total_install', label: 'Downloads', direction: 'desc' },
      { id: 'name', label: 'Name', direction: 'asc' },
      { id: 'publisher_name', label: 'Publisher', direction: 'asc' },
      { id: 'last_updated', label: 'Updated', direction: 'desc' }
    ]
  }

  /**
   * Map system OS to filter value
   */
  const getDefaultOSFilter = (): string | undefined => {
    const stats = systemStatsStore.systemStats
    if (!stats?.system?.os) return undefined

    const osLower = stats.system.os.toLowerCase()
    if (osLower.includes('windows')) return 'windows'
    if (osLower.includes('darwin') || osLower.includes('mac')) return 'macos'
    if (osLower.includes('linux')) return 'linux'
    return undefined
  }

  /**
   * Map system GPU to filter value
   */
  const getDefaultAcceleratorFilter = (): string | undefined => {
    const stats = systemStatsStore.systemStats
    if (!stats?.devices || stats.devices.length === 0) return undefined

    // Look for the first GPU device - check for additional patterns
    for (const device of stats.devices) {
      const deviceType = device.type.toLowerCase()
      if (deviceType.includes('nvidia') || deviceType.includes('cuda'))
        return 'cuda'
      if (deviceType.includes('apple') || deviceType.includes('mps'))
        return 'mps'
      if (deviceType.includes('amd') || deviceType.includes('rocm'))
        return 'rocm'
      if (deviceType.includes('directml')) return 'directml'
    }
    return undefined
  }

  const getFilterableFields = (): SearchFilter[] => {
    return [
      {
        id: 'supported_os',
        label: 'Operating System',
        type: 'single-select',
        options: [
          { value: 'windows', label: 'Windows' },
          { value: 'macos', label: 'macOS' },
          { value: 'linux', label: 'Linux' }
        ],
        defaultValue: getDefaultOSFilter()
      },
      {
        // Note: search endpoint uses singular, list endpoint uses plural
        id: 'supported_accelerator',
        label: 'GPU Support',
        type: 'single-select',
        options: [
          { value: 'cuda', label: 'CUDA (NVIDIA)' },
          { value: 'directml', label: 'DirectML' },
          { value: 'rocm', label: 'ROCm (AMD)' },
          { value: 'mps', label: 'Metal (Apple)' }
        ],
        defaultValue: getDefaultAcceleratorFilter()
      },
      {
        // Note: timestamp filter is only available on the list endpoint (no search query)
        id: 'timestamp',
        label: 'Updated Since',
        type: 'single-select',
        options: [
          {
            value: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            label: 'Last 24 hours'
          },
          {
            value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            label: 'Last week'
          },
          {
            value: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            label: 'Last month'
          },
          {
            value: new Date(
              Date.now() - 90 * 24 * 60 * 60 * 1000
            ).toISOString(),
            label: 'Last 3 months'
          },
          {
            value: new Date(
              Date.now() - 180 * 24 * 60 * 60 * 1000
            ).toISOString(),
            label: 'Last 6 months'
          },
          {
            value: new Date(
              Date.now() - 365 * 24 * 60 * 60 * 1000
            ).toISOString(),
            label: 'Last year'
          }
        ]
      }
    ]
  }

  return {
    searchPacks,
    clearSearchCache,
    getSortValue,
    getSortableFields,
    getFilterableFields
  }
}
