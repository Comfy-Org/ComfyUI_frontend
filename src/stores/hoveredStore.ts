import { useElementByPoint, useMouse } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export const useHoveredStore = defineStore('hovered', () => {
  const { x, y } = useMouse({ type: 'client' })
  const { element } = useElementByPoint({ x, y })

  const hoveredWidgetName = computed(() => {
    const widgetEl = element.value?.closest('.lg-node-widget')
    if (!(widgetEl instanceof HTMLElement)) return

    return widgetEl.dataset.widgetName
  })
  const hoveredNodeId = computed(() => {
    const nodeEl = element.value?.closest('.lg-node')
    if (!(nodeEl instanceof HTMLElement)) return

    return nodeEl.dataset.nodeId
  })
  return {
    hoveredNodeId,
    hoveredWidgetName
  }
})
