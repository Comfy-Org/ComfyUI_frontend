import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

const PROGRESSIVE_THRESHOLD = 40
const INITIAL_BATCH_SIZE = 24
const BATCH_SIZE = 40
const FRAME_BUDGET_MS = 6

/**
 * Progressively renders nodes in batches across animation frames
 * to avoid blocking the main thread during subgraph transitions.
 *
 * For small graphs (≤ threshold), all nodes render immediately.
 * For larger graphs, an initial batch renders first, then remaining
 * nodes are added in RAF-driven batches with a per-frame time budget.
 */
export function useProgressiveNodeRendering(allNodes: Ref<VueNodeData[]>) {
  const renderedCount = ref(0)
  let renderToken = 0
  let rafId: number | null = null

  const visibleNodes = computed(() =>
    allNodes.value.slice(0, renderedCount.value)
  )

  function cancel() {
    renderToken++
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function reset() {
    cancel()
    renderedCount.value = 0
  }

  function start() {
    cancel()

    const total = allNodes.value.length
    if (total === 0) {
      renderedCount.value = 0
      return
    }

    if (total <= PROGRESSIVE_THRESHOLD) {
      renderedCount.value = total
      return
    }

    layoutStore.setPendingSlotSync(true)
    const token = ++renderToken
    renderedCount.value = Math.min(INITIAL_BATCH_SIZE, total)

    const pump = () => {
      if (token !== renderToken) return

      const currentTotal = allNodes.value.length
      const start = performance.now()
      let next = renderedCount.value

      while (next < currentTotal && performance.now() - start < FRAME_BUDGET_MS)
        next += BATCH_SIZE

      renderedCount.value = Math.min(next, currentTotal)

      if (renderedCount.value < currentTotal) {
        rafId = requestAnimationFrame(pump)
      } else {
        rafId = null
      }
    }

    rafId = requestAnimationFrame(pump)
  }

  watch(allNodes, (nodes) => {
    if (rafId == null) {
      renderedCount.value = nodes.length
    }
  })

  onUnmounted(cancel)

  return { visibleNodes, start, reset, cancel }
}
