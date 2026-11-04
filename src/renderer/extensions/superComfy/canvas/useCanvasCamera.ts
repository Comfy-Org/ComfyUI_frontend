import {
  calculateDragPan,
  calculateZoomAroundPoint,
  getWheelZoomFactor
} from '@comfyorg/mask-editor/panZoomUtils'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { computed, readonly, ref } from 'vue'

import type { Camera } from './canvasGeometry'

const REST_DELAY_MS = 300

export function useCanvasCamera(
  initial: Camera,
  onRest: (camera: Camera) => void
) {
  const camera = ref<Camera>({ ...initial })
  const notifyRest = useDebounceFn(
    () => onRest({ ...camera.value }),
    REST_DELAY_MS
  )

  const transformStyle = computed(() => ({
    transform: `translate(${camera.value.x}px, ${camera.value.y}px) scale(${camera.value.zoom})`,
    transformOrigin: '0 0'
  }))

  function moveTo(next: Camera) {
    camera.value = next
    void notifyRest()
  }

  function onWheel(
    event: Pick<WheelEvent, 'clientX' | 'clientY' | 'deltaY'>,
    rect: Pick<DOMRect, 'left' | 'top'>
  ) {
    const { x, y, zoom } = camera.value
    const { zoomRatio, panOffset } = calculateZoomAroundPoint(
      zoom,
      getWheelZoomFactor(event.deltaY),
      { x, y },
      event.clientX - rect.left - x,
      event.clientY - rect.top - y
    )
    moveTo({ x: panOffset.x, y: panOffset.y, zoom: zoomRatio })
  }

  function startPan(event: PointerEvent) {
    const origin = { x: event.clientX, y: event.clientY }
    const { x, y, zoom } = camera.value
    const stopMove = useEventListener(window, 'pointermove', (move) => {
      const pan = calculateDragPan(
        origin,
        { x: move.clientX, y: move.clientY },
        { x, y }
      )
      moveTo({ ...pan, zoom })
    })
    useEventListener(window, 'pointerup', stopMove, { once: true })
  }

  return {
    camera: readonly(camera),
    transformStyle,
    onWheel,
    startPan,
    fit: moveTo
  }
}
