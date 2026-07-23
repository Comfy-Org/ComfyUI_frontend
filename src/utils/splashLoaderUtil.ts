const SPLASH_LOADER_ID = 'splash-loader'

/**
 * Minimum time the pre-Vue splash logo stays on screen before it is removed,
 * so its rising wave-fill (or static filled frame under reduced motion) is
 * perceptible even on fast/warm/cached loads.
 */
export const MIN_SPLASH_VISIBLE_MS = 800

const FADE_DURATION_MS = 300

/**
 * Milliseconds still owed to the minimum visible window. Pure and clamped to
 * `>= 0`; falls back to `0` when the paint timestamp is missing/invalid.
 */
export function remainingSplashVisibleMs(
  shownAt: number,
  now: number,
  minVisibleMs = MIN_SPLASH_VISIBLE_MS
): number {
  if (!Number.isFinite(shownAt)) return 0
  return Math.max(0, minVisibleMs - (now - shownAt))
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function fadeOutAndRemove(el: HTMLElement): void {
  if (prefersReducedMotion()) {
    el.remove()
    return
  }
  const remove = () => el.remove()
  el.style.transition = `opacity ${FADE_DURATION_MS}ms ease`
  el.style.opacity = '0'
  el.addEventListener('transitionend', remove, { once: true })
  window.setTimeout(remove, FADE_DURATION_MS + 50)
}

/**
 * Removes the pre-Vue splash loader once it has been visible for at least
 * {@link MIN_SPLASH_VISIBLE_MS}, fading it out (unless the user prefers reduced
 * motion). Safe to call from multiple mount sites: the first call wins and
 * later calls are ignored.
 */
export function dismissSplashLoader(): void {
  const el = document.getElementById(SPLASH_LOADER_ID)
  if (!el || el.dataset.dismissing === 'true') return
  el.dataset.dismissing = 'true'

  const shownAt = Number(el.dataset.shownAt)
  const delay = remainingSplashVisibleMs(shownAt, Date.now())
  window.setTimeout(() => fadeOutAndRemove(el), delay)
}
