import { useI18n } from 'vue-i18n'

import LayerEditorContent from '@/components/layerEditor/LayerEditorContent.vue'
import TopBarHeader from '@/components/layerEditor/dialog/TopBarHeader.vue'
import { hasCompositorLayers } from '@/composables/compositor/useCompositorLayers'
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
      key: 'global-layer-editor',
      headerComponent: TopBarHeader,
      component: LayerEditorContent,
      props: {
        node,
        mode: 'compositor'
      },
      dialogComponentProps: {
        renderer: 'reka',
        size: 'full',
        contentClass: 'layer-editor-dialog w-[90vw] h-[90vh] max-h-[90vh]',
        headerClass: 'border-b border-border-default p-2',
        bodyClass: 'flex min-h-0 flex-col p-0',
        modal: true,
        maximizable: false,
        closable: false
      }
    })
  }

  return {
    openCompositorEditor
  }
}
