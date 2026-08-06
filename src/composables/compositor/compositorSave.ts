import { extractLayerState } from '@/composables/compositor/compositorLayerState'
import { setCompositorWidgetValue } from '@/composables/compositor/compositorWidgets'
import {
  getCompositorInputsFingerprint,
  setCompositorPreviewOverride
} from '@/composables/compositor/useCompositorLayers'
import type { SceneNode } from '@/core/layerEditor/engine/node'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

export interface CompositorSaveSession {
  editor: {
    render(): void
  }
  compositor: {
    toBlob(): Promise<Blob>
  }
  canvasSize: { value: { w: number; h: number } }
  layers: { value: SceneNode[] }
  layerFlips(id: string): { h: boolean; v: boolean }
}

export function saveCompositorLayerState(
  session: CompositorSaveSession,
  node: LGraphNode
): boolean {
  try {
    const layerState = extractLayerState(
      session.canvasSize.value,
      session.layers.value,
      session.layerFlips,
      getCompositorInputsFingerprint(node.id)
    )
    setCompositorWidgetValue(node, { ...layerState })
    node.graph?.setDirtyCanvas(true)
    return true
  } catch (err) {
    console.error('[Compositor] Saving layer state failed:', err)
    return false
  }
}

export async function saveCompositorPreview(
  session: CompositorSaveSession,
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
