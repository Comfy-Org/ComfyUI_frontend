import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useDialogStore } from '@/stores/dialogStore'
import TopBarHeader from '@/components/maskeditor/dialog/TopBarHeader.vue'
import MaskEditorContent from '@/components/maskeditor/MaskEditorContent.vue'
import { useMaskEditorDataStore } from '@/stores/maskEditorDataStore'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useMaskEditorLoader } from '@/composables/maskeditor/useMaskEditorLoader'
import { useMaskEditorSaver } from '@/composables/maskeditor/useMaskEditorSaver'
import { useCanvasTools } from '@/composables/maskeditor/useCanvasTools'
import { useToast } from 'primevue/usetoast'

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
        style: 'width: 90vw; height: 90vh;',
        modal: true,
        maximizable: true,
        closable: true,
        pt: {
          root: {
            class: 'mask-editor-dialog flex flex-col'
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

  const clearMask = async (node: LGraphNode) => {
    if (!node) {
      return
    }

    const dialogStore = useDialogStore()
    if (dialogStore.isDialogOpen('global-mask-editor')) {
      console.warn(
        '[MaskEditor] Cannot clear mask while the mask editor is open'
      )
      useToast().add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Please close the mask editor before clearing masks.',
        life: 3000
      })
      return
    }

    const dataStore = useMaskEditorDataStore()
    const editorStore = useMaskEditorStore()
    const loader = useMaskEditorLoader()
    const saver = useMaskEditorSaver()
    const canvasTools = useCanvasTools()

    try {
      await loader.loadFromNode(node)

      if (!dataStore.inputData) throw new Error('Failed to load image data')

      canvasTools.clearMask()
      await saver.save()
    } catch (error) {
      throw error
    } finally {
      dataStore.reset()
      editorStore.resetState()
    }
  }

  return {
    openMaskEditor,
    clearMask
  }
}
