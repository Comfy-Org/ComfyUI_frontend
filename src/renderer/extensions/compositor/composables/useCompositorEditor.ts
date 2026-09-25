import { useI18n } from 'vue-i18n'

import {
  getCompositorInputsFingerprint,
  hasCompositorLayers
} from '@/renderer/extensions/compositor/composables/useCompositorLayers'
import {
  LAYER_EDITOR_DIALOG_KEY,
  LayerEditorDialogContent,
  LayerEditorDialogHeader,
  layerEditorDialogProps
} from '@/renderer/extensions/layerEditor/composables/layerEditorDialog'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToast } from '@/components/ui/toast'
import { useDialogStore } from '@/stores/dialogStore'

export function useCompositorEditor() {
  const { t } = useI18n()

  const openCompositorEditor = (node: LGraphNode): void => {
    if (
      !hasCompositorLayers(node) ||
      !getCompositorInputsFingerprint(node)?.length
    ) {
      useToast().info(t('layerEditor.title'), {
        description: t('compositor.runWorkflowFirst')
      })
      return
    }

    useDialogStore().showDialog({
      key: LAYER_EDITOR_DIALOG_KEY,
      headerComponent: LayerEditorDialogHeader,
      component: LayerEditorDialogContent,
      props: {
        node,
        mode: 'compositor'
      },
      dialogComponentProps: layerEditorDialogProps
    })
  }

  return {
    openCompositorEditor
  }
}
