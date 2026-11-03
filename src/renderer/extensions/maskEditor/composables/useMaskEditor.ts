import { defineAsyncComponent, toRaw } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useDialogStore } from '@/stores/dialogStore'

const TopBarHeader = defineAsyncComponent(
  () =>
    import('@/renderer/extensions/maskEditor/components/dialog/TopBarHeader.vue')
)
const MaskEditorContent = defineAsyncComponent(
  () =>
    import('@/renderer/extensions/maskEditor/components/MaskEditorContent.vue')
)

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

    const dialogStore = useDialogStore()
    const controller = new AbortController()
    const sessionKey = Symbol()
    const dialog = dialogStore.showDialog({
      key: 'global-mask-editor',
      headerComponent: TopBarHeader,
      component: MaskEditorContent,
      headerProps: { key: sessionKey, signal: controller.signal, closeSession },
      props: {
        key: sessionKey,
        node
      },
      dialogComponentProps: {
        flush: true,
        size: 'full',
        maximizable: true,
        closable: true,
        onRemoved: () => controller.abort()
      }
    })

    function closeSession() {
      const current = dialogStore.dialogStack.find(
        (item) => item.key === 'global-mask-editor'
      )
      if (current && toRaw(current) === toRaw(dialog)) {
        dialogStore.closeDialog({ key: 'global-mask-editor' })
      }
    }
  }

  return {
    openMaskEditor
  }
}
