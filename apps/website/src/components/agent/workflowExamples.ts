export class WorkflowExamples extends HTMLElement {
  private cleanup?: () => void

  connectedCallback() {
    const controller = new AbortController()
    const options = { signal: controller.signal }
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    const desktop = matchMedia('(min-width: 1024px)')
    const pendingReveals = new WeakSet<HTMLVideoElement>()
    let inView = false
    const videos = () => this.querySelectorAll<HTMLVideoElement>('video')
    function motionEnabled() {
      return !reducedMotion.matches && desktop.matches
    }
    let wasMotionEnabled = motionEnabled()
    function reset(video: HTMLVideoElement) {
      video.pause()
      delete video.dataset.started
      pendingReveals.delete(video)
    }
    function unload(video: HTMLVideoElement) {
      reset(video)
      video.removeAttribute('src')
      video.load()
      video.currentTime = 0
    }
    const play = (video: HTMLVideoElement) => {
      video.muted = true
      void video.play().catch(() => {
        // The poster remains visible when autoplay is unavailable.
      })
    }
    const start = (video: HTMLVideoElement) => {
      pendingReveals.delete(video)
      if (!video.getAttribute('src') && video.dataset.src)
        video.src = video.dataset.src
      video.currentTime = 0
      video.dataset.started = 'true'
      play(video)
    }
    function syncVideo(video: HTMLVideoElement, running: boolean) {
      if (running && pendingReveals.has(video)) {
        start(video)
      } else if (running && video.dataset.started) {
        if (!video.ended) play(video)
      } else {
        video.pause()
      }
    }
    const sync = () => {
      const running = inView && motionEnabled() && !document.hidden
      this.toggleAttribute('data-paused', !running)
      for (const video of videos()) syncVideo(video, running)
    }
    const syncMotion = () => {
      const enabled = motionEnabled()
      if (wasMotionEnabled && !enabled) videos().forEach(unload)
      wasMotionEnabled = enabled
      sync()
    }
    const startOrQueue = (video: HTMLVideoElement) => {
      if (this.hasAttribute('data-paused')) {
        if (!video.dataset.started) pendingReveals.add(video)
        return
      }
      start(video)
    }
    const revealVideo = (event: AnimationEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (
        event.type === 'animationiteration' &&
        target.classList.contains('wf-scene')
      ) {
        target.querySelectorAll('video').forEach(reset)
        return
      }
      if (!target.classList.contains('wf-video-cue')) return
      const video = target.parentElement?.querySelector('video')
      if (!video || !motionEnabled()) return
      startOrQueue(video)
    }
    this.addEventListener('animationstart', revealVideo, options)
    this.addEventListener('animationiteration', revealVideo, options)
    reducedMotion.addEventListener('change', syncMotion, options)
    desktop.addEventListener('change', syncMotion, options)
    document.addEventListener('visibilitychange', sync, options)
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      sync()
    })
    observer.observe(this)
    sync()
    this.cleanup = () => {
      controller.abort()
      observer.disconnect()
      videos().forEach(unload)
    }
  }

  disconnectedCallback() {
    this.cleanup?.()
  }
}
