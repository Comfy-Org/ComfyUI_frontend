import {
  assetItemSchema,
  assetFilenameSchema
} from '@comfyorg/assets-core/schema'
import type { ModelBrowserAsset } from '@comfyorg/assets-core/schema'
import {
  MISSING_TAG,
  MODELS_TAG,
  getAssetFilename,
  getAssetNodeCategoryCandidates
} from '@comfyorg/assets-core/metadata'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import type { ModelNodeProvider } from '@/stores/modelToNodeStore'

type ResolveErrorCode = 'INVALID_ASSET' | 'NO_PROVIDER'

export interface ResolveModelNodeError {
  code: ResolveErrorCode
  message: string
  assetId: string
  details?: Record<string, unknown>
}

interface ResolvedModelNode {
  provider: ModelNodeProvider
  filename: string
}

type Result<T, E> = { success: true; value: T } | { success: false; error: E }

/**
 * Resolves an asset item to the node provider and filename needed to add a
 * model loader node. Validation failures return error results rather than
 * throwing, so callers can degrade gracefully in UI contexts.
 */
export function resolveModelNodeFromAsset(
  asset: ModelBrowserAsset
): Result<ResolvedModelNode, ResolveModelNodeError> {
  const validatedAsset = assetItemSchema.safeParse(asset)

  if (!validatedAsset.success) {
    const errorMessage = validatedAsset.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    console.error('Invalid asset item:', errorMessage)
    return {
      success: false,
      error: {
        code: 'INVALID_ASSET',
        message: 'Asset schema validation failed',
        assetId: typeof asset.id === 'string' ? asset.id : 'unknown',
        details: { validationErrors: errorMessage }
      }
    }
  }

  const validAsset = validatedAsset.data

  const filename = validAsset.loader_path ?? getAssetFilename(validAsset)
  if (
    filename.length === 0 ||
    (validAsset.loader_path != null &&
      !assetFilenameSchema.safeParse(validAsset.loader_path).success)
  ) {
    console.error(`Asset ${validAsset.id} has an invalid loader filename`)
    return {
      success: false,
      error: {
        code: 'INVALID_ASSET',
        message:
          'Invalid filename (expected non-empty string and a safe relative loader path)',
        assetId: validAsset.id
      }
    }
  }

  if (validAsset.tags.length === 0) {
    console.error(
      `Asset ${validAsset.id} has no tags defined (expected at least one category tag)`
    )
    return {
      success: false,
      error: {
        code: 'INVALID_ASSET',
        message: 'Asset has no tags defined',
        assetId: validAsset.id
      }
    }
  }

  const { flags } = useFeatureFlags()
  const candidates = getAssetNodeCategoryCandidates(
    { ...validAsset, browserCategories: asset.browserCategories },
    flags.supportsModelTypeTags
  )
  if (candidates.length === 0) {
    console.error(
      `Asset ${validAsset.id} has no valid category tag. Available tags: ${validAsset.tags.join(', ')} (expected tag other than '${MODELS_TAG}' or '${MISSING_TAG}')`
    )
    return {
      success: false,
      error: {
        code: 'INVALID_ASSET',
        message: 'Asset has no valid category tag',
        assetId: validAsset.id,
        details: { availableTags: validAsset.tags }
      }
    }
  }

  const modelToNodeStore = useModelToNodeStore()
  const resolved = candidates
    .map((category) => ({
      category,
      provider: modelToNodeStore.getNodeProvider(category)
    }))
    .find((candidate) => candidate.provider !== undefined)

  if (!resolved?.provider) {
    console.error(
      `No node provider registered for category: ${candidates.join(', ')}`
    )
    return {
      success: false,
      error: {
        code: 'NO_PROVIDER',
        message: `No node provider registered for category: ${candidates.join(', ')}`,
        assetId: validAsset.id,
        details: { candidates }
      }
    }
  }

  return { success: true, value: { provider: resolved.provider, filename } }
}
