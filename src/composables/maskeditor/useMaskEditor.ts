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
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'

const isClearingMask = ref(false)

export function useMaskEditor() {
  const toast = useToast()
  const { t } = useI18n()
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

    if (isClearingMask.value) {
      return
    }

    const dialogStore = useDialogStore()
    if (dialogStore.isDialogOpen('global-mask-editor')) {
      console.warn(
        '[MaskEditor] Cannot clear mask while the mask editor is open'
      )
      toast.add({
        severity: 'warn',
        summary: t('maskEditor.cannotClearWhenOpenSummary'),
        detail: t('maskEditor.cannotClearWhenOpenDetail'),
        life: 3000
      })
      return
    }

    isClearingMask.value = true

    const dataStore = useMaskEditorDataStore()
    const editorStore = useMaskEditorStore()
    const loader = useMaskEditorLoader()
    const saver = useMaskEditorSaver()
    const canvasTools = useCanvasTools()

    try {
      await loader.loadFromNode(node)

      if (!dataStore.inputData) throw new Error('Failed to load image data')

      if (!editorStore.maskCanvas) {
        // Headless mode: programmatically initialize canvases in the store
        // so that useMaskEditorSaver can proceed with the standard flow.
        const { image } = dataStore.inputData.baseLayer
        const width = image.naturalWidth || image.width || 1
        const height = image.naturalHeight || image.height || 1

        const imgCanvas = document.createElement('canvas')
        imgCanvas.width = width
        imgCanvas.height = height
        imgCanvas.getContext('2d')!.drawImage(image, 0, 0)

        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = width
        maskCanvas.height = height

        const rgbCanvas = document.createElement('canvas')
        rgbCanvas.width = width
        rgbCanvas.height = height

        // Set canvases in the store
        editorStore.imgCanvas = imgCanvas
        editorStore.maskCanvas = maskCanvas
        editorStore.rgbCanvas = rgbCanvas
      }

      canvasTools.clearMask()
      await saver.save()
    } finally {
      const dialogStore = useDialogStore()
      if (!dialogStore.isDialogOpen('global-mask-editor')) {
        editorStore.imgCanvas = null
        editorStore.maskCanvas = null
        editorStore.rgbCanvas = null
      }
      dataStore.reset()
      editorStore.resetState()
      isClearingMask.value = false
    }
  }

  return {
    isClearingMask,
    openMaskEditor,
    clearMask
  }
}
