import {
  LAYER_EDITOR_DIALOG_KEY,
  LayerEditorDialogContent,
  LayerEditorDialogHeader,
  layerEditorDialogProps
} from '@/renderer/extensions/layerEditor/composables/layerEditorDialog'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
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
      useToastStore().add({
        severity: 'info',
        summary: t('layerEditor.title'),
        detail: t('layerEditor.needsTwoImages')
      })
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
