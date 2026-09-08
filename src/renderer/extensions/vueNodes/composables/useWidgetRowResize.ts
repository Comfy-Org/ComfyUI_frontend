import { ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { app } from '@/scripts/app'
import type { NodeState } from '@/types/nodeState'
import {
  getNodeByLocatorId,
  locatorIdFromState
} from '@/utils/graphTraversalUtil'
import { setGridOverride } from '@/utils/widgetGridOverrides'

const MIN_ROW_HEIGHT = 24

function getHostNode(nodeData: NodeState): LGraphNode | null {
  if (!app.isGraphReady) return null
  const locatorId = locatorIdFromState(nodeData, app.rootGraph.id)
  return locatorId ? getNodeByLocatorId(app.rootGraph, locatorId) : null
}

export function useWidgetRowResize() {
  const transformState = useTransformState()
  const isResizing = ref(false)

  function startResize(
    event: PointerEvent,
    nodeData: NodeState,
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

      const node = getHostNode(nodeData)
      if (!node) return

      setGridOverride(node, widgetName, `${Math.round(finalHeight)}px`)
      app.canvas?.setDirty(true, true)
    }

    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
    target.addEventListener('pointercancel', handlePointerUp)
  }

  return { isResizing, startResize }
}
