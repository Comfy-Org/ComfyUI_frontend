import { storeToRefs } from 'pinia'
import { type Ref, computed } from 'vue'

import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useWorkflowStore } from '@/stores/workflowStore'

export const useNodePreviewState = (
  nodeId: string,
  options?: {
    isMinimalLOD?: Ref<boolean>
    isCollapsed?: Ref<boolean>
  }
) => {
  const workflowStore = useWorkflowStore()
  const { nodePreviewImages } = storeToRefs(useNodeOutputStore())

  const locatorId = computed(() => workflowStore.nodeIdToNodeLocatorId(nodeId))

  const previewUrls = computed(() => {
    const key = locatorId.value
    if (!key) return undefined
    const urls = nodePreviewImages.value[key]
    return urls?.length ? urls : undefined
  })

  const hasPreview = computed(() => !!previewUrls.value?.length)

  const latestPreviewUrl = computed(() => {
    const urls = previewUrls.value
    return urls?.length ? urls.at(-1) : ''
  })

  const shouldShowPreviewImg = computed(() => {
    if (!options?.isMinimalLOD || !options?.isCollapsed) {
      return hasPreview.value
    }
    return (
      !options.isMinimalLOD.value &&
      !options.isCollapsed.value &&
      hasPreview.value
    )
  })

  return {
    locatorId,
    previewUrls,
    hasPreview,
    latestPreviewUrl,
    shouldShowPreviewImg
  }
}
