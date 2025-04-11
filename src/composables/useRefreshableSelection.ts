import type { LGraphNode } from '@comfyorg/litegraph'
import type { IWidget } from '@comfyorg/litegraph'
import { computed, ref, watchEffect } from 'vue'

import { useCommandStore } from '@/stores/commandStore'
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
  const commandStore = useCommandStore()
  const selectedNodes = ref<LGraphNode[]>([])
  const isAllNodesSelected = ref(false)

  watchEffect(() => {
    selectedNodes.value = graphStore.selectedItems.filter(isLGraphNode)
    isAllNodesSelected.value =
      graphStore.canvas?.graph?.nodes?.every((node) => !!node.selected) ?? false
  })

  const refreshableWidgets = computed(() =>
    selectedNodes.value.flatMap(
      (node) => node.widgets?.filter(isRefreshableWidget) ?? []
    )
  )

  const isRefreshable = computed(
    () => refreshableWidgets.value.length > 0 || isAllNodesSelected.value
  )

  async function refreshSelected() {
    if (!isRefreshable.value) return

    if (isAllNodesSelected.value) {
      await commandStore.execute('Comfy.RefreshNodeDefinitions')
    } else {
      await Promise.all(refreshableWidgets.value.map((item) => item.refresh()))
    }
  }

  return {
    isRefreshable,
    refreshSelected
  }
}
