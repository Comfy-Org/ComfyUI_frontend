import { computed, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

const GRID_SLICE_MIN = 1
const GRID_SLICE_MAX = 16
const IMAGE_INPUT_SLOT = 0

function clampGridCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return GRID_SLICE_MIN
  return Math.min(GRID_SLICE_MAX, Math.max(GRID_SLICE_MIN, Math.floor(numeric)))
}

function lineFractions(count: number): number[] {
  const fractions: number[] = []
  for (let i = 1; i < count; i++) {
    fractions.push(i / count)
  }
  return fractions
}

export function useImageGridSlice(nodeId: string) {
  const nodeOutputStore = useNodeOutputStore()

  const inputImageUrl = ref<string | null>(null)
  const isImageInputConnected = ref(false)

  const litegraphNode = computed(() => {
    if (!nodeId || !app.canvas.graph) return null
    return app.canvas.graph.getNodeById(nodeId) as LGraphNode | null
  })

  function getWidgetByName(name: string): IBaseWidget | undefined {
    return litegraphNode.value?.widgets?.find((w) => w.name === name)
  }

  const rows = computed(() => clampGridCount(getWidgetByName('rows')?.value))
  const columns = computed(() =>
    clampGridCount(getWidgetByName('columns')?.value)
  )

  const horizontalLines = computed(() => lineFractions(rows.value))
  const verticalLines = computed(() => lineFractions(columns.value))

  function updateInputImageUrl() {
    const node = litegraphNode.value
    if (!node) {
      inputImageUrl.value = null
      isImageInputConnected.value = false
      return
    }

    isImageInputConnected.value = node.isInputConnected(IMAGE_INPUT_SLOT)

    const inputNode = node.getInputNode(IMAGE_INPUT_SLOT)
    if (!inputNode) {
      inputImageUrl.value = null
      return
    }

    const urls = nodeOutputStore.getNodeImageUrls(inputNode)
    inputImageUrl.value = urls?.[0] ?? null
  }

  watch(() => nodeOutputStore.nodeOutputs, updateInputImageUrl, { deep: true })
  watch(() => nodeOutputStore.nodePreviewImages, updateInputImageUrl, {
    deep: true
  })

  updateInputImageUrl()

  return {
    rows,
    columns,
    horizontalLines,
    verticalLines,
    inputImageUrl,
    isImageInputConnected
  }
}
