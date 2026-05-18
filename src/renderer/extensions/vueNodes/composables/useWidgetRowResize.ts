import { ref } from 'vue'

import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { app } from '@/scripts/app'
import { setGridOverride } from '@/utils/widgetGridOverrides'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

const MIN_ROW_HEIGHT = 24

export function useWidgetRowResize() {
  const transformState = useTransformState()
  const isResizing = ref(false)
  const resizeStartY = ref(0)
  const resizeStartHeight = ref(0)
  const activeNodeId = ref<string | null>(null)
  const activeWidgetName = ref<string | null>(null)

  function startResize(
    event: PointerEvent,
    nodeId: string,
    widgetName: string,
    rowElement: HTMLElement
  ) {
    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

    target.setPointerCapture(event.pointerId)

    isResizing.value = true
    resizeStartY.value = event.clientY
    resizeStartHeight.value =
      rowElement.getBoundingClientRect().height / transformState.camera.z
    activeNodeId.value = nodeId
    activeWidgetName.value = widgetName

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isResizing.value) return

      const scale = transformState.camera.z || 1
      const deltaY = (moveEvent.clientY - resizeStartY.value) / scale
      const newHeight = Math.max(
        MIN_ROW_HEIGHT,
        resizeStartHeight.value + deltaY
      )

      rowElement.style.height = `${newHeight}px`
    }

    const handlePointerUp = () => {
      if (!isResizing.value || !activeNodeId.value || !activeWidgetName.value)
        return

      const finalHeight =
        rowElement.getBoundingClientRect().height / transformState.camera.z
      const heightPx = `${Math.round(finalHeight)}px`

      const node = app.graph?.getNodeById(Number(activeNodeId.value))
      if (node) {
        setGridOverride(node, activeWidgetName.value, heightPx)
        const manager = useVueNodeLifecycle().nodeManager.value
        manager?.refreshNode(activeNodeId.value)
        app.canvas?.setDirty(true, true)
      }

      rowElement.style.height = ''
      isResizing.value = false
      activeNodeId.value = null
      activeWidgetName.value = null

      target.removeEventListener('pointermove', handlePointerMove)
      target.removeEventListener('pointerup', handlePointerUp)
      target.removeEventListener('pointercancel', handlePointerUp)
    }

    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
    target.addEventListener('pointercancel', handlePointerUp)
  }

  return {
    isResizing,
    startResize
  }
}
