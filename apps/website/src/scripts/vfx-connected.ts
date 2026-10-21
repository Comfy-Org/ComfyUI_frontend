import { vfxVariantMedia } from '@/data/vfxMedia'
import { gsap, ScrollTrigger } from './gsapSetup'

class VfxWorkflowShowcase extends HTMLElement {
  private observer?: ResizeObserver
  private visibleMedia = new Set<HTMLVideoElement>()
  private playbackIntent: 'auto' | 'play' | 'pause' = 'auto'
  private get playbackPaused() {
    return (
      this.playbackIntent === 'pause' ||
      (this.playbackIntent === 'auto' && this.reduced.matches)
    )
  }
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
    this.move(this.pan)
    this.draw()
  }
  private alignOutput(node: HTMLElement) {
    const heading = node.querySelector<HTMLElement>('.wf-node-heading')
    const output = node.querySelector<HTMLElement>('.vfx-port-out')
    if (!heading || !output) return
    output.style.top = `${heading.offsetTop + heading.offsetHeight / 2}px`
  }
  private portBounds(node: HTMLElement, selector: string) {
    return node.querySelector(selector)?.getBoundingClientRect()
  }
  private connectionPath(group: Element, index: number) {
    const existing = group.children.item(index)
    if (existing) return existing
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    group.append(path)
    return path
  }
  private drawConnection(
    group: Element,
    bounds: DOMRect,
    scale: number,
    target: HTMLElement,
    index: number
  ) {
    const output = this.portBounds(this.steps[index], '.vfx-port-out')
    const input = this.portBounds(target, '.vfx-port-in')
    if (!output || !input) return
    const x = (output.left + output.width / 2 - bounds.left) / scale
    const y = (output.top + output.height / 2 - bounds.top) / scale
    const tx = (input.left + input.width / 2 - bounds.left) / scale
    const ty = (input.top + input.height / 2 - bounds.top) / scale
    const bend = Math.max(40, (tx - x) * 0.55)
    this.connectionPath(group, index).setAttribute(
      'd',
      `M ${x} ${y} C ${x + bend} ${y}, ${tx - bend} ${ty}, ${tx} ${ty}`
    )
  }
  private draw() {
    const group = this.querySelector('svg g')
    const stage = this.stage
    if (!group || !stage) return
    this.drawStage(group, stage)
  }
  private drawStage(group: Element, stage: HTMLElement) {
    const bounds = stage.getBoundingClientRect()
    const scale = bounds.width / stage.offsetWidth
    if (!scale) return
    this.steps.forEach((node) => this.alignOutput(node))
    this.steps
      .slice(1)
      .forEach((target, index) =>
        this.drawConnection(group, bounds, scale, target, index)
      )
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
    this.reveal?.kill()
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

  private draggableTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false
    if (!target.closest('.vfx-canvas-window')) return false
    return !target.closest(
      'button, input, [role="slider"], a, [data-testid="video-compare-surface"]'
    )
  }
  private down = (event: PointerEvent) => {
    this.pointerFocusing = true
    if (event.button !== 0 || !this.draggableTarget(event.target)) return
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
  private resetCanvasScroll() {
    const viewport = this.querySelector('.vfx-canvas-window')
    if (viewport) viewport.scrollLeft = 0
  }
  private revealFocusedNode(node: HTMLElement) {
    if (this.pointerFocusing) return
    this.finish()
    const left = node.offsetLeft + this.pan
    if (left < 0 || left + node.offsetWidth > this.viewportWidth)
      this.move(
        -(node.offsetLeft + node.offsetWidth / 2 - this.viewportWidth / 2)
      )
  }
  private focusNode = (event: FocusEvent) => {
    if (!(event.target instanceof Element)) return
    const node = event.target.closest<HTMLElement>('[data-canvas-step]')
    if (!node) return
    this.resetCanvasScroll()
    this.revealFocusedNode(node)
  }
  private variantButton(target: EventTarget | null) {
    if (!(target instanceof Element)) return null
    const button = target.closest<HTMLElement>('[data-workflow-variant]')
    if (!button) return null
    return this.contains(button) ? button : null
  }
  private markVariant(match: HTMLElement) {
    this.querySelectorAll('[data-workflow-variant]').forEach((button) =>
      button.setAttribute('aria-pressed', String(button === match))
    )
  }
  private updateKeyframe(id: string | undefined) {
    if (this.dataset.vfxDemo === 'sequence') return
    const image = this.querySelector<HTMLImageElement>('.vfx-keyframe-node img')
    if (image) image.src = vfxVariantMedia(id, 'jpg')
  }
  private select = (event: Event) => {
    const button = this.variantButton(event.target)
    if (!button) return
    this.finish()
    this.markVariant(button)
    this.updateKeyframe(button.dataset.workflowVariant)
    this.dataset.selectedVariant = button.dataset.workflowVariant
    this.dispatchEvent(
      new CustomEvent('workflow-variant-change', {
        detail: button.dataset.workflowVariant
      })
    )
    if (!this.hasAttribute('data-workspace')) this.move(-this.panLimit)
  }
  private updateOutputImage(id: string, label: string) {
    const image = this.querySelector<HTMLImageElement>('.vfx-main-node img')
    if (!image) return
    image.src = vfxVariantMedia(id, 'jpg')
    image.alt = label
  }
  private playVisible(video: HTMLVideoElement) {
    if (
      !this.visibleMedia.has(video) ||
      this.playbackPaused ||
      video.closest('[hidden], [inert]')
    )
      return
    video.muted = true
    void video.play().catch(() => undefined)
  }
  private updateOutputVideo(id: string, label: string) {
    const video = this.querySelector<HTMLVideoElement>('.vfx-main-node video')
    if (!video) return
    if (
      video.readyState >= HTMLMediaElement.HAVE_METADATA ||
      !video.dataset.playbackTime
    )
      video.dataset.playbackTime = String(video.currentTime)
    video.dataset.src = vfxVariantMedia(id, 'mp4')
    video.poster = vfxVariantMedia(id, 'jpg')
    video.setAttribute('aria-label', label)
    video.src = video.dataset.src
    this.playVisible(video)
  }
  private updateOutput(id: string, label: string) {
    const heading = this.querySelector(
      '.vfx-main-node [data-testid="workflow-node-label"]'
    )
    if (heading) heading.textContent = label
    this.updateOutputImage(id, label)
    this.updateOutputVideo(id, label)
  }
  private syncVariant = (event: Event) => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'string')
      return
    this.applyVariant(event.detail)
    this.syncPlayback()
  }
  private applyVariant(id: string) {
    const match = this.querySelector<HTMLElement>(
      `[data-workflow-variant="${CSS.escape(id)}"]`
    )
    if (!match) return
    this.markVariant(match)
    this.updateKeyframe(id)
    this.dataset.selectedVariant = id
    this.updateOutput(id, match.getAttribute('aria-label') ?? id)
  }
  private seekWhenReady(video: HTMLVideoElement, time: number) {
    video.dataset.playbackTime = String(time)
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA)
      this.mediaReady(video)
  }
  private restoreTime = (event: Event) => {
    if (!(event instanceof CustomEvent)) return
    this.restoreOutputTime(event.detail?.time)
  }
  private restoreOutputTime(time: unknown) {
    if (typeof time !== 'number' || !Number.isFinite(time)) return
    const video = this.querySelector<HTMLVideoElement>('.vfx-main-node video')
    if (video) this.seekWhenReady(video, time)
  }
  private seekPendingTime(video: HTMLVideoElement) {
    const time = Number(video.dataset.playbackTime)
    if (!Number.isFinite(time) || !Number.isFinite(video.duration)) return
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05))
    delete video.dataset.playbackTime
  }
  private mediaReady(video: HTMLVideoElement) {
    this.seekPendingTime(video)
    this.playVisible(video)
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
  private panFromKey(key: string) {
    return new Map([
      ['Home', 0],
      ['End', -this.panLimit],
      ['ArrowLeft', this.pan + 80],
      ['ArrowRight', this.pan - 80]
    ]).get(key)
  }
  private navigateCanvas(event: KeyboardEvent) {
    if (!(event.target instanceof Element)) return
    if (!event.target.matches('.vfx-canvas-window')) return
    const pan = this.panFromKey(event.key)
    if (pan === undefined) return
    event.preventDefault()
    this.finish()
    this.move(pan)
  }
  private escape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.hasAttribute('data-workspace')) {
      event.preventDefault()
      this.closeWorkspace()
      return
    }
    this.navigateCanvas(event)
  }
  private initializeStandalone(studio: HTMLElement, time: number) {
    const video = studio.querySelector<HTMLVideoElement>(
      '[data-vfx-sequence-player] video'
    )
    if (video) this.seekWhenReady(video, time)
  }
  private focusStudio(studio: HTMLElement) {
    const back = studio.querySelector<HTMLElement>('[data-back-workflow]')
    back?.focus({ preventScroll: true })
    const top = studio.getBoundingClientRect().top
    if (top < 120 || top > 180)
      studio.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
  private outputTime(showcase: HTMLElement) {
    return (
      showcase.querySelector<HTMLVideoElement>('.vfx-main-node video')
        ?.currentTime ?? 0
    )
  }
  private showWorkspace(trigger: HTMLElement) {
    const showcase = this.querySelector<HTMLElement>('.vfx-showcase-view')
    const studio = this.querySelector<HTMLElement>('.vfx-studio-view')
    if (!showcase || !studio || this.saved) return
    this.reveal?.kill()
    this.finish()
    const time = this.outputTime(showcase)
    this.saved = { pan: this.pan, scroll: window.scrollY, time, trigger }
    showcase
      .querySelectorAll<HTMLVideoElement>('video[data-src]')
      .forEach((video) => video.pause())
    this.dispatchEvent(
      new CustomEvent('workflow-studio-mode', {
        detail: {
          mode: trigger.dataset.openStudio,
          time,
          paused: this.playbackPaused
        }
      })
    )
    this.initializeStandalone(studio, time)
    showcase.hidden = true
    showcase.inert = true
    studio.hidden = false
    studio.inert = false
    this.dataset.workspace = ''
    trigger.setAttribute('aria-expanded', 'true')
    this.slide(studio, 64)
    this.focusStudio(studio)
    this.syncPlayback()
  }
  private studioTime(studio: HTMLElement, fallback: number) {
    const playbackTime = Number(
      studio.querySelector<HTMLElement>('[data-playback-time]')?.dataset
        .playbackTime
    )
    return Number.isFinite(playbackTime) ? playbackTime : fallback
  }
  private closeWorkspace() {
    const showcase = this.querySelector<HTMLElement>('.vfx-showcase-view')
    const studio = this.querySelector<HTMLElement>('.vfx-studio-view')
    const saved = this.saved
    if (!showcase || !studio || !saved) return
    const time = this.studioTime(studio, saved.time)
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
    this.syncPlayback()
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
  private syncPlayback() {
    const paused = this.playbackPaused
    this.dataset.playbackPaused = String(paused)
    this.querySelectorAll<HTMLButtonElement>('[data-vfx-playback]').forEach(
      (button) => {
        button.textContent =
          (paused ? button.dataset.playLabel : button.dataset.pauseLabel) ?? ''
        button.setAttribute('aria-pressed', String(paused))
      }
    )
    this.dispatchEvent(
      new CustomEvent('workflow-playback-change', { detail: { paused } })
    )
    if (paused)
      this.querySelectorAll<HTMLVideoElement>('video').forEach((video) =>
        video.pause()
      )
    else
      this.visibleMedia.forEach((video) => this.updateVisibleMedia(video, true))
  }
  private togglePlayback = (event: Event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('[data-vfx-playback]')
    if (!button || !this.contains(button)) return
    this.playbackIntent = this.playbackPaused ? 'play' : 'pause'
    this.syncPlayback()
  }
  private pausePreviews = () => {
    if (this.reduced.matches && this.playbackIntent === 'play')
      this.playbackIntent = 'auto'
    this.syncPlayback()
  }
  private observeVisibility(entry: IntersectionObserverEntry) {
    if (!(entry.target instanceof HTMLVideoElement)) return
    const video = entry.target
    if (entry.isIntersecting) this.visibleMedia.add(video)
    else this.visibleMedia.delete(video)
    this.updateVisibleMedia(video, entry.isIntersecting)
  }
  private updateVisibleMedia(video: HTMLVideoElement, visible: boolean) {
    if (!visible || this.playbackPaused || video.closest('[hidden], [inert]')) {
      video.pause()
      return
    }
    this.loadMedia(video)
    this.mediaReady(video)
  }
  private loadMedia(video: HTMLVideoElement) {
    if (!video.src && video.dataset.src) video.src = video.dataset.src
  }
  connectedCallback() {
    this.mediaObserver = new IntersectionObserver(
      (entries) => entries.forEach((entry) => this.observeVisibility(entry)),
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
            this.querySelector<HTMLElement>(
              '.vfx-studio-view [data-vfx-studio]'
            )?.dataset.playbackTime ?? '0'
        this.mediaObserver?.observe(video)
      })
    }
    observeMedia()
    this.mediaAdditions = new MutationObserver(observeMedia)
    this.mediaAdditions.observe(this, { childList: true, subtree: true })
    this.reduced.addEventListener('change', this.pausePreviews)
    this.syncPlayback()
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
        start: 'center 67%',
        once: true,
        onEnter: this.play
      })
    this.addEventListener('workflow-time-change', this.restoreTime)
    this.addEventListener('loadedmetadata', this.loaded, true)
    this.addEventListener('workflow-variant-change', this.syncVariant)
    this.addEventListener('click', this.select)
    this.addEventListener('click', this.workspace)
    this.addEventListener('click', this.togglePlayback)
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
    this.removeEventListener('click', this.togglePlayback)
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
