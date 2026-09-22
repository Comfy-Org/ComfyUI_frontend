export class WorkflowExamples extends HTMLElement {
  private cleanup?: () => void

  connectedCallback() {
    const controller = new AbortController()
    const options = { signal: controller.signal }
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    const desktop = matchMedia('(min-width: 1024px)')
    const pendingReveals = new WeakSet<HTMLVideoElement>()
    let inView = false
    const selectedExample = () =>
      this.querySelector<HTMLInputElement>('input:checked')?.value ??
      this.querySelector<HTMLElement>('.wf-example')?.dataset.example
    const videos = () => this.querySelectorAll<HTMLVideoElement>('video')
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
    const sync = () => {
      const running =
        inView && desktop.matches && !reducedMotion.matches && !document.hidden
      this.toggleAttribute('data-paused', !running)
      for (const video of videos()) {
        const active =
          video.closest<HTMLElement>('.wf-example')?.dataset.example ===
          selectedExample()
        if (!active || reducedMotion.matches || !desktop.matches) {
          video.pause()
          delete video.dataset.started
          pendingReveals.delete(video)
        } else if (running && pendingReveals.has(video)) {
          start(video)
        } else if (running && video.dataset.started) {
          if (!video.ended) play(video)
        } else {
          video.pause()
        }
      }
    }
    const revealVideo = (event: AnimationEvent) => {
      if (
        event.type === 'animationiteration' &&
        event.target instanceof HTMLElement &&
        event.target.classList.contains('wf-scene')
      ) {
        for (const video of event.target.querySelectorAll('video')) {
          video.pause()
          delete video.dataset.started
          pendingReveals.delete(video)
        }
        return
      }
      if (
        !(event.target instanceof HTMLElement) ||
        !event.target.classList.contains('wf-video-cue')
      )
        return
      const video = event.target.parentElement?.querySelector('video')
      if (!video || reducedMotion.matches || !desktop.matches) return
      if (
        video.closest<HTMLElement>('.wf-example')?.dataset.example !==
        selectedExample()
      )
        return
      if (this.hasAttribute('data-paused')) {
        if (!video.dataset.started) pendingReveals.add(video)
        return
      }
      start(video)
    }
    this.addEventListener('animationstart', revealVideo, options)
    this.addEventListener('animationiteration', revealVideo, options)
    this.addEventListener('change', sync, options)
    reducedMotion.addEventListener('change', sync, options)
    desktop.addEventListener('change', sync, options)
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
      videos().forEach((video) => video.pause())
    }
  }

  disconnectedCallback() {
    this.cleanup?.()
  }
}
