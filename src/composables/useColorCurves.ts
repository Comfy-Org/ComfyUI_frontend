import { onMounted, ref, shallowRef, watch } from 'vue'

import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'

interface ImageHistogram {
  red: Uint32Array
  green: Uint32Array
  blue: Uint32Array
  luminance: Uint32Array
}

function computeHistogram(imageUrl: string): Promise<ImageHistogram> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const maxDim = 512
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No 2d context'))

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const red = new Uint32Array(256)
      const green = new Uint32Array(256)
      const blue = new Uint32Array(256)
      const luminance = new Uint32Array(256)

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        red[r]++
        green[g]++
        blue[b]++
        luminance[Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)]++
      }

      resolve({ red, green, blue, luminance })
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageUrl
  })
}

export function useColorCurves(nodeId: NodeId) {
  const nodeOutputStore = useNodeOutputStore()

  const node = ref<LGraphNode | null>(null)
  const imageUrl = ref<string | null>(null)
  const histogram = shallowRef<ImageHistogram | null>(null)

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

  watch(imageUrl, async (url) => {
    if (!url) {
      histogram.value = null
      return
    }
    try {
      histogram.value = await computeHistogram(url)
    } catch {
      histogram.value = null
    }
  })

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

  return { imageUrl, histogram }
}
