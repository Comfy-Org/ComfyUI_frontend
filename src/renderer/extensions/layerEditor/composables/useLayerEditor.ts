import {
  LAYER_EDITOR_DIALOG_KEY,
  LayerEditorDialogContent,
  LayerEditorDialogHeader,
  layerEditorDialogProps
} from '@/renderer/extensions/layerEditor/composables/layerEditorDialog'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useDialogStore } from '@/stores/dialogStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

export function useLayerEditor() {
  const openLayerEditor = (node: LGraphNode) => {
    if (!node) {
      console.error('[LayerEditor] No node provided')
      return
    }

    const imageUrls = useNodeOutputStore().getNodeImageUrls(node)
    if (!imageUrls || imageUrls.length < 2) {
      console.error('[LayerEditor] Node needs at least 2 output images')
      return
    }

    useDialogStore().showDialog({
      key: LAYER_EDITOR_DIALOG_KEY,
      headerComponent: LayerEditorDialogHeader,
      component: LayerEditorDialogContent,
      props: {
        node
      },
      dialogComponentProps: layerEditorDialogProps
    })
  }

  return {
    openLayerEditor
  }
}
