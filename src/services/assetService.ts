import { api } from '@/scripts/api'
import {
  generateAllStandardPaths,
  getDirectoryConfig,
  getLegacyDirectoryOrder
} from '@/utils/modelPaths'

const ASSETS_ENDPOINT = '/assets'
const MODELS_TAG = 'models'
const MISSING_TAG = 'missing'

// Legacy model directory order (excluding blacklisted configs, custom_nodes)
const LEGACY_ORDER = [
  'checkpoints',
  'clip',
  'clip_vision',
  'controlnet',
  'diffusion_models',
  'embeddings',
  'gligen',
  'hypernetworks',
  'loras',
  'style_models',
  'unet',
  'upscale_models',
  'vae'
] as const

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
   * 1. Always start with LEGACY_ORDER
   * 2. Find any unknown folders
   * 3. Sort unknowns alphabetically and append
   * 4. Map to final format with standard paths
   *
   * @returns The list of model folder keys
   */
  async function getAssetModelFolders(): Promise<
    { name: string; folders: string[] }[]
  > {
    const data = await handleAssetRequest(
      `${ASSETS_ENDPOINT}?tags=${MODELS_TAG}`,
      'model folders'
    )

    // Get all standard model directories, excluding blacklisted ones to match experimental API
    const folderBlacklist = ['configs', 'custom_nodes']
    const allStandardDirectories = new Set(
      getLegacyDirectoryOrder().filter((dir) => !folderBlacklist.includes(dir))
    )

    // Get all valid model directory names and aliases from the config
    const validModelFolders = new Set<string>()
    for (const directory of allStandardDirectories) {
      const config = getDirectoryConfig(directory)
      if (!config) continue
      validModelFolders.add(directory)
      for (const alias of config.aliases) {
        validModelFolders.add(alias)
      }
    }

    // Extract folder names from assets, but only include valid model directories and exclude missing assets
    const discoveredFolders = new Set<string>()
    if (data?.assets) {
      const validTags = data.assets
        .filter((asset): asset is Asset =>
          Boolean(
            asset &&
              Array.isArray(asset.tags) &&
              !asset.tags.includes(MISSING_TAG)
          )
        )
        .flatMap((asset) => asset.tags)
        .filter((tag) => tag !== MODELS_TAG && validModelFolders.has(tag))

      for (const tag of validTags) {
        discoveredFolders.add(tag)
      }
    }

    // Combine all standard directories with discovered valid folders
    const allFolders = new Set([
      ...allStandardDirectories,
      ...discoveredFolders
    ])
    const standardPaths = generateAllStandardPaths()

    // Legacy order first, then any unknown folders alphabetically
    const legacySet = new Set<string>(LEGACY_ORDER)
    const unknownFolders = Array.from(allFolders)
      .filter((folder) => !legacySet.has(folder))
      .sort()

    return [...LEGACY_ORDER, ...unknownFolders].map((name) => ({
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
