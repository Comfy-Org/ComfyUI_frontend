import { useElementBounding, useRafFn } from '@vueuse/core'
import type ContextMenu from 'primevue/contextmenu'
import type { Ref } from 'vue'
import { ref, watchEffect } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Keeps a PrimeVue ContextMenu anchored to a world-space position while the
 * canvas is panned/zoomed. Performs dirty-checking each RAF tick so the DOM
 * is only touched when the transform actually changes.
 */
export function useCanvasMenuPositionSync(
  contextMenu: Ref<InstanceType<typeof ContextMenu> | undefined>,
  isOpen: Ref<boolean>
) {
  const canvasStore = useCanvasStore()
  const lgCanvas = canvasStore.getCanvas()
  const { left: canvasLeft, top: canvasTop } = useElementBounding(
    lgCanvas.canvas
  )

  const worldPosition = ref({ x: 0, y: 0 })

  let lastScale = 0
  let lastOffsetX = 0
  let lastOffsetY = 0

  function updateMenuPosition() {
    if (!isOpen.value) return

    const menuInstance = contextMenu.value as unknown as {
      container?: HTMLElement
    }
    const menuEl = menuInstance?.container
    if (!menuEl) return

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

    const screenX =
      (worldPosition.value.x + offset[0]) * scale + canvasLeft.value
    const screenY =
      (worldPosition.value.y + offset[1]) * scale + canvasTop.value

    menuEl.style.left = `${screenX}px`
    menuEl.style.top = `${screenY}px`
  }

  const { resume: startSync, pause: stopSync } = useRafFn(
    updateMenuPosition,
    { immediate: false }
  )

  watchEffect(() => {
    if (isOpen.value) {
      startSync()
    } else {
      stopSync()
    }
  })

  /** Convert a mouse event's screen position to world coordinates and store it. */
  function setWorldPositionFromEvent(event: MouseEvent) {
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
  }

  return { setWorldPositionFromEvent }
}
