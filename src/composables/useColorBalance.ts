import { onMounted, ref, watch } from 'vue'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

export function useColorBalance(nodeId: NodeId) {
  const nodeOutputStore = useNodeOutputStore()

  const node = ref<LGraphNode | null>(null)
  const imageUrl = ref<string | null>(null)

  function getInputImageUrl(): string | null {
    if (!node.value) return null

    const inputNode = node.value.getInputNode(0)
    if (!inputNode) return null

    const urls = nodeOutputStore.getNodeImageUrls(inputNode)
    if (urls?.length) return urls[0]

    return null
  }

  function updateImageUrl() {
    imageUrl.value = getInputImageUrl()
  }

  watch(
    () => nodeOutputStore.nodeOutputs,
    () => updateImageUrl(),
    { deep: true }
  )

  watch(
    () => nodeOutputStore.nodePreviewImages,
    () => updateImageUrl(),
    { deep: true }
  )

  onMounted(() => {
    if (nodeId != null) {
      node.value = app.rootGraph?.getNodeById(nodeId) || null
    }
    updateImageUrl()
  })

  return { imageUrl }
}
