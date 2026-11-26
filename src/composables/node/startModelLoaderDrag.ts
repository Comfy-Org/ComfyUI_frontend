import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import type { NodeAddSource } from '@comfyorg/telemetry/types'
import type { ModelNodeProvider } from '@/stores/modelToNodeStore'

export function startModelLoaderDrag(
  provider: ModelNodeProvider,
  filename: string,
  source: NodeAddSource = 'sidebar_drag'
) {
  const widgetValues = provider.key
    ? [{ selector: provider.key, value: filename }]
    : undefined
  useNodeDragToCanvas().startDrag(provider.nodeDef, { widgetValues, source })
}
