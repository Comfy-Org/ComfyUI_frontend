import type { NodeAddSource } from '@comfyorg/telemetry/types'

import { startModelLoaderDrag } from '@/composables/node/startModelLoaderDrag'
import type { AssetItem } from '@comfyorg/assets-core/schema'
import { resolveModelNodeFromAsset } from '@/platform/assets/integration/resolveModelNodeFromAsset'
import type { ResolveModelNodeError } from '@/platform/assets/integration/resolveModelNodeFromAsset'

export function startModelNodeDragFromAsset(
  asset: AssetItem,
  source: NodeAddSource = 'sidebar_drag'
): ResolveModelNodeError | undefined {
  const resolved = resolveModelNodeFromAsset(asset)
  if (!resolved.success) return resolved.error

  const { provider, filename } = resolved.value
  startModelLoaderDrag(provider, filename, source)
}
