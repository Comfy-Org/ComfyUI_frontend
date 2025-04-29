import type { IWidget, LGraphNode } from '@comfyorg/litegraph'
import { computed, ref, watchEffect } from 'vue'

import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

interface RefreshableItem {
  refresh: () => Promise<void> | void
}

type RefreshableWidget = IWidget & RefreshableItem

const isRefreshableWidget = (widget: IWidget): widget is RefreshableWidget =>
  'refresh' in widget && typeof widget.refresh === 'function'

/**
 * Tracks selected nodes and their refreshable widgets
 */
export const useRefreshableSelection = () => {
  const graphStore = useCanvasStore()
  const selectedNodes = ref<LGraphNode[]>([])

  watchEffect(() => {
    selectedNodes.value = graphStore.selectedItems.filter(isLGraphNode)
  })

  const refreshableWidgets = computed(() =>
    selectedNodes.value.flatMap(
      (node) => node.widgets?.filter(isRefreshableWidget) ?? []
    )
  )

  const isRefreshable = computed(() => refreshableWidgets.value.length > 0)

  async function refreshSelected() {
    if (!isRefreshable.value) return

    await Promise.all(refreshableWidgets.value.map((item) => item.refresh()))
  }

  return {
    isRefreshable,
    refreshSelected
  }
}
