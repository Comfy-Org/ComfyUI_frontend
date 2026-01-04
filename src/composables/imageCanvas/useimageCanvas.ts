import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useDialogStore } from '@/stores/dialogStore'
import TopBarHeader from '@/components/imageCanvas/dialog/TopBarHeader.vue'
import imageCanvasContent from '@/components/imageCanvas/imageCanvasContent.vue'

export function useimageCanvas() {
  const openimageCanvas = (node: LGraphNode) => {
    if (!node) {
      console.error('[imageCanvas] No node provided')
      return
    }

    if (!node.imgs?.length && node.previewMediaType !== 'image') {
      console.error('[imageCanvas] Node has no images')
      return
    }

    useDialogStore().showDialog({
      key: 'global-image-canvas',
      headerComponent: TopBarHeader,
      component: imageCanvasContent,
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
    openimageCanvas
  }
}
