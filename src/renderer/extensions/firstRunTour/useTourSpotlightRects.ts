import { useRafFn, useWindowSize } from '@vueuse/core'
import { computed, reactive, ref, toRef } from 'vue'
import type { Ref } from 'vue'

import {
  ACTIONBAR_SELECTOR,
  RUN_BUTTON_SELECTOR,
  canvasViewport,
  maskRectsFor,
  rectIntersectsViewport
} from './canvasSpotlightAdapter'
import type { ScreenRect } from './canvasSpotlightAdapter'
import type { NodeId } from '@/types/nodeId'

function domClientRect(selector: string): ScreenRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const { left, top, width, height } = el.getBoundingClientRect()
  return { left, top, width, height }
}

/**
 * Assigning primitives rather than replacing the object keeps Vue's equality check in
 * play: a stationary canvas writes identical numbers and nothing recomputes. Replacing
 * it every frame re-rendered the overlay at 60fps at rest.
 */
function assignRect(target: ScreenRect, rect: ScreenRect): void {
  target.left = rect.left
  target.top = rect.top
  target.width = rect.width
  target.height = rect.height
}

/**
 * Whether two rect lists hold the same geometry, so an unchanged frame can bail.
 * Hand-rolled rather than a deep-equal: this runs twice per frame on a flat shape
 * of four numbers, where a generic recursive compare would dominate the cost.
 */
function sameRects(
  a: readonly ScreenRect[],
  b: readonly ScreenRect[]
): boolean {
  return (
    a.length === b.length &&
    a.every((rect, i) => {
      const other = b[i]
      return (
        rect.left === other.left &&
        rect.top === other.top &&
        rect.width === other.width &&
        rect.height === other.height
      )
    })
  )
}

interface SpotlightRectsOptions {
  isRunStep: Ref<boolean>
  isResultStep: Ref<boolean>
  revealedNodeIds: Ref<Set<NodeId>>
  spotlitNodeIds: Ref<Set<NodeId>>
  /** Per-frame hook for the choreography, which samples the same transform. */
  onFrame?: () => void
}

/**
 * Per-frame source of the rects the overlay draws: the scrim's holes, the current
 * step's rings, and the region the mark may occupy.
 *
 * Rects are only published when the geometry actually changes, so a still canvas costs
 * one layout read per frame and no re-render.
 */
export function useTourSpotlightRects({
  isRunStep,
  isResultStep,
  revealedNodeIds,
  spotlitNodeIds,
  onFrame
}: SpotlightRectsOptions) {
  const holeRects = ref<ScreenRect[]>([])
  const spotRects = ref<ScreenRect[]>([])

  /**
   * The canvas rect, not the window: the app insets the canvas below the top bar and
   * beside the panels, so placing against the window put the mark under that chrome.
   * Falls back to the window until the canvas exists.
   */
  const { width: windowWidth, height: windowHeight } = useWindowSize()
  const canvasRect = reactive<ScreenRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0
  })
  const hasCanvasRect = ref(false)
  const viewport = computed<ScreenRect>(() =>
    hasCanvasRect.value
      ? canvasRect
      : {
          left: 0,
          top: 0,
          width: windowWidth.value,
          height: windowHeight.value
        }
  )

  function readRects() {
    const canvas = canvasViewport()
    hasCanvasRect.value = canvas !== null
    if (canvas) assignRect(canvasRect, canvas)

    if (isRunStep.value) {
      const rect = domClientRect(RUN_BUTTON_SELECTOR)
      return { holes: rect ? [rect] : [], spots: rect ? [rect] : [] }
    }

    const holes = maskRectsFor([...revealedNodeIds.value])
    const spots = maskRectsFor([...spotlitNodeIds.value])
    // Result cuts the toolbar out of the scrim unringed, so the eye stays on the node.
    const toolbar = isResultStep.value
      ? domClientRect(ACTIONBAR_SELECTOR)
      : null
    if (toolbar) holes.push(toolbar)
    return { holes, spots }
  }

  function recompute() {
    const { holes, spots } = readRects()
    if (!sameRects(holes, holeRects.value)) holeRects.value = holes
    if (!sameRects(spots, spotRects.value)) spotRects.value = spots
  }

  const { pause, resume } = useRafFn(
    () => {
      recompute()
      onFrame?.()
    },
    { immediate: false }
  )

  function start() {
    recompute()
    resume()
  }

  function stop() {
    pause()
    holeRects.value = []
    spotRects.value = []
  }

  return {
    holeRects: toRef(() => holeRects.value),
    /** Nodes off the canvas region are not ringed; the mark holds instead of chasing. */
    visibleSpotRects: computed(() =>
      spotRects.value.filter((rect) =>
        rectIntersectsViewport(rect, viewport.value)
      )
    ),
    focusRect: computed(() => spotRects.value[0] ?? null),
    start,
    stop
  }
}
