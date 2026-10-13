import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useDialogStore } from '@/stores/dialogStore'
import TopBarHeader from '@/components/maskeditor/dialog/TopBarHeader.vue'
import MaskEditorContent from '@/components/maskeditor/MaskEditorContent.vue'
import { MASK_EDITOR_DIALOG_KEY } from '@/composables/maskeditor/maskEditorDialogKey'

export function useMaskEditor() {
  const openMaskEditor = (node: LGraphNode | null) => {
    if (!node) {
      console.error('[MaskEditor] No node provided')
      return
    }

    if (!node.imgs?.length && node.previewMediaType !== 'image') {
      console.error('[MaskEditor] Node has no images')
      return
    }

    useDialogStore().showDialog({
      key: MASK_EDITOR_DIALOG_KEY,
      headerComponent: TopBarHeader,
      component: MaskEditorContent,
      props: {
        node
      },
      dialogComponentProps: {
        flush: true,
        size: 'full',
        maximizable: true,
        closable: true,
        dismissOnEscape: false
      }
    })
  }

  return {
    openMaskEditor
  }
}
