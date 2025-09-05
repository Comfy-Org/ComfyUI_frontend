import { api } from '@/scripts/api'

const ASSETS_ENDPOINT = '/assets'
const MODELS_TAG = 'models'

// Types for asset API responses
interface AssetResponse {
  assets?: Asset[]
  total?: number
  has_more?: boolean
}

interface Asset {
  id: string
  name: string
  tags: string[]
  size: number
  created_at?: string
}

/**
 * Private service for asset-related network requests
 * Not exposed globally - used internally by ComfyApi
 */
function createAssetService() {
  /**
   * Handles API response with consistent error handling
   */
  async function handleAssetRequest(
    url: string,
    context: string
  ): Promise<AssetResponse> {
    const res = await api.fetchApi(url)
    if (!res.ok) {
      throw new Error(
        `Unable to load ${context}: Server returned ${res.status}. Please try again.`
      )
    }
    return await res.json()
  }
  /**
   * Gets a list of model folder keys from the asset API (eg ['checkpoints', 'loras', ...])
   * @returns The list of model folder keys
   */
  async function getAssetModelFolders(): Promise<
    { name: string; folders: string[] }[]
  > {
    const data = await handleAssetRequest(
      `${ASSETS_ENDPOINT}?tags=${MODELS_TAG}`,
      'model folders'
    )

    if (!data?.assets) {
      return []
    }

    const folderNames = new Set(
      data.assets
        .filter((asset): asset is Asset =>
          Boolean(asset && Array.isArray(asset.tags))
        )
        .flatMap((asset) => asset.tags)
        .filter((tag) => tag !== MODELS_TAG)
    )

    const { generateAllStandardPaths } = await import('@/utils/modelPaths')
    const standardPaths = generateAllStandardPaths()

    return Array.from(folderNames).map((name) => ({
      name,
      folders: standardPaths[name] || []
    }))
  }

  /**
   * Gets a list of models in the specified folder from the asset API
   * @param folder The folder to list models from, such as 'checkpoints'
   * @returns The list of model filenames within the specified folder
   */
  async function getAssetModels(
    folder: string
  ): Promise<{ name: string; pathIndex: number }[]> {
    const data = await handleAssetRequest(
      `${ASSETS_ENDPOINT}?tags=${MODELS_TAG},${folder}`,
      `models for ${folder}`
    )

    if (!data?.assets) {
      return []
    }

    return data.assets
      .filter((asset): asset is Asset =>
        Boolean(
          asset &&
            asset.name &&
            Array.isArray(asset.tags) &&
            asset.tags.includes(folder)
        )
      )
      .map((asset) => ({
        name: asset.name,
        pathIndex: 0
      }))
  }

  return {
    getAssetModelFolders,
    getAssetModels
  }
}

export const assetService = createAssetService()
