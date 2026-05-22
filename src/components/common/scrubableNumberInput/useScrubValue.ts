import type { MaybeRef } from 'vue'
import { computed, reactive, readonly, unref, watch } from 'vue'

import type { GestureState } from './interpretGesture'
import { interpretGesture } from './interpretGesture'

interface ScrubOptions {
  /** Initial value. Pulled once during setup; later sync via setValue(). */
  initial: number
  /** Value-units per pixel at speedMult = 1. Reactive. */
  baseSpeed: MaybeRef<number>
  /** Min sensitivity multiplier. */
  minSpeed?: MaybeRef<number>
  /** Max sensitivity multiplier. */
  maxSpeed?: MaybeRef<number>
  /** External multiplier (e.g. modifier keys). */
  modifierSpeed?: MaybeRef<number>
  /** Optional post-mutation validator (clamp/quantize/snap composition). */
  validate?: (value: number) => number
  /** Notified whenever value changes from inside (apply / setValue). */
  onChange?: (value: number) => void
}

export interface ScrubState {
  readonly value: number
  readonly speedMult: number
  /** Horizontality weight from the latest apply(). Useful for visuals. */
  readonly weight: number
}

interface ScrubInstance {
  state: Readonly<ScrubState>
  /** Feed one pointer-tick into the scrub algorithm. */
  apply(dx: number, dy: number): void
  /** Reset gesture-internal state (speedMult, direction, weight). Does NOT touch value. */
  reset(): void
  /** Replace the current value (e.g. external model update, jump-to-click). */
  setValue(value: number): void
}

/**
 * Owns all mutable scrub state for a single input. Hides direction EMA,
 * accumulator, and validator chain from callers — apply/reset/setValue are
 * the only mutators.
 *
 * The raw accumulator (`internal.raw`) is intentionally NOT quantized. Tiny
 * per-frame deltas under one step would otherwise be rounded to zero and
 * the value would never move. By accumulating raw and quantizing only on
 * the way out, sub-step motion accrues until it crosses a step boundary.
 */
export function useScrubValue(opts: ScrubOptions): ScrubInstance {
  const internal = reactive({
    raw: opts.initial,
    speedMult: 1,
    weight: 1,
    dirAvg: [1, 0] as [number, number]
  })

  const validated = computed(() =>
    opts.validate ? opts.validate(internal.raw) : internal.raw
  )

  let lastEmitted = validated.value
  watch(validated, (v) => {
    if (v === lastEmitted) return
    lastEmitted = v
    opts.onChange?.(v)
  })

  function apply(dx: number, dy: number) {
    const gestureState: GestureState = {
      dirAvg: internal.dirAvg,
      speedMult: internal.speedMult,
      baseSpeed: unref(opts.baseSpeed),
      minSpeed: unref(opts.minSpeed),
      maxSpeed: unref(opts.maxSpeed),
      modifierSpeed: unref(opts.modifierSpeed)
    }
    const { dirAvgNext, weight, valueDelta, speedMultNext } = interpretGesture(
      gestureState,
      dx,
      dy
    )
    internal.dirAvg = dirAvgNext
    internal.weight = weight
    internal.speedMult = speedMultNext
    internal.raw += valueDelta
  }

  /**
   * Reset transient gesture state — direction EMA and weight — that carries
   * no meaning between drags. Intentionally does NOT touch `speedMult`: the
   * Y-axis sensitivity the user dialed in during one drag persists into the
   * next, so a slip-up release doesn't force them to re-calibrate.
   */
  function reset() {
    internal.weight = 1
    internal.dirAvg = [1, 0]
  }

  /**
   * Replace the raw accumulator. Use to snap to a clean value after a drag
   * (orchestrator calls setValue(state.value) at drag end to discard any
   * sub-step residual), or to sync with an external model change.
   */
  function setValue(value: number) {
    internal.raw = value
  }

  const state = readonly(
    reactive({
      value: validated,
      speedMult: computed(() => internal.speedMult),
      weight: computed(() => internal.weight)
    })
  ) as Readonly<ScrubState>

  return { state, apply, reset, setValue }
}
