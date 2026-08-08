<script setup lang="ts">
import { useElementVisibility, useRafFn, useResizeObserver } from '@vueuse/core'
import { onScopeDispose, ref, useTemplateRef, watch } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const { src, active = true } = defineProps<{
  /** Scene descriptor; its `assets/` siblings resolve alongside it. */
  src: string
  /** Play only while the owning slide is showing. */
  active?: boolean
}>()

/** One animated property track. `v` is a vector; `eo`/`ei` are the outgoing and
 * incoming bezier handles shared by the keyframe pair. */
interface Keyframe {
  t: number
  v: number[]
  eo?: number[]
  ei?: number[]
  _easer?: (x: number) => number
}

interface VideoLayer {
  src: string
  ip: number
  op: number
  st: number
  scale: Keyframe[]
  pos: Keyframe[]
}

interface Scene {
  outerSt: number
  outerPos: Keyframe[]
  maskPos: Keyframe[]
  maskSize: Keyframe[]
  maskRadius: number
  maskGroupOffset: number[]
  videos: VideoLayer[]
}

interface SceneData {
  fps: number
  duration: number
  compW: number
  compH: number
  scenes: Scene[]
}

/** After Effects exports its own anchor; every layer here shares the comp
 * centre, so the maths below can treat it as a constant. */
const ANCHOR_X = 528
const ANCHOR_Y = 392

/** Cubic-bezier easing solved by Newton, matching AE's temporal interpolation. */
function makeBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x
  const bx = 3 * (p2x - p1x) - cx
  const ax = 1 - cx - bx
  const cy = 3 * p1y
  const by = 3 * (p2y - p1y) - cy
  const ay = 1 - cy - by
  const f = (t: number, a: number, b: number, c: number) =>
    ((a * t + b) * t + c) * t
  const fp = (t: number, a: number, b: number, c: number) =>
    (3 * a * t + 2 * b) * t + c
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const xt = f(t, ax, bx, cx) - x
      if (Math.abs(xt) < 1e-5) break
      const d = fp(t, ax, bx, cx)
      if (Math.abs(d) < 1e-6) break
      t -= xt / d
    }
    return f(Math.min(1, Math.max(0, t)), ay, by, cy)
  }
}

function lerpKf(kfs: Keyframe[], t: number, dim: number): number[] {
  if (!kfs.length) return new Array(dim).fill(0)
  if (kfs.length === 1 || t <= kfs[0].t) return kfs[0].v.slice(0, dim)
  const last = kfs[kfs.length - 1]
  if (t >= last.t) return last.v.slice(0, dim)
  let i = 0
  while (i < kfs.length - 1 && kfs[i + 1].t <= t) i++
  const a = kfs[i]
  const b = kfs[i + 1]
  const span = b.t - a.t
  if (span <= 0) return a.v.slice(0, dim)
  const x = (t - a.t) / span
  let eased = x
  if (a.eo && b.ei) {
    a._easer ??= makeBezier(a.eo[0], a.eo[1], b.ei[0], b.ei[1])
    eased = a._easer(x)
  }
  return Array.from({ length: dim }, (_, k) => {
    const av = a.v[k] ?? 0
    const bv = b.v[k] ?? 0
    return av + (bv - av) * eased
  })
}

const rootRef = useTemplateRef<HTMLElement>('rootRef')
const stageRef = useTemplateRef<HTMLElement>('stageRef')
const onScreen = useElementVisibility(rootRef)

const data = ref<SceneData>()
const assetsBase = `${src.slice(0, src.lastIndexOf('/'))}/assets/`

/** Live DOM handles, index-aligned with data.scenes. */
interface SceneRuntime {
  el: HTMLElement
  videos: HTMLVideoElement[]
  activeIdx: number
}
const runtimes: SceneRuntime[] = []

let masterFrame = 0

/** The stage is laid out at composition pixels and scaled to fit, so all the
 * keyframe maths stays in AE's coordinate space. Cover, not contain, to match
 * the object-cover videos and `slice` Lottie scenes on the sibling slides. */
