import { useRafFn } from '@vueuse/core'
import { toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

interface SlideProgressInput {
  currentTime: number
  duration: number
  elapsedMs: number
  fallbackMs: number
}

/**
 * Fraction of the way to the next slide. Falls back to elapsed wall-clock against
 * the watchdog's delay, so a buffering video still tracks when it will change.
 */
export function slideProgress({
  currentTime,
  duration,
  elapsedMs,
  fallbackMs
}: SlideProgressInput): number {
  const ratio =
    Number.isFinite(duration) && duration > 0
      ? currentTime / duration
      : elapsedMs / fallbackMs
  return clamp01(ratio)
}

interface ProgressBarPainterOptions {
  target: MaybeRefOrGetter<HTMLElement | null | undefined>
  progress: () => number
  active: MaybeRefOrGetter<boolean>
}

/**
 * Writes to the DOM each frame; a 60Hz ref would re-diff every mounted video.
 * Sets `scale`, not `transform`: Tailwind compiles `scale-x-*` to the standalone
 * `scale` property, so `transform` would multiply against the class.
 */
export function useProgressBarPainter({
  target,
  progress,
  active
}: ProgressBarPainterOptions): void {
  const paint = () => {
    const el = toValue(target)
    if (el) el.style.scale = `${clamp01(progress())} 1`
  }

  const { pause, resume } = useRafFn(paint, { immediate: false })

  watch(
    [() => toValue(active), () => toValue(target)],
    ([isActive, el]) => {
      pause()
      if (!el) return
      paint()
      if (isActive) resume()
    },
    { immediate: true }
  )
}
