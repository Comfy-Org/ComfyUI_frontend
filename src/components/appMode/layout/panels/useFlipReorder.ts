import { onBeforeUpdate, onUpdated } from 'vue'
import type { Ref } from 'vue'

interface FlipReorderOptions {
  /** Animation duration in ms. Default 200. */
  durationMs?: number
  /** Returns the flip-key of an element to skip — used to keep a
   *  drag/lift treatment in place while siblings animate. */
  skipKey?: () => string | null
}

/**
 * FLIP-animates `[data-flip-key]` descendants of `containerEl` whose
 * positions changed between Vue patches.
 *
 * Captures rects in `onBeforeUpdate`, then in `onUpdated` plays the
 * difference back via the Web Animations API. Sub-pixel deltas are
 * skipped so unrelated reactive updates don't jiggle the layout.
 */
export function useFlipReorder(
  containerEl: Ref<HTMLElement | null>,
  options: FlipReorderOptions = {}
): void {
  const { durationMs = 200, skipKey } = options
  const prevRects = new Map<string, DOMRect>()

  onBeforeUpdate(() => {
    prevRects.clear()
    const els =
      containerEl.value?.querySelectorAll<HTMLElement>('[data-flip-key]')
    if (!els) return
    for (const el of els) {
      const key = el.dataset.flipKey
      if (key) prevRects.set(key, el.getBoundingClientRect())
    }
  })

  onUpdated(() => {
    const skip = skipKey?.() ?? null
    const els =
      containerEl.value?.querySelectorAll<HTMLElement>('[data-flip-key]')
    if (!els) return
    for (const el of els) {
      const key = el.dataset.flipKey
      if (!key || key === skip) continue
      const prev = prevRects.get(key)
      if (!prev) continue
      const next = el.getBoundingClientRect()
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      // Sub-pixel deltas would jiggle on every reactive update.
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: durationMs, easing: 'ease' }
      )
    }
  })
}
