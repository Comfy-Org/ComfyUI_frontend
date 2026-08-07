import { extractLayerState } from '@/renderer/extensions/compositor/composables/compositorLayerState'
import { setCompositorWidgetValue } from '@/renderer/extensions/compositor/composables/compositorWidgets'
import {
  getCompositorInputsFingerprint,
  setCompositorPreviewOverride
} from '@/renderer/extensions/compositor/composables/useCompositorLayers'
import type { SceneNode } from '@/renderer/extensions/layerEditor/engine/node'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

export interface CompositorLayerStateSession {
  canvasSize: { value: { w: number; h: number } }
  layers: { value: SceneNode[] }
  layerFlips(id: string): { h: boolean; v: boolean }
  inputLayerIds(): string[]
}

export interface CompositorPreviewSession {
  editor: {
    render(): void
  }
  compositor: {
    toBlob(): Promise<Blob>
  }
}

export function saveCompositorLayerState(
  session: CompositorLayerStateSession,
  node: LGraphNode
): boolean {
  try {
    const layerState = extractLayerState(
      session.canvasSize.value,
      session.layers.value,
      session.layerFlips,
      getCompositorInputsFingerprint(node.id),
      session.inputLayerIds()
    )
    if (!layerState.inputs) {
      console.warn(
        '[Compositor] no inputs fingerprint; layer state would be unrestorable'
      )
      return false
    }
    setCompositorWidgetValue(node, layerState)
    return true
  } catch (err) {
    console.error('[Compositor] Saving layer state failed:', err)
    return false
  }
}

export async function saveCompositorPreview(
  session: CompositorPreviewSession,
  node: LGraphNode
): Promise<void> {
  try {
    session.editor.render()
    const blob = await session.compositor.toBlob()
    setCompositorPreviewOverride(node.id, URL.createObjectURL(blob))
  } catch (err) {
    console.error('[Compositor] Preview render failed:', err)
  }
}
