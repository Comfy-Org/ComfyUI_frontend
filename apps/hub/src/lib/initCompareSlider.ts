/**
 * Before/after compare slider (used by ThumbnailDisplay.astro and HubWorkflowCard.vue).
 * Returns a cleanup function to remove listeners.
 */
export function initCompareSlider(slider: HTMLElement | null): () => void {
  if (!slider) return () => {}

  const overlay = slider.querySelector('.compare-overlay') as HTMLElement | null
  const handle = slider.querySelector('.compare-handle') as HTMLElement | null

  if (!overlay || !handle) return () => {}

  const updatePosition = (clientX: number) => {
    const rect = slider.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const percent = rect.width > 0 ? (x / rect.width) * 100 : 50
    overlay.style.clipPath = `inset(0 ${100 - percent}% 0 0)`
    handle.style.left = `${percent}%`
  }

  const onMouseMove = (e: MouseEvent) => {
    updatePosition(e.clientX)
  }

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    if (e.touches[0]) updatePosition(e.touches[0].clientX)
  }

  slider.addEventListener('mousemove', onMouseMove)
  slider.addEventListener('touchmove', onTouchMove, { passive: false })

  return () => {
    slider.removeEventListener('mousemove', onMouseMove)
    slider.removeEventListener('touchmove', onTouchMove)
  }
}
