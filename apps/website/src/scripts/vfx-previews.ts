export function mountVfxPreviews(root: HTMLElement): () => void {
  const visible = new Map<HTMLVideoElement, number>()
  const observed = new WeakSet<HTMLVideoElement>()
  let active: HTMLVideoElement | undefined
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function updatePlayback() {
    if (motion.matches) {
      active?.pause()
      active = undefined
      return
    }
    const playingWithSound = [...root.querySelectorAll('video')].some(
      (video) => !video.paused && !video.muted
    )
    if (playingWithSound) return
    const next = [...visible.entries()].sort((a, b) => b[1] - a[1]).at(0)?.[0]
    if (active === next) return
    active?.pause()
    active = next
    if (!active) return
    active.muted = true
    void active.play().catch(() => undefined)
  }

  const visibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!(entry.target instanceof HTMLVideoElement)) continue
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5)
          visible.set(entry.target, entry.intersectionRatio)
        else visible.delete(entry.target)
      }
      updatePlayback()
    },
    { threshold: [0, 0.5, 1] }
  )

  function observeVideos() {
    for (const video of root.querySelectorAll<HTMLVideoElement>(
      '[data-vfx-demo] video'
    )) {
      if (
        video.closest(
          '[data-synchronized-comparison], vfx-workflow-showcase'
        ) ||
        observed.has(video)
      )
        continue
      observed.add(video)
      visibility.observe(video)
    }
  }

  const additions = new MutationObserver(observeVideos)
  additions.observe(root, { childList: true, subtree: true })
  observeVideos()
  motion.addEventListener('change', updatePlayback)
  return () => {
    active?.pause()
    motion.removeEventListener('change', updatePlayback)
    visibility.disconnect()
    additions.disconnect()
  }
}
