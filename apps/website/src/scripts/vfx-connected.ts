import { vfxMediaRoot } from '@/data/vfxMedia'
import { gsap, ScrollTrigger } from './gsapSetup'

class VfxWorkflowShowcase extends HTMLElement {
  private observer?: ResizeObserver
  private visibleMedia = new Set<HTMLVideoElement>()
  private mediaObserver?: IntersectionObserver
  private mediaAdditions?: MutationObserver
  private reveal?: ScrollTrigger
  private timeline?: gsap.core.Timeline
  private saved?: {
    pan: number
    scroll: number
    time: number
    trigger: HTMLElement
  }
  private scale = 1
  private pan = 0
  private pointerFocusing = false
  private viewportWidth = 780
  private get panLimit() {
    return 1160 - this.viewportWidth
  }
  private drag?: { id: number; start: number; pan: number }
  private get stage() {
    return this.querySelector<HTMLElement>('.vfx-scene-stage')
  }
  private get steps() {
    return [...this.querySelectorAll<HTMLElement>('[data-canvas-step]')]
  }
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  private resize = () => {
    const viewport = this.querySelector<HTMLElement>('.vfx-canvas-window')
    const scaled = this.querySelector<HTMLElement>('.vfx-canvas-scale')
    if (!viewport || !scaled || !viewport.clientWidth) return
    this.viewportWidth = scaled.offsetWidth
    this.scale = viewport.clientWidth / this.viewportWidth
    scaled.style.transform = `scale(${this.scale})`
    this.draw()
  }
  private draw() {
    const group = this.querySelector('svg g')
    const stage = this.stage
    if (!group || !stage) return
    const bounds = stage.getBoundingClientRect()
    const scale = bounds.width / stage.offsetWidth
    if (!scale) return
    for (const node of this.steps) {
      const heading = node.querySelector<HTMLElement>('.wf-node-heading')
      const output = node.querySelector<HTMLElement>('.vfx-port-out')
      if (heading && output)
        output.style.top = `${heading.offsetTop + heading.offsetHeight / 2}px`
    }
    this.steps.slice(1).forEach((target, index) => {
      const output = this.steps[index]
        .querySelector('.vfx-port-out')
        ?.getBoundingClientRect()
      const input = target
        .querySelector('.vfx-port-in')
        ?.getBoundingClientRect()
      if (!output || !input) return
      const x = (output.left + output.width / 2 - bounds.left) / scale
      const y = (output.top + output.height / 2 - bounds.top) / scale
      const tx = (input.left + input.width / 2 - bounds.left) / scale
      const ty = (input.top + input.height / 2 - bounds.top) / scale
      let path = group.children.item(index)
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        group.append(path)
      }
      const bend = Math.max(40, (tx - x) * 0.55)
      path.setAttribute(
        'd',
        `M ${x} ${y} C ${x + bend} ${y}, ${tx - bend} ${ty}, ${tx} ${ty}`
      )
    })
  }
  private hideConnections() {
    this.querySelectorAll<SVGPathElement>('.vfx-connections path').forEach(
      (path) => {
        const length = path.getTotalLength()
        gsap.set(path, {
          strokeDasharray: `${length} ${length}`,
          strokeDashoffset: length
        })
      }
    )
  }
  private move(value: number) {
    this.pan = Math.min(0, Math.max(-this.panLimit, value))
    if (this.stage) gsap.set(this.stage, { x: this.pan })
  }
  private finish = () => {
    this.timeline?.kill()
    gsap.set(this.steps, { opacity: 1 })
    gsap.set(this.querySelectorAll('svg path'), { strokeDashoffset: 0 })
    delete this.dataset.processing
    this.dataset.canvasReady = ''
  }
  private play = () => {
    this.draw()
    if (this.reduced.matches) {
      this.finish()
      this.move(-this.panLimit)
      this.draw()
      return
    }
    const paths = this.querySelectorAll('svg path')
    gsap.set(this.steps, { opacity: 0 })
    this.hideConnections()
    this.timeline = gsap
      .timeline({
        onComplete: () => {
          this.dataset.canvasReady = ''
        }
      })
      .timeScale(0.6)
    const [source, keyframe, result] = this.steps
    this.timeline
      .to(source, { opacity: 1, duration: 0.45 }, 0)
      .to(paths[0], { strokeDashoffset: 0, duration: 0.55, ease: 'none' }, 0.45)
      .to(keyframe, { opacity: 1, duration: 0.5 }, 1)
      .call(
        () => {
          this.dataset.processing = ''
        },
        [],
        1.1
      )
      .call(
        () => {
          delete this.dataset.processing
        },
        [],
        2.1
      )
      .to(paths[1], { strokeDashoffset: 0, duration: 0.65, ease: 'none' }, 1.45)
      .to(result, { opacity: 1, duration: 0.65 }, 2.1)
      .to(
        this,
        {
          pan: -this.panLimit,
          duration: 1.9,
          ease: 'power2.inOut',
          onUpdate: () => this.move(this.pan)
        },
        1.1
      )
  }

  private down = (event: PointerEvent) => {
    this.pointerFocusing = true
    if (event.button !== 0 || !(event.target instanceof Element)) return
    if (!event.target.closest('.vfx-canvas-window')) return
    if (
      event.target.closest(
        'button, input, [role="slider"], a, [data-testid="video-compare-surface"]'
      )
    )
      return
    this.finish()
    this.drag = { id: event.pointerId, start: event.clientX, pan: this.pan }
    this.setPointerCapture(event.pointerId)
  }
  private pointer = (event: PointerEvent) => {
    if (!this.drag || this.drag.id !== event.pointerId) return
    this.move(this.drag.pan + (event.clientX - this.drag.start) / this.scale)
  }
  private up = (event: PointerEvent) => {
    this.pointerFocusing = false
    this.drag = undefined
    if (this.hasPointerCapture(event.pointerId))
      this.releasePointerCapture(event.pointerId)
  }
  private focusNode = (event: FocusEvent) => {
    if (!(event.target instanceof Element)) return
    const node = event.target.closest<HTMLElement>('[data-canvas-step]')
    if (!node) return
    const viewport = this.querySelector('.vfx-canvas-window')
    if (viewport) viewport.scrollLeft = 0
    if (this.pointerFocusing) return
    this.finish()
    const left = node.offsetLeft + this.pan
    if (left < 0 || left + node.offsetWidth > this.viewportWidth)
      this.move(
        -(node.offsetLeft + node.offsetWidth / 2 - this.viewportWidth / 2)
      )
  }
  private select = (event: Event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLElement>('[data-workflow-variant]')
    if (!button || !this.contains(button)) return
    this.finish()
    this.querySelectorAll('[data-workflow-variant]').forEach((node) =>
      node.setAttribute('aria-pressed', String(node === button))
    )
    const image = this.querySelector<HTMLImageElement>('.vfx-keyframe-node img')
    if (image && this.dataset.vfxDemo !== 'sequence')
      image.src = `${vfxMediaRoot}/${button.dataset.workflowVariant}.jpg`
    this.dataset.selectedVariant = button.dataset.workflowVariant
    this.dispatchEvent(
      new CustomEvent('workflow-variant-change', {
        detail: button.dataset.workflowVariant
      })
    )
    if (!this.hasAttribute('data-workspace')) this.move(-this.panLimit)
  }
  private syncVariant = (event: Event) => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'string')
      return
    const id = event.detail
    const match = this.querySelector<HTMLElement>(
      `[data-workflow-variant="${CSS.escape(id)}"]`
    )
    if (!match) return
    this.querySelectorAll<HTMLElement>('[data-workflow-variant]').forEach(
      (button) => button.setAttribute('aria-pressed', String(button === match))
    )
    const image = this.querySelector<HTMLImageElement>('.vfx-keyframe-node img')
    if (image && this.dataset.vfxDemo !== 'sequence')
      image.src = `${vfxMediaRoot}/${id}.jpg`
    this.dataset.selectedVariant = id
    const label = match.getAttribute('aria-label') ?? id
    const heading = this.querySelector('.vfx-main-node .ppformula-text-center')
    if (heading) heading.textContent = label
    const outputImage =
      this.querySelector<HTMLImageElement>('.vfx-main-node img')
    if (outputImage) {
      outputImage.src = `${vfxMediaRoot}/${id}.jpg`
      outputImage.alt = label
    }
    const video = this.querySelector<HTMLVideoElement>('.vfx-main-node video')
    if (video) {
      video.dataset.playbackTime = String(video.currentTime)
      video.dataset.src = `${vfxMediaRoot}/${id}.mp4`
      video.poster = `${vfxMediaRoot}/${id}.jpg`
      video.setAttribute('aria-label', label)
      video.src = video.dataset.src
      if (this.visibleMedia.has(video) && !this.reduced.matches)
        void video.play().catch(() => undefined)
    }
  }
  private restoreTime = (event: Event) => {
    if (!(event instanceof CustomEvent)) return
    const time: unknown = event.detail?.time
    const video = this.querySelector<HTMLVideoElement>('.vfx-main-node video')
    if (!video || typeof time !== 'number' || !Number.isFinite(time)) return
    video.dataset.playbackTime = String(time)
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA)
      this.mediaReady(video)
  }
  private mediaReady(video: HTMLVideoElement) {
    const time = Number(video.dataset.playbackTime)
    if (Number.isFinite(time) && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05))
      delete video.dataset.playbackTime
    }
    if (this.visibleMedia.has(video) && !this.reduced.matches) {
      video.muted = true
      void video.play().catch(() => undefined)
    }
  }
  private loaded = (event: Event) => {
    if (
      event.target instanceof HTMLVideoElement &&
      (event.target.dataset.src ||
        event.target.closest('[data-vfx-sequence-player]'))
    )
      this.mediaReady(event.target)
  }
  private workspace = (event: Event) => {
    if (!(event.target instanceof Element)) return
    const trigger = event.target.closest<HTMLElement>('[data-open-studio]')
    if (trigger) this.showWorkspace(trigger)
    else if (event.target.closest('[data-back-workflow]')) this.closeWorkspace()
  }
  private escape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.hasAttribute('data-workspace')) {
      event.preventDefault()
      this.closeWorkspace()
      return
    }
    if (
      !(event.target instanceof Element) ||
      !event.target.matches('.vfx-canvas-window')
    )
      return
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    this.finish()
    this.move(
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? -this.panLimit
          : this.pan + (event.key === 'ArrowLeft' ? 80 : -80)
    )
  }
  private showWorkspace(trigger: HTMLElement) {
    const showcase = this.querySelector<HTMLElement>('.vfx-showcase-view')
    const studio = this.querySelector<HTMLElement>('.vfx-studio-view')
    if (!showcase || !studio || this.saved) return
    this.reveal?.kill()
    this.finish()
    const time =
      showcase.querySelector<HTMLVideoElement>('.vfx-main-node video')
        ?.currentTime ?? 0
    this.saved = { pan: this.pan, scroll: window.scrollY, time, trigger }
    showcase
      .querySelectorAll<HTMLVideoElement>('video[data-src]')
      .forEach((video) => video.pause())
    this.dispatchEvent(
      new CustomEvent('workflow-studio-mode', {
        detail: { mode: trigger.dataset.openStudio, time }
      })
    )
    const standalone = studio.querySelector<HTMLVideoElement>(
      '[data-vfx-sequence-player] video'
    )
    if (standalone) {
      standalone.dataset.playbackTime = String(time)
      if (standalone.readyState >= HTMLMediaElement.HAVE_METADATA)
        this.mediaReady(standalone)
    }
    showcase.hidden = true
    showcase.inert = true
    studio.hidden = false
    studio.inert = false
    this.dataset.workspace = ''
    trigger.setAttribute('aria-expanded', 'true')
    this.slide(studio, 64)
    const back = studio.querySelector<HTMLElement>('[data-back-workflow]')
    back?.focus({ preventScroll: true })
    if (
      studio.getBoundingClientRect().top < 120 ||
      studio.getBoundingClientRect().top > 180
    ) {
      studio.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }
  private closeWorkspace() {
    const showcase = this.querySelector<HTMLElement>('.vfx-showcase-view')
    const studio = this.querySelector<HTMLElement>('.vfx-studio-view')
    const saved = this.saved
    if (!showcase || !studio || !saved) return
    const playbackTime = Number(
      studio.querySelector<HTMLElement>('[data-playback-time]')?.dataset
        .playbackTime
    )
    const time = Number.isFinite(playbackTime) ? playbackTime : saved.time
    studio
      .querySelectorAll<HTMLVideoElement>('video')
      .forEach((video) => video.pause())
    studio.hidden = true
    studio.inert = true
    showcase.hidden = false
    showcase.inert = false
    this.removeAttribute('data-workspace')
    this.resize()
    this.move(saved.pan)
    this.dispatchEvent(
      new CustomEvent('workflow-time-change', { detail: { time } })
    )
    saved.trigger.setAttribute('aria-expanded', 'false')
    this.slide(showcase, -48)
    saved.trigger.focus({ preventScroll: true })
    window.scrollTo({ top: saved.scroll, behavior: 'instant' })
    this.saved = undefined
  }
  private slide(view: HTMLElement, x: number) {
    gsap.killTweensOf(view)
    if (this.reduced.matches) gsap.set(view, { x: 0, opacity: 1 })
    else
      gsap.fromTo(
        view,
        { x, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }
      )
  }
  private pausePreviews = () => {
    if (this.reduced.matches)
      this.querySelectorAll<HTMLVideoElement>('video').forEach((video) =>
        video.pause()
      )
  }
  connectedCallback() {
    this.mediaObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!(entry.target instanceof HTMLVideoElement)) continue
          const video = entry.target
          if (entry.isIntersecting) this.visibleMedia.add(video)
          else this.visibleMedia.delete(video)
          if (!entry.isIntersecting || this.reduced.matches) {
            video.pause()
            continue
          }
          if (!video.src && video.dataset.src) video.src = video.dataset.src
          this.mediaReady(video)
        }
      },
      { threshold: 0.1 }
    )
    const observed = new WeakSet<HTMLVideoElement>()
    const observeMedia = () => {
      this.querySelectorAll<HTMLVideoElement>(
        'video[data-src], [data-vfx-sequence-player] video'
      ).forEach((video) => {
        if (observed.has(video)) return
        observed.add(video)
        if (video.closest('[data-vfx-sequence-player]'))
          video.dataset.playbackTime =
            this.querySelector<HTMLElement>('[data-playback-time]')?.dataset
              .playbackTime ?? '0'
        this.mediaObserver?.observe(video)
      })
    }
    observeMedia()
    this.mediaAdditions = new MutationObserver(observeMedia)
    this.mediaAdditions.observe(this, { childList: true, subtree: true })
    this.reduced.addEventListener('change', this.pausePreviews)
    this.draw()
    this.resize()
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(this)
    this.querySelectorAll('.wf-node-heading').forEach((heading) =>
      this.observer?.observe(heading)
    )
    void document.fonts.ready.then(() => {
      if (this.isConnected) this.draw()
    })
    requestAnimationFrame(() => {
      if (this.isConnected) this.draw()
    })
    if (!this.reduced.matches) {
      gsap.set(this.steps, { opacity: 0 })
      this.hideConnections()
    }
    const viewport = this.querySelector('.vfx-canvas-window')
    if (viewport)
      this.reveal = ScrollTrigger.create({
        trigger: viewport,
        start: 'center center',
        once: true,
        onEnter: this.play
      })
    this.addEventListener('workflow-time-change', this.restoreTime)
    this.addEventListener('loadedmetadata', this.loaded, true)
    this.addEventListener('workflow-variant-change', this.syncVariant)
    this.addEventListener('click', this.select)
    this.addEventListener('click', this.workspace)
    this.addEventListener('keydown', this.escape)
    this.addEventListener('pointerdown', this.down)
    this.addEventListener('pointermove', this.pointer)
    this.addEventListener('pointerup', this.up)
    this.addEventListener('pointercancel', this.up)
    this.addEventListener('focusin', this.focusNode)
    this.reduced.addEventListener('change', this.finish)
  }
  disconnectedCallback() {
    this.mediaObserver?.disconnect()
    this.mediaAdditions?.disconnect()
    this.visibleMedia.clear()
    this.removeEventListener('workflow-time-change', this.restoreTime)
    this.removeEventListener('loadedmetadata', this.loaded, true)
    this.querySelectorAll<HTMLVideoElement>('video').forEach((video) =>
      video.pause()
    )
    this.reduced.removeEventListener('change', this.pausePreviews)
    this.timeline?.kill()
    this.observer?.disconnect()
    this.reveal?.kill()
    this.removeEventListener('workflow-variant-change', this.syncVariant)
    this.removeEventListener('click', this.select)
    this.removeEventListener('click', this.workspace)
    this.removeEventListener('keydown', this.escape)
    this.removeEventListener('pointerdown', this.down)
    this.removeEventListener('pointermove', this.pointer)
    this.removeEventListener('pointerup', this.up)
    this.removeEventListener('pointercancel', this.up)
    this.removeEventListener('focusin', this.focusNode)
    this.reduced.removeEventListener('change', this.finish)
  }
}
if (!customElements.get('vfx-workflow-showcase'))
  customElements.define('vfx-workflow-showcase', VfxWorkflowShowcase)
