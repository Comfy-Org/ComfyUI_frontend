import { fromZodError } from 'zod-validation-error'

import {
  type AssetItem,
  type AssetResponse,
  type ModelFile,
  type ModelFolder,
  assetResponseSchema
} from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

const ASSETS_ENDPOINT = '/assets'
const MODELS_TAG = 'models'
const MISSING_TAG = 'missing'
const EXPERIMENTAL_WARNING = `EXPERIMENTAL: If you are seeing this please make sure "Comfy.Assets.UseAssetAPI" is set to "false" in your ComfyUI Settings.\n`

/**
 * Input names that are eligible for asset browser
 */
const WHITELISTED_INPUTS = new Set(['ckpt_name', 'lora_name', 'vae_name'])

/**
 * Validates asset response data using Zod schema
 */
function validateAssetResponse(data: unknown): AssetResponse {
  const result = assetResponseSchema.safeParse(data)
  if (result.success) return result.data

  const error = fromZodError(result.error)
  throw new Error(
    `${EXPERIMENTAL_WARNING}Invalid asset response against zod schema:\n${error}`
  )
}

/**
 * Private service for asset-related network requests
 * Not exposed globally - used internally by ComfyApi
 */
function createAssetService() {
  /**
   * Handles API response with consistent error handling and Zod validation
   */
  async function handleAssetRequest(
    url: string,
    context: string
  ): Promise<AssetResponse> {
    const res = await api.fetchApi(url)
    if (!res.ok) {
      throw new Error(
        `${EXPERIMENTAL_WARNING}Unable to load ${context}: Server returned ${res.status}. Please try again.`
      )
    }
    const data = await res.json()
    return validateAssetResponse(data)
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
  async function getAssetModelFolders(): Promise<ModelFolder[]> {
    const data = await handleAssetRequest(
      `${ASSETS_ENDPOINT}?include_tags=${MODELS_TAG}`,
      'model folders'
    )

    // Blacklist directories we don't want to show
    const blacklistedDirectories = new Set(['configs'])

    // Extract directory names from assets that actually exist, exclude missing assets
    const discoveredFolders = new Set<string>(
      data?.assets
        ?.filter((asset) => !asset.tags.includes(MISSING_TAG))
        ?.flatMap((asset) => asset.tags)
        ?.filter(
          (tag) => tag !== MODELS_TAG && !blacklistedDirectories.has(tag)
        ) ?? []
    )

    // Return only discovered folders in alphabetical order
    const sortedFolders = Array.from(discoveredFolders).toSorted()
    return sortedFolders.map((name) => ({ name, folders: [] }))
  }

  /**
   * Gets a list of models in the specified folder from the asset API
   * @param folder The folder to list models from, such as 'checkpoints'
   * @returns The list of model filenames within the specified folder
   */
  async function getAssetModels(folder: string): Promise<ModelFile[]> {
    const data = await handleAssetRequest(
      `${ASSETS_ENDPOINT}?include_tags=${MODELS_TAG},${folder}`,
      `models for ${folder}`
    )

    return (
      data?.assets
        ?.filter(
          (asset) =>
            !asset.tags.includes(MISSING_TAG) && asset.tags.includes(folder)
        )
        ?.map((asset) => ({
          name: asset.name,
          pathIndex: 0
        })) ?? []
    )
  }

  /**
   * Checks if a widget input should use the asset browser based on both input name and node comfyClass
   *
   * @param inputName - The input name (e.g., 'ckpt_name', 'lora_name')
   * @param nodeType - The ComfyUI node comfyClass (e.g., 'CheckpointLoaderSimple', 'LoraLoader')
   * @returns true if this input should use asset browser
   */
  function isAssetBrowserEligible(
    inputName: string,
    nodeType: string
  ): boolean {
    return (
      // Must be an approved input name
      WHITELISTED_INPUTS.has(inputName) &&
      // Must be a registered node type
      useModelToNodeStore().getRegisteredNodeTypes().has(nodeType)
    )
  }

  /**
   * Gets assets for a specific node type by finding the matching category
   * and fetching all assets with that category tag
   *
   * @param nodeType - The ComfyUI node type (e.g., 'CheckpointLoaderSimple')
   * @returns Promise<AssetItem[]> - Full asset objects with preserved metadata
   */
  async function getAssetsForNodeType(nodeType: string): Promise<AssetItem[]> {
    if (!nodeType || typeof nodeType !== 'string') {
      return []
    }

    // Find the category for this node type using efficient O(1) lookup
    const modelToNodeStore = useModelToNodeStore()
    const category = modelToNodeStore.getCategoryForNodeType(nodeType)

    if (!category) {
      return []
    }

    // Fetch assets for this category using same API pattern as getAssetModels
    const data = await handleAssetRequest(
      `${ASSETS_ENDPOINT}?include_tags=${MODELS_TAG},${category}`,
      `assets for ${nodeType}`
    )

    // Return full AssetItem[] objects (don't strip like getAssetModels does)
    return (
      data?.assets?.filter(
        (asset) =>
          !asset.tags.includes(MISSING_TAG) && asset.tags.includes(category)
      ) ?? []
    )
  }

  /**
   * Gets complete details for a specific asset by ID
   * Calls the detail endpoint which includes user_metadata and all fields
   *
   * @param id - The asset ID
   * @returns Promise<AssetItem> - Complete asset object with user_metadata
   */
  async function getAssetDetails(id: string): Promise<AssetItem> {
    const res = await api.fetchApi(`${ASSETS_ENDPOINT}/${id}`)
    if (!res.ok) {
      throw new Error(
        `${EXPERIMENTAL_WARNING}Unable to load asset details for ${id}: Server returned ${res.status}. Please try again.`
      )
    }
    const data = await res.json()

    // Validate the single asset response against our schema
    const result = assetResponseSchema.safeParse({ assets: [data] })
    if (result.success && result.data.assets?.[0]) {
      return result.data.assets[0]
    }

    const error = result.error
      ? fromZodError(result.error)
      : 'Unknown validation error'
    throw new Error(
      `${EXPERIMENTAL_WARNING}Invalid asset response against zod schema:\n${error}`
    )
  }

  return {
    getAssetModelFolders,
    getAssetModels,
    isAssetBrowserEligible,
    getAssetsForNodeType,
    getAssetDetails
  }
}

export const assetService = createAssetService()
