import { ref } from 'vue'
import type { Ref } from 'vue'

import {
  INITIAL_SETTLE,
  TOUR_FOCUS_DURATION_MS,
  canvasTransformKey,
  trackSettle
} from './canvasSpotlightAdapter'
import type { SettleState } from './canvasSpotlightAdapter'

/** Undimmed preview of the whole workflow before the tour dims to the first target. */
const INTRO_PREVIEW_MS = 500
/** The camera waits this out, so the mark's glide and the framing never run at once. */
export const MARK_GLIDE_MS = 400
/** A camera that never settles (the user keeps panning) must not strand the copy. */
const SETTLE_WATCHDOG_MS = TOUR_FOCUS_DURATION_MS + 200

interface ChoreographyOptions {
  reduceMotion: Ref<boolean>
  /** Frame the current step's target. Called once the mark has finished gliding. */
  frameTarget: () => void
  /** True when the step points at the toolbar, so the camera must not move. */
  isStatic: Ref<boolean>
}

/**
 * Sequences a step's motion so only one thing moves at a time: the mark glides, the
 * camera frames it, then the copy fades in once the transform holds still.
 *
 * The camera is watched rather than counted out: `animateToBounds` reports no
 * completion and cannot be cancelled, so an unchanged transform is the only honest
 * "it stopped" signal. A watchdog bounds that wait.
 */
export function useTourChoreography({
  reduceMotion,
  frameTarget,
  isStatic
}: ChoreographyOptions) {
  /** Scrim and rings are drawn; false during the intro preview. */
  const revealed = ref(false)
  const copyVisible = ref(false)
  /** True once this step's framing is final, so the mark's side can latch. */
  const cameraSettled = ref(false)
  /** Pinned while the canvas moves, so the mark rides it rather than chasing it. */
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

  /**
   * Cancels only the watchdog, never a pending framing: on a step whose transform is
   * already at rest the camera settles before it has moved, and the framing must still run.
   */
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

  /** Open a fresh tour on the undimmed workflow before dimming to the first target. */
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
    /** True while the camera is still being waited on, so a resize must not re-frame. */
    isAwaitingSettle: () => awaitingSettle,
    sampleFrame,
    beginStep,
    resetStep,
    openTour,
    endTour,
    clearTimers
  }
}
