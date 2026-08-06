import { useI18n } from 'vue-i18n'

import LayerEditorContent from '@/components/layerEditor/LayerEditorContent.vue'
import TopBarHeader from '@/components/layerEditor/dialog/TopBarHeader.vue'
import { hasCompositorLayers } from '@/composables/compositor/useCompositorLayers'
import {
  LAYER_EDITOR_DIALOG_KEY,
  layerEditorDialogProps
} from '@/composables/layerEditor/layerEditorDialog'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'

export function useCompositorEditor() {
  const { t } = useI18n()

  const openCompositorEditor = (node: LGraphNode): void => {
    if (!hasCompositorLayers(node.id)) {
      useToastStore().add({
        severity: 'info',
        summary: t('layerEditor.title'),
        detail: t('compositor.runWorkflowFirst')
      })
      return
    }

    useDialogStore().showDialog({
      key: LAYER_EDITOR_DIALOG_KEY,
      headerComponent: TopBarHeader,
      component: LayerEditorContent,
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
