import { api } from '@/scripts/api'
import { generateAllStandardPaths } from '@/utils/modelPaths'

const ASSETS_ENDPOINT = '/assets'
const MODELS_TAG = 'models'
const MISSING_TAG = 'missing'

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
   * Gets a list of model folder keys from the asset API
   *
   * Logic:
   * 1. Extract directory names directly from asset tags
   * 2. Filter out blacklisted directories
   * 3. Return alphabetically sorted directories with assets
   *
   * @returns The list of model folder keys
   */
  async function getAssetModelFolders(): Promise<
    { name: string; folders: string[] }[]
  > {
    const data = await handleAssetRequest(
      `${ASSETS_ENDPOINT}?include_tags=${MODELS_TAG}`,
      'model folders'
    )

    // Blacklist directories we don't want to show
    const blacklistedDirectories = ['configs']

    // Extract directory names from assets that actually exist, exclude missing assets
    const discoveredFolders = new Set<string>()
    if (data?.assets) {
      const directoryTags = data.assets
        .filter((asset): asset is Asset =>
          Boolean(
            asset &&
              Array.isArray(asset.tags) &&
              !asset.tags.includes(MISSING_TAG)
          )
        )
        .flatMap((asset) => asset.tags)
        .filter(
          (tag) => tag !== MODELS_TAG && !blacklistedDirectories.includes(tag)
        )

      for (const tag of directoryTags) {
        discoveredFolders.add(tag)
      }
    }

    // Return only discovered folders in alphabetical order
    const sortedFolders = Array.from(discoveredFolders).sort()
    const standardPaths = generateAllStandardPaths()

    return sortedFolders.map((name) => ({
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
      `${ASSETS_ENDPOINT}?include_tags=${MODELS_TAG},${folder}`,
      `models for ${folder}`
    )

    return !data?.assets
      ? []
      : data.assets
          .filter((asset): asset is Asset =>
            Boolean(
              asset &&
                asset.name &&
                Array.isArray(asset.tags) &&
                asset.tags.includes(folder) &&
                !asset.tags.includes(MISSING_TAG)
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
