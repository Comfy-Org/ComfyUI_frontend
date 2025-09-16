import { computed, ref } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

/**
 * Composable for managing image preview state and interactions
 */
export const useImagePreview = (imageUrls: string[], nodeId?: string) => {
  const currentIndex = ref(0)
  const isHovered = ref(false)
  const actualDimensions = ref<string | null>(null)

  const commandStore = useCommandStore()
  const nodeOutputStore = useNodeOutputStore()

  const currentImageUrl = computed(() => imageUrls[currentIndex.value])
  const hasMultipleImages = computed(() => imageUrls.length > 1)

  const handleImageLoad = (event: Event) => {
    if (!event.target || !(event.target instanceof HTMLImageElement)) return
    const img = event.target
    if (img.naturalWidth && img.naturalHeight) {
      actualDimensions.value = `${img.naturalWidth} x ${img.naturalHeight}`
    }
  }

  const handleEditMask = () => {
    void commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')
  }

  const handleDownload = () => {
    downloadFile(currentImageUrl.value)
  }

  const handleRemove = () => {
    if (!nodeId) return
    nodeOutputStore.removeNodeOutputs(nodeId)
  }

  const setCurrentIndex = (index: number) => {
    if (index >= 0 && index < imageUrls.length) {
      currentIndex.value = index
      actualDimensions.value = null
    }
  }

  return {
    // State
    currentIndex,
    isHovered,
    actualDimensions,

    // Computed
    currentImageUrl,
    hasMultipleImages,

    // Event handlers
    handleImageLoad,
    handleEditMask,
    handleDownload,
    handleRemove,

    // Navigation
    setCurrentIndex
  }
}
