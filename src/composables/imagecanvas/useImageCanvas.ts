import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useDialogStore } from '@/stores/dialogStore'
import TopBarHeader from '@/components/imagecanvas/dialog/TopBarHeader.vue'
import ImageCanvasContent from '@/components/imagecanvas/ImageCanvasContent.vue'

export function useImageCanvas() {
  const openImageCanvas = (node: LGraphNode) => {
    if (!node) {
      console.error('[ImageCanvas] No node provided')
      return
    }

    if (!node.imgs?.length && node.previewMediaType !== 'image') {
      console.error('[ImageCanvas] Node has no images')
      return
    }

    useDialogStore().showDialog({
      key: 'global-image-canvas',
      headerComponent: TopBarHeader,
      component: ImageCanvasContent,
      props: {
        node
      },
      dialogComponentProps: {
        style: 'width: 90vw; height: 90vh;',
        modal: true,
        maximizable: true,
        closable: true,
        pt: {
          root: {
            class: 'image-canvas-dialog flex flex-col'
          },
          content: {
            class: 'flex flex-col min-h-0 flex-1 !p-0'
          },
          header: {
            class: '!p-2'
          }
        }
      }
    })
  }

  return {
    openImageCanvas
  }
}
