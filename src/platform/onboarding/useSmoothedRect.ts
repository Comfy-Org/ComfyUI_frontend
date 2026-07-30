import { onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'

// Time constant of the exponential chase: a discrete jump eases out in ~3τ,
// while a continuously moving target is trailed by only ~τ of lag.
const TAU_MS = 80
const SETTLE_PX = 0.5

function approach(from: DOMRect, to: DOMRect, k: number): DOMRect {
  return new DOMRect(
    from.x + (to.x - from.x) * k,
    from.y + (to.y - from.y) * k,
    from.width + (to.width - from.width) * k,
    from.height + (to.height - from.height) * k
  )
}

function withinSettle(a: DOMRect, b: DOMRect): boolean {
  return (
    Math.abs(a.x - b.x) < SETTLE_PX &&
    Math.abs(a.y - b.y) < SETTLE_PX &&
    Math.abs(a.width - b.width) < SETTLE_PX &&
    Math.abs(a.height - b.height) < SETTLE_PX
  )
}

export function useSmoothedRect(target: Readonly<Ref<DOMRect | null>>) {
  const drawn = ref<DOMRect | null>(target.value)
  let frame = 0
  let last = 0

  function stop() {
    cancelAnimationFrame(frame)
    frame = 0
  }

  function tick(now: number) {
    frame = 0
    const to = target.value
    const from = drawn.value
    if (!to || !from) {
      drawn.value = to
      return
    }
    if (withinSettle(from, to)) {
      drawn.value = to
      return
    }
    const k = 1 - Math.exp(-Math.max(now - last, 0) / TAU_MS)
    last = now
    drawn.value = approach(from, to, k)
    frame = requestAnimationFrame(tick)
  }

  watch(target, (to) => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!to || !drawn.value || reduced?.matches) {
      stop()
      drawn.value = to
      return
    }
    if (frame) return
    last = performance.now()
    frame = requestAnimationFrame(tick)
  })

  onScopeDispose(stop)
  return drawn
}