function fitStage() {
  const root = rootRef.value
  const stage = stageRef.value
  const d = data.value
  if (!root || !stage || !d) return
  const scale = Math.max(
    root.clientWidth / d.compW,
    root.clientHeight / d.compH
  )
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`
}
useResizeObserver(rootRef, fitStage)

function render() {
  const d = data.value
  if (!d) return
  for (let si = 0; si < d.scenes.length; si++) {
    const scene = d.scenes[si]
    const rt = runtimes[si]
    if (!rt) continue
    const pt = masterFrame - scene.outerSt

    const outer = lerpKf(scene.outerPos, masterFrame, 2)
    const dx = outer[0] - ANCHOR_X
    const dy = outer[1] - ANCHOR_Y

    const mp = lerpKf(scene.maskPos, pt, 2)
    const mz = lerpKf(scene.maskSize, pt, 2)
    const grp = scene.maskGroupOffset
    const mw = mz[0]
    const mh = mz[1]
    const left = mp[0] + grp[0] + dx - mw / 2
    const top = mp[1] + grp[1] + dy - mh / 2

    rt.el.style.transform = `translate(${left}px, ${top}px)`
    rt.el.style.width = `${mw}px`
    rt.el.style.height = `${mh}px`

    // Topmost layer whose in/out window contains the playhead.
    let activeIdx = -1
    for (let i = 0; i < scene.videos.length; i++) {
      const v = scene.videos[i]
      if (pt >= v.ip && pt < v.op) {
        activeIdx = i
        break
      }
    }

    if (activeIdx !== rt.activeIdx) {
      for (const ve of rt.videos) {
        ve.classList.remove('is-active')
        ve.pause()
      }
      if (activeIdx >= 0) {
        const v = scene.videos[activeIdx]
        const ve = rt.videos[activeIdx]
        const sourceTime = (pt - v.st) / d.fps
        const safe = Math.max(
          0,
          Math.min(sourceTime, (ve.duration || 60) - 0.001)
        )
        try {
          ve.currentTime = safe
        } catch {
          // A seek before metadata lands is harmless; the next switch resyncs.
        }
        ve.classList.add('is-active')
        if (playing) void ve.play().catch(() => {})
      }
      rt.activeIdx = activeIdx
    }

    if (activeIdx >= 0) {
      const v = scene.videos[activeIdx]
      const ve = rt.videos[activeIdx]
      const sc = lerpKf(v.scale, pt, 2)
      const vp = lerpKf(v.pos, pt, 2)
      const sxF = sc[0] / 100
      const syF = sc[1] / 100
      // The source anchor maps to (maskPos + videoPos); express that inside the
      // mask box, whose origin sits at maskCentre - maskSize/2.
      const vLeft = vp[0] - grp[0] + mw / 2 - sxF * ANCHOR_X
      const vTop = vp[1] - grp[1] + mh / 2 - syF * ANCHOR_Y
      ve.style.width = `${d.compW * sxF}px`
      ve.style.height = `${d.compH * syF}px`
      ve.style.transform = `translate(${vLeft}px, ${vTop}px)`
    }
  }
}

let playing = false

const { pause: pauseLoop, resume: resumeLoop } = useRafFn(
  ({ delta }) => {
    const d = data.value
    if (!d) return
    // Cap the step so a backgrounded tab resumes smoothly instead of jumping.
    masterFrame += (Math.min(delta, 100) / 1000) * d.fps
    if (masterFrame >= d.duration) masterFrame -= d.duration
    render()
  },
  { immediate: false }
)

function syncPlayback() {
  const d = data.value
  if (!d) return
  const shouldPlay = active && onScreen.value && !prefersReducedMotion()
  if (shouldPlay === playing) return
  playing = shouldPlay
  if (shouldPlay) {
    resumeLoop()
    for (const rt of runtimes) {
      const ve = rt.videos[rt.activeIdx]
      if (ve) void ve.play().catch(() => {})
    }
  } else {
    pauseLoop()
    for (const rt of runtimes) for (const ve of rt.videos) ve.pause()
  }
}

/** 10MB of clips, so nothing is fetched until the slide is actually shown. */
watch(
  [rootRef, onScreen, () => active],
  async ([root, visible, isActive]) => {
    if (!root || !visible || !isActive || data.value) return
    const res = await fetch(src)
    const d: SceneData = await res.json()
    data.value = d

    const stage = stageRef.value
    if (!stage) return
    d.scenes.forEach((scene, idx) => {
      const el = document.createElement('div')
      el.className = 'vms-scene'
      // Earlier entries paint on top, matching the source compositing order.
      el.style.zIndex = String(d.scenes.length - idx)
      el.style.borderRadius = `${scene.maskRadius}px`
      const videos = scene.videos.map((v) => {
        const ve = document.createElement('video')
        ve.src = assetsBase + v.src
        ve.muted = true
        ve.playsInline = true
        ve.preload = 'auto'
        ve.loop = false
        el.appendChild(ve)
        return ve
      })
      stage.appendChild(el)
      runtimes.push({ el, videos, activeIdx: -1 })
    })
    fitStage()
    render()
    syncPlayback()
  },
  { immediate: true }
)

watch([() => active, onScreen], syncPlayback)

onScopeDispose(() => {
  pauseLoop()
  for (const rt of runtimes)
    for (const ve of rt.videos) ve.removeAttribute('src')
})
</script>

<template>
  <div
    ref="rootRef"
    class="relative size-full overflow-hidden"
    aria-hidden="true"
  >
    <div ref="stageRef" class="vms-stage" />
  </div>
</template>

<style scoped>
.vms-stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1056px;
  height: 784px;
  transform-origin: center;
}

.vms-stage :deep(.vms-scene) {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  background: #000;
  will-change: transform, width, height;
}

.vms-stage :deep(.vms-scene video) {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  object-fit: fill;
  pointer-events: none;
  will-change: transform, width, height;
  /* Preflight caps media at `max-width: 100%`, which would clamp every clip to
     its mask box — the layers are deliberately larger than the mask so they can
     pan behind it. */
  max-width: none;
  max-height: none;
}

.vms-stage :deep(.vms-scene video.is-active) {
  display: block;
}
</style>
