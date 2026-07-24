import { ref } from 'vue'
import type { Ref } from 'vue'

import {
  INITIAL_SETTLE,
  TOUR_FOCUS_DURATION_MS,
  canvasTransformKey,
  trackSettle
} from './canvasSpotlightAdapter'
import type { SettleState } from './canvasSpotlightAdapter'

/** Undimmed preview before the tour dims to the first target. */
const INTRO_PREVIEW_MS = 500
/** Glide runs before framing so the two never overlap. */
export const MARK_GLIDE_MS = 400
/** Ceiling on the settle wait: tween duration plus a cushion for the last frames. */
const SETTLE_WATCHDOG_MS = TOUR_FOCUS_DURATION_MS + 200

interface ChoreographyOptions {
  reduceMotion: Ref<boolean>
  /** Called once the mark has finished gliding. */
  frameTarget: () => void
  /** True when the step points at the toolbar, so the camera must not move. */
  isStatic: Ref<boolean>
}

/**
 * Sequences a step's motion so only one thing moves at a time.
 *
 * Watches the transform for a stop rather than counting out `animateToBounds`'s
 * duration: the tween can't be cancelled or awaited, and the click-through scrim
 * lets the user pan mid-tween. A watchdog bounds the wait.
 */
export function useTourChoreography({
  reduceMotion,
  frameTarget,
  isStatic
}: ChoreographyOptions) {
  /** False during the intro preview, so the workflow shows undimmed first. */
  const revealed = ref(false)
  const copyVisible = ref(false)
  /** True once framing is final; gates the mark's arrival. */
  const cameraSettled = ref(false)
  /** True while the canvas moves, so the mark rides it instead of chasing. */
  const markGlides = ref(false)

  let timers: ReturnType<typeof setTimeout>[] = []
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  let settle: SettleState = INITIAL_SETTLE
  let awaitingSettle = false
  let lastTransformKey: string | null = null

  function after(ms: number, run: () => void) {
    timers.push(setTimeout(run, ms))
  }

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    if (watchdogTimer !== null) clearTimeout(watchdogTimer)
    watchdogTimer = null
  }

  /** Clears the watchdog only, never a pending framing, which must still run. */
  function showCopy() {
    awaitingSettle = false
    if (watchdogTimer !== null) clearTimeout(watchdogTimer)
    watchdogTimer = null
    cameraSettled.value = true
    copyVisible.value = true
  }

  function sampleFrame() {
    const key = canvasTransformKey()
    if (key !== lastTransformKey) {
      lastTransformKey = key
      markGlides.value = false
    }
    if (!awaitingSettle) return
    settle = trackSettle(settle, key)
    if (settle.settled) showCopy()
  }

  function beginStep({ glideFirst = true } = {}) {
    revealed.value = true

    if (isStatic.value || reduceMotion.value) {
      markGlides.value = !reduceMotion.value
      showCopy()
      return
    }

    markGlides.value = true
    awaitingSettle = true
    settle = INITIAL_SETTLE

    const delay = glideFirst ? MARK_GLIDE_MS : 0
    if (delay === 0) frameTarget()
    else after(delay, frameTarget)
    watchdogTimer = setTimeout(showCopy, delay + SETTLE_WATCHDOG_MS)
  }

  function resetStep() {
    clearTimers()
    awaitingSettle = false
    copyVisible.value = false
    cameraSettled.value = false
  }

  function openTour() {
    resetStep()
    revealed.value = false
    if (reduceMotion.value) return beginStep({ glideFirst: false })
    after(INTRO_PREVIEW_MS, () => beginStep({ glideFirst: false }))
  }

  function endTour() {
    resetStep()
    revealed.value = false
  }

  return {
    revealed,
    copyVisible,
    cameraSettled,
    markGlides,
    /** True while the camera is still being waited on; a resize must not re-frame. */
    isAwaitingSettle: () => awaitingSettle,
    sampleFrame,
    beginStep,
    resetStep,
    openTour,
    endTour,
    clearTimers
  }
}
