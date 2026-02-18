import { useElementByPoint, useMouse } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export const useHoveredStore = defineStore('hovered', () => {
  const { x, y } = useMouse({ type: 'client' })
  const { element } = useElementByPoint({ x, y, multiple: true })

  const hoveredWidgetName = computed(() => {
    const widgetEl = element.value?.find((e) => e.matches('.lg-node-widget'))
    if (!(widgetEl instanceof HTMLElement)) return

    const nodeId = widgetEl.dataset.widgetNodeId
    if (nodeId) return [widgetEl.dataset.widgetName, nodeId]

    return widgetEl.dataset.widgetName
  })
  const hoveredNodeId = computed(() => {
    const nodeEl = element.value?.find((e) => e.matches('.lg-node'))
    if (!(nodeEl instanceof HTMLElement)) return

    return nodeEl.dataset.nodeId
  })
  return {
    hoveredNodeId,
    hoveredWidgetName
  }
})
