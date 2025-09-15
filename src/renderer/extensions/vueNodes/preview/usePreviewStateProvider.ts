import { computed, provide } from 'vue'

import { NodePreviewImagesKey } from '@/renderer/core/canvas/injectionKeys'
import { app } from '@/scripts/app'

export const usePreviewStateProvider = () => {
  // Provide reactive access to app.nodePreviewImages
  // No need to duplicate data - app.nodePreviewImages is already reactive to changes
  const nodePreviewImages = computed(() => app.nodePreviewImages)

  provide(NodePreviewImagesKey, nodePreviewImages)

  return { nodePreviewImages }
}
