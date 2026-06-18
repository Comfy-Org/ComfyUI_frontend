import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useDialogStore } from '@/stores/dialogStore'
import TopBarHeader from '@/components/maskeditor/dialog/TopBarHeader.vue'
import MaskEditorContent from '@/components/maskeditor/MaskEditorContent.vue'

export function useMaskEditor() {
  const openMaskEditor = (node: LGraphNode) => {
    if (!node) {
      console.error('[MaskEditor] No node provided')
      return
    }

    if (!node.imgs?.length && node.previewMediaType !== 'image') {
      console.error('[MaskEditor] Node has no images')
      return
    }

    useDialogStore().showDialog({
      key: 'global-mask-editor',
      headerComponent: TopBarHeader,
      component: MaskEditorContent,
      props: {
        node
      },
      dialogComponentProps: {
        size: 'full',
        // `mask-editor-dialog` is a styling-free hook class consumed by
        // browser_tests (MaskEditorHelper, maskEditor.spec).
        contentClass: 'mask-editor-dialog w-[90vw] h-[90vh] max-h-[90vh]',
        headerClass: 'p-2',
        bodyClass: 'flex min-h-0 flex-col p-0',
        modal: true,
        maximizable: true,
        closable: true
      }
    })
  }

  return {
    openMaskEditor
  }
}
