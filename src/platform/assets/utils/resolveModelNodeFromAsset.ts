import { assetItemSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  MISSING_TAG,
  MODELS_TAG
} from '@/platform/assets/services/assetService'
import {
  getAssetFilename,
  getAssetNodeCategoryCandidates
} from '@/platform/assets/utils/assetMetadataUtils'
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
  asset: AssetItem
): Result<ResolvedModelNode, ResolveModelNodeError> {
  const validatedAsset = assetItemSchema.safeParse(asset)

  if (!validatedAsset.success) {
    const errorMessage = validatedAsset.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    console.error('Invalid asset item:', errorMessage)
    return {
      success: false,
      error: {
        code: 'INVALID_ASSET',
        message: 'Asset schema validation failed',
        assetId: typeof asset?.id === 'string' ? asset.id : 'unknown',
        details: { validationErrors: errorMessage }
      }
    }
  }

  const validAsset = validatedAsset.data

  const filename = getAssetFilename(validAsset)
  if (filename.length === 0) {
    console.error(
      `Asset ${validAsset.id} has invalid user_metadata.filename (expected non-empty string, got ${typeof filename})`
    )
    return {
      success: false,
      error: {
        code: 'INVALID_ASSET',
        message: `Invalid filename (expected non-empty string, got ${typeof filename})`,
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
    validAsset,
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
    // Known gap (out of scope for FE-1076): flat `model_type:LLM`-style tags
    // whose loaders are only registered hierarchically land here until the
    // backend emits a subtype-carrying tag.
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
