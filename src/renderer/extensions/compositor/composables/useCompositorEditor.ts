import { useI18n } from 'vue-i18n'

import LayerEditorContent from '@/renderer/extensions/layerEditor/components/LayerEditorContent.vue'
import TopBarHeader from '@/renderer/extensions/layerEditor/components/dialog/TopBarHeader.vue'
import { hasCompositorLayers } from '@/renderer/extensions/compositor/composables/useCompositorLayers'
import {
  LAYER_EDITOR_DIALOG_KEY,
  layerEditorDialogProps
} from '@/renderer/extensions/layerEditor/composables/layerEditorDialog'
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
