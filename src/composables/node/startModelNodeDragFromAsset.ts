import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { resolveModelNodeFromAsset } from '@/platform/assets/utils/resolveModelNodeFromAsset'
import type { ResolveModelNodeError } from '@/platform/assets/utils/resolveModelNodeFromAsset'
import type { NodeAddSource } from '@/platform/telemetry/types'
import type { ModelNodeProvider } from '@/stores/modelToNodeStore'

/**
 * Arms a ghost drag for a model loader node. Providers with no widget key
 * (auto-load nodes) start the drag without widget values.
 */
export function startModelLoaderDrag(
  provider: ModelNodeProvider,
  filename: string,
  source: NodeAddSource = 'sidebar_drag'
) {
  const widgetValues = provider.key ? { [provider.key]: filename } : undefined
  useNodeDragToCanvas().startDrag(provider.nodeDef, { widgetValues, source })
}

/**
 * Starts a ghost drag for the model loader node described by an asset. The
 * node is created where the user next clicks the canvas, with the asset's
 * filename written into the loader widget.
 *
 * @returns the resolution error when the asset cannot be mapped to a node,
 *   otherwise `undefined`.
 */
export function startModelNodeDragFromAsset(
  asset: AssetItem,
  source: NodeAddSource = 'sidebar_drag'
): ResolveModelNodeError | undefined {
  const resolved = resolveModelNodeFromAsset(asset)
  if (!resolved.success) return resolved.error

  const { provider, filename } = resolved.value
  startModelLoaderDrag(provider, filename, source)
}
