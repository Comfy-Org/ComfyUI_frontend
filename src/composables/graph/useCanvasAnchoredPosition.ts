import { useElementBounding, useRafFn } from '@vueuse/core'
import type { Ref } from 'vue'
import { ref, watchEffect } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

export function useCanvasAnchoredPosition(isOpen: Ref<boolean>) {
  const canvasStore = useCanvasStore()
  const lgCanvas = canvasStore.getCanvas()
  const { left: canvasLeft, top: canvasTop } = useElementBounding(
    lgCanvas.canvas
  )

  const screenPosition = ref({ x: 0, y: 0 })
  const worldPosition = ref({ x: 0, y: 0 })

  let lastScale = 0
  let lastOffsetX = 0
  let lastOffsetY = 0

  function anchorToEvent(event: MouseEvent) {
    const screenX = event.clientX - canvasLeft.value
    const screenY = event.clientY - canvasTop.value
    const { scale, offset } = lgCanvas.ds

    worldPosition.value = {
      x: screenX / scale - offset[0],
      y: screenY / scale - offset[1]
    }

    lastScale = scale
    lastOffsetX = offset[0]
    lastOffsetY = offset[1]

    screenPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  }

  function updateScreenPosition() {
    if (!isOpen.value) return

    const { scale, offset } = lgCanvas.ds
    if (
      scale === lastScale &&
      offset[0] === lastOffsetX &&
      offset[1] === lastOffsetY
    ) {
      return
    }

    lastScale = scale
    lastOffsetX = offset[0]
    lastOffsetY = offset[1]

    screenPosition.value = {
      x: (worldPosition.value.x + offset[0]) * scale + canvasLeft.value,
      y: (worldPosition.value.y + offset[1]) * scale + canvasTop.value
    }
  }

  const { resume: startSync, pause: stopSync } = useRafFn(
    updateScreenPosition,
    { immediate: false }
  )

  watchEffect(() => {
    if (isOpen.value) {
      startSync()
    } else {
      stopSync()
    }
  })

  return { screenPosition, anchorToEvent }
}
