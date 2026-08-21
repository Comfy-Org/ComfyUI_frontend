<script setup lang="ts">
import { useElementVisibility, useRafFn, useResizeObserver } from '@vueuse/core'
import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  useTemplateRef,
  watch
} from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

const { src, active = true } = defineProps<{
  /** Scene descriptor; relative clip names resolve against its `assets/`
   * sibling directory, absolute URLs pass through unchanged. */
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
const scenes = computed(() => data.value?.scenes ?? [])
const assetsBase = `${src.slice(0, src.lastIndexOf('/'))}/assets/`

function resolveVideoSrc(videoSrc: string) {
  return videoSrc.startsWith('https://') ? videoSrc : assetsBase + videoSrc
}

/** Live DOM handles from the template `v-for`, index-aligned with
 * data.scenes; the rAF loop below writes their styles directly. */
const sceneEls: (HTMLElement | undefined)[] = []
const videoEls: (HTMLVideoElement | undefined)[][] = []
const activeIdxs: number[] = []

function setSceneEl(index: number, el: unknown) {
  sceneEls[index] = (el as HTMLElement | null) ?? undefined
}

function setVideoEl(sceneIndex: number, videoIndex: number, el: unknown) {
  const list = (videoEls[sceneIndex] ??= [])
  list[videoIndex] = (el as HTMLVideoElement | null) ?? undefined
}

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
    const el = sceneEls[si]
    if (!el) continue
    const videos = videoEls[si] ?? []
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

    el.style.transform = `translate(${left}px, ${top}px)`
    el.style.width = `${mw}px`
    el.style.height = `${mh}px`

    // Topmost layer whose in/out window contains the playhead.
    let activeIdx = -1
    for (let i = 0; i < scene.videos.length; i++) {
      const v = scene.videos[i]
      if (pt >= v.ip && pt < v.op) {
        activeIdx = i
        break
      }
    }

    if (activeIdx !== activeIdxs[si]) {
      for (const ve of videos) {
        ve?.classList.remove('is-active')
        ve?.pause()
      }
      const ve = activeIdx >= 0 ? videos[activeIdx] : undefined
      if (activeIdx >= 0 && ve) {
        const v = scene.videos[activeIdx]
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
      activeIdxs[si] = activeIdx
    }

    if (activeIdx >= 0) {
      const v = scene.videos[activeIdx]
      const ve = videos[activeIdx]
      if (!ve) continue
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
    for (let si = 0; si < activeIdxs.length; si++) {
      const ve = videoEls[si]?.[activeIdxs[si]]
      if (ve) void ve.play().catch(() => {})
    }
  } else {
    pauseLoop()
    for (const list of videoEls) for (const ve of list) ve?.pause()
  }
}

/** 10MB of clips, so nothing is fetched until the slide is actually shown.
 * The flag flips before the fetch: the watch has three sources that can fire
 * in quick succession, and guarding on `data` alone would let a second firing
 * start a duplicate load while the first is still in flight. */
let loadStarted = false

watch(
  [rootRef, onScreen, () => active],
  async ([root, visible, isActive]) => {
    if (!root || !visible || !isActive || loadStarted) return
    loadStarted = true
    try {
      const res = await fetch(src)
      data.value = await res.json()
    } catch {
      loadStarted = false
      return
    }
    await nextTick()
    fitStage()
    render()
    syncPlayback()
  },
  { immediate: true }
)

watch([() => active, onScreen], syncPlayback)

onScopeDispose(() => {
  pauseLoop()
  for (const list of videoEls) for (const ve of list) ve?.removeAttribute('src')
})
</script>

<template>
  <div
    ref="rootRef"
    class="relative size-full overflow-hidden"
    aria-hidden="true"
  >
    <div ref="stageRef" class="vms-stage">
      <!-- Earlier scenes paint on top, matching the source compositing order. -->
      <div
        v-for="(scene, si) in scenes"
        :key="si"
        :ref="(el) => setSceneEl(si, el)"
        class="vms-scene"
        :style="{
          zIndex: scenes.length - si,
          borderRadius: `${scene.maskRadius}px`
        }"
      >
        <!-- Keyed by position: scenes reuse the same clip file for several
        layers, so `video.src` is not unique among siblings. -->
        <video
          v-for="(video, vi) in scene.videos"
          :key="vi"
          :ref="(el) => setVideoEl(si, vi, el)"
          :src="resolveVideoSrc(video.src)"
          muted
          playsinline
          preload="auto"
        />
      </div>
    </div>
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

.vms-scene {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  background: #000;
  will-change: transform, width, height;
}

.vms-scene video {
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

.vms-scene video.is-active {
  display: block;
}
</style>
