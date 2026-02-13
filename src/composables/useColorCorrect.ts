import type { Ref } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { ColorCorrectSettings } from '@/lib/litegraph/src/types/widgets'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

export function useColorCorrect(
  nodeId: NodeId,
  modelValue: Ref<ColorCorrectSettings>
) {
  const nodeOutputStore = useNodeOutputStore()

  const node = ref<LGraphNode | null>(null)
  const imageUrl = ref<string | null>(null)
  const isLoading = ref(false)

  const getInputImageUrl = (): string | null => {
    if (!node.value) return null

    const inputNode = node.value.getInputNode(0)
    if (!inputNode) return null

    const urls = nodeOutputStore.getNodeImageUrls(inputNode)
    if (urls?.length) return urls[0]

    return null
  }

  const updateImageUrl = () => {
    imageUrl.value = getInputImageUrl()
  }

  const filterStyle = computed(() => {
    const v = modelValue.value
    const filters: string[] = []

    if (v.brightness !== 0) {
      filters.push(`brightness(${1 + v.brightness / 100})`)
    }
    if (v.contrast !== 0) {
      filters.push(`contrast(${1 + v.contrast / 100})`)
    }
    if (v.saturation !== 0) {
      filters.push(`saturate(${1 + v.saturation / 100})`)
    }
    if (v.hue !== 0) {
      filters.push(`hue-rotate(${v.hue}deg)`)
    }

    return filters.length > 0 ? filters.join(' ') : 'none'
  })

  const temperatureOverlayStyle = computed(() => {
    const temp = modelValue.value.temperature
    if (temp === 0) return null

    const opacity = (Math.abs(temp) / 100) * 0.15
    const color =
      temp > 0
        ? `rgba(255, 140, 0, ${opacity})`
        : `rgba(0, 100, 255, ${opacity})`

    return {
      backgroundColor: color
    }
  })

  const handleImageLoad = () => {
    isLoading.value = false
  }

  const handleImageError = () => {
    isLoading.value = false
    imageUrl.value = null
  }

  const initialize = () => {
    if (nodeId != null) {
      node.value = app.rootGraph?.getNodeById(nodeId) || null
    }
    updateImageUrl()
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

  onMounted(initialize)

  return {
    imageUrl,
    isLoading,
    filterStyle,
    temperatureOverlayStyle,
    handleImageLoad,
    handleImageError
  }
}
