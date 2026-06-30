import { useRafFn } from '@vueuse/core'
import { toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

/**
 * Invokes `onGesture` when a canvas gesture begins while `active` is true.
 *
 * Watches the canvas at the semantic layer instead of raw pointer events, so
 * every input device is covered: panning and zooming are observed through the
 * shared camera transform (mouse drag, trackpad, wheel — anything that moves
 * the viewport), and box selection through the canvas selection rectangle.
 * Intended for dismissing popups that anchor to a node but are teleported to
 * `document.body`, which would otherwise be left stranded as the node moves.
 */
export function useDismissOnCanvasGesture(
  active: MaybeRefOrGetter<boolean>,
  onGesture: () => void
) {
  const { camera } = useTransformState()
  const canvasStore = useCanvasStore()

  watch(
    () => [camera.x, camera.y, camera.z],
    () => {
      if (toValue(active)) onGesture()
    }
  )

  /**
   * `dragging_rectangle` lives on the raw LGraphCanvas instance and is not
   * reactive, so it is polled per frame — same approach as
   * SelectionRectangle.vue. Runs only while `active`.
   */
  const { pause, resume } = useRafFn(
    () => {
      if (canvasStore.canvas?.dragging_rectangle) onGesture()
    },
    { immediate: false }
  )

  watch(
    () => toValue(active),
    (isActive) => (isActive ? resume() : pause()),
    {
      immediate: true
    }
  )
}
