<template>
  <div ref="containerRef" class="relative size-full min-h-0 bg-graph-canvas">
    <canvas ref="canvasRef" class="absolute left-0 top-0" />
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center"
    >
      <i
        class="icon-[lucide--loader-2] size-8 animate-spin text-muted-foreground"
      />
    </div>
    <!-- Error state -->
    <div
      v-else-if="error"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"
    >
      <i class="icon-[lucide--alert-circle] size-8" />
      <span class="text-sm">{{ $t('discover.detail.previewError') }}</span>
      <span class="text-xs opacity-50">{{ error.message }}</span>
    </div>
    <!-- Empty state -->
    <div
      v-else-if="!workflowUrl"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <i class="icon-[lucide--workflow] size-16 opacity-30" />
      <span class="text-sm">{{ $t('discover.detail.workflowPreview') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch
} from 'vue'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

const { workflowUrl } = defineProps<{
  workflowUrl?: string
}>()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const graph = shallowRef<LGraph>()
const canvas = shallowRef<LGraphCanvas>()
const isLoading = ref(false)
const error = ref<Error | null>(null)
const isInitialized = ref(false)

function updateCanvasSize() {
  if (!canvasRef.value || !containerRef.value || !canvas.value) return

  const rect = containerRef.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const dpr = Math.max(window.devicePixelRatio, 1)
  canvas.value.resize(
    Math.round(rect.width * dpr),
    Math.round(rect.height * dpr)
  )
}

function initCanvas() {
  if (!canvasRef.value || !containerRef.value || isInitialized.value) return

  const rect = containerRef.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const dpr = Math.max(window.devicePixelRatio, 1)
  canvasRef.value.width = Math.round(rect.width * dpr)
  canvasRef.value.height = Math.round(rect.height * dpr)

  graph.value = new LGraph()
  canvas.value = new LGraphCanvas(canvasRef.value, graph.value, {
    skip_render: true
  })
  canvas.value.startRendering()
  isInitialized.value = true
}

function fitGraphToCanvas() {
  if (!graph.value || !canvas.value) return

  const nodes = graph.value.nodes
  if (nodes.length === 0) return

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    minX = Math.min(minX, node.pos[0])
    minY = Math.min(minY, node.pos[1])
    maxX = Math.max(maxX, node.pos[0] + node.size[0])
    maxY = Math.max(maxY, node.pos[1] + node.size[1])
  }

  const graphWidth = maxX - minX
  const graphHeight = maxY - minY
  const dpr = Math.max(window.devicePixelRatio, 1)
  const canvasWidth = canvas.value.canvas.width / dpr
  const canvasHeight = canvas.value.canvas.height / dpr
  const padding = 50

  if (graphWidth <= 0 || graphHeight <= 0) return
  if (canvasWidth <= 0 || canvasHeight <= 0) return

  const scaleX = (canvasWidth - padding * 2) / graphWidth
  const scaleY = (canvasHeight - padding * 2) / graphHeight
  const scale = Math.min(scaleX, scaleY, 1)

  canvas.value.ds.scale = scale
  canvas.value.ds.offset[0] = -minX + padding / scale
  canvas.value.ds.offset[1] = -minY + padding / scale
  canvas.value.setDirty(true, true)
}

async function loadWorkflow() {
  if (!workflowUrl) return

  // Wait for canvas to be initialized
  if (!isInitialized.value) {
    await nextTick()
    initCanvas()
  }

  if (!graph.value || !canvas.value) return

  isLoading.value = true
  error.value = null

  try {
    const response = await fetch(workflowUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    const data = await response.json()

    // Check if node types are registered
    const registeredTypes = Object.keys(LiteGraph.registered_node_types)
    if (registeredTypes.length === 0) {
      throw new Error('No node types registered yet')
    }

    graph.value.configure(data)
    await nextTick()
    updateCanvasSize()
    fitGraphToCanvas()
  } catch (e) {
    error.value = e instanceof Error ? e : new Error(String(e))
  } finally {
    isLoading.value = false
  }
}

useResizeObserver(containerRef, () => {
  updateCanvasSize()
  fitGraphToCanvas()
})

watch(
  () => workflowUrl,
  () => {
    loadWorkflow()
  }
)

onMounted(async () => {
  await nextTick()
  initCanvas()
  await loadWorkflow()
})

onBeforeUnmount(() => {
  canvas.value?.stopRendering()
})
</script>
