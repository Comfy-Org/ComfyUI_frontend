import type { LGraphNode } from '@comfyorg/litegraph'
import type { IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { computed, ref, watchEffect } from 'vue'

import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

interface RefreshableItem {
  refresh: () => Promise<void> | void
}

type RefreshableWidget = IBaseWidget & RefreshableItem

const isRefreshableWidget = (
  widget: IBaseWidget
): widget is RefreshableWidget =>
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
