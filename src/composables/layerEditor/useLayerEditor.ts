import LayerEditorContent from '@/components/layerEditor/LayerEditorContent.vue'
import TopBarHeader from '@/components/layerEditor/dialog/TopBarHeader.vue'
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
      key: 'global-layer-editor',
      headerComponent: TopBarHeader,
      component: LayerEditorContent,
      props: {
        node
      },
      dialogComponentProps: {
        renderer: 'reka',
        size: 'full',
        contentClass: 'layer-editor-dialog w-[90vw] h-[90vh] max-h-[90vh]',
        headerClass: 'border-b border-border-default p-2',
        bodyClass: 'flex min-h-0 flex-col p-0',
        modal: true,
        maximizable: true,
        closable: true
      }
    })
  }

  return {
    openLayerEditor
  }
}
