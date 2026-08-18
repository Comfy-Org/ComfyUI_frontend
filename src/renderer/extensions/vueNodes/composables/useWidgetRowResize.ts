import { ref } from 'vue'

import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { app } from '@/scripts/app'
import { setGridOverride } from '@/utils/widgetGridOverrides'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { NodeId } from '@/types/nodeId'

const MIN_ROW_HEIGHT = 24

export function useWidgetRowResize() {
  const transformState = useTransformState()
  const isResizing = ref(false)

  function startResize(
    event: PointerEvent,
    nodeId: NodeId,
    widgetName: string,
    rowElement: HTMLElement
  ) {
    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

    target.setPointerCapture(event.pointerId)

    const safeZoom = () => transformState.camera.z || 1
    const startY = event.clientY
    const startHeight = rowElement.getBoundingClientRect().height / safeZoom()

    isResizing.value = true

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = (moveEvent.clientY - startY) / safeZoom()
      rowElement.style.height = `${Math.max(MIN_ROW_HEIGHT, startHeight + deltaY)}px`
    }

    const handlePointerUp = () => {
      target.removeEventListener('pointermove', handlePointerMove)
      target.removeEventListener('pointerup', handlePointerUp)
      target.removeEventListener('pointercancel', handlePointerUp)

      const finalHeight = rowElement.getBoundingClientRect().height / safeZoom()
      rowElement.style.height = ''
      isResizing.value = false

      const node = app.graph?.getNodeById(nodeId)
      if (!node) return

      setGridOverride(node, widgetName, `${Math.round(finalHeight)}px`)
      useVueNodeLifecycle().nodeManager.value?.refreshNode(nodeId)
      app.canvas?.setDirty(true, true)
    }

    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
    target.addEventListener('pointercancel', handlePointerUp)
  }

  return { isResizing, startResize }
}
