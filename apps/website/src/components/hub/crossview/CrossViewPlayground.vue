<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
  watch
} from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FileValue } from '../../../config/workshop-playground'
import Button from '../../ui/button/Button.vue'
import FileSourceInput from '../../workshop/FileSourceInput.vue'
import type { Keyframe, Motion, Pose, Vec3 } from './camera'
import { estimatePivot, focalPx, samplePath } from './camera'
import { copy } from './copy'
import type { Geometry } from './cvgeo'
import { readGeometry } from './cvgeo'
import CrossViewPreview from './CrossViewPreview.vue'
import type { Job } from './deployment'
import {
  analyzeWorkflow,
  cancel as cancelJob,
  download,
  generateWorkflow,
  submit,
  uploadVideo,
  waitFor
} from './deployment'

// CrossView Warp as a page: analyze a clip once on the deployment, aim a new
// camera here against a live warp, then generate. Everything it needs lives
// in this folder; the only backend it knows is the dev proxy in deployment.ts.

type Phase = 'idle' | 'analyzing' | 'aiming' | 'generating' | 'done'

const phase = ref<Phase>('idle')
const status = ref('')
const error = ref<string>()

// --- the clip
/**
 * The page opens on a worked example: this clip is selected, and its result
 * fills the output until a run of the visitor's own replaces it.
 */
const EXAMPLE_MEDIA = 'https://media.comfy.org/website/workshop/crossview'
const EXAMPLE: FileValue = {
  name: 'input_crossviewwarp-1.mp4',
  size: 6332464,
  type: 'video/mp4',
  sourceUrl: `${EXAMPLE_MEDIA}/example-input.mp4`,
  previewUrl: `${EXAMPLE_MEDIA}/example-input.mp4`
}
const EXAMPLE_RESULT = `${EXAMPLE_MEDIA}/example-result.mp4`
const file = ref<FileValue | undefined>(EXAMPLE)
const isExample = computed(() => file.value?.sourceUrl === EXAMPLE.sourceUrl)
const aspect = ref('source')
const megapixels = ref(0.4)
const clipSeconds = ref<number>()
const uploaded = new Map<File, string>()

const videoField = {
  kind: 'file' as const,
  name: 'crossview-video',
  label: copy.video,
  accept: ['video/*'],
  maxBytes: 100 * 1024 * 1024,
  required: true
}

// The clip has to hold the whole run: at least MIN_SECONDS, and past
// MAX_SECONDS the depth file and the generation both grow past a demo's wait.
const MIN_SECONDS = 5
const MAX_SECONDS = 15

const clipError = computed(() => {
  const s = clipSeconds.value
  if (s === undefined || (s >= MIN_SECONDS && s <= MAX_SECONDS))
    return undefined
  return copy.clipLength(s)
})

/**
 * The run always takes the whole clip: the largest count on H3's 17k + 5
 * grid that the clip holds at 24 fps, as CrossViewPrepareClip cuts it.
 */
const frames = computed(() => {
  const s = clipSeconds.value
  if (s === undefined) return undefined
  const available = Math.floor(Math.min(s, MAX_SECONDS) * 24)
  return available - ((available - 5) % 17)
})

// One playable URL for the chosen clip, whichever way it was chosen.
const sourceUrl = ref<string>()
watch(
  file,
  (value) => {
    if (sourceUrl.value?.startsWith('blob:'))
      URL.revokeObjectURL(sourceUrl.value)
    sourceUrl.value = value?.file
      ? URL.createObjectURL(value.file)
      : (value?.sourceUrl ?? value?.previewUrl)
  },
  { immediate: true }
)

// How long the clip runs, which decides how many frames the run takes.
watch(
  sourceUrl,
  async (url) => {
    clipSeconds.value = undefined
    if (!url) return
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url
    await new Promise((resolve) => (video.onloadedmetadata = resolve))
    clipSeconds.value = video.duration
  },
  { immediate: true }
)

async function fileOf(value: FileValue): Promise<File> {
  if (value.file) return value.file
  const blob = await (await fetch(value.sourceUrl ?? value.previewUrl!)).blob()
  return new File([blob], value.name, { type: value.type || blob.type })
}

// --- the camera
const camera = reactive({
  azimuth: -30,
  elevation: 15,
  distance: 1,
  hfov: 50,
  verticalShift: 0,
  keepSourceAim: true
})
const motion = ref<Motion>('linear')
const keyframes = ref<Keyframe[]>([])
const frame = ref(1)
const geometry = shallowRef<Geometry>()
/** A pose tried between keyframes: shown, not written until Key. */
const audition = ref<Pose>()

// The node picks its pivot from frame 0; so does the page, and the pivot it
// finds is the one the generation is told to use.
const pivot = computed<Vec3>(() => {
  const g = geometry.value
  if (!g) return [0, 0, 1.05]
  return estimatePivot(
    g.depth[0],
    g.width,
    g.height,
    focalPx(g.width, camera.hfov)
  )
})

const staticPose = computed<Pose>(() => ({
  az: camera.azimuth,
  el: camera.elevation,
  dist: camera.distance,
  vs: camera.verticalShift,
  px: pivot.value[0],
  py: pivot.value[1],
  pz: pivot.value[2]
}))

const pose = computed<Pose>(() => {
  if (audition.value) return audition.value
  if (keyframes.value.length >= 2)
    return samplePath(keyframes.value, frame.value, motion.value)
  return keyframes.value[0] ?? staticPose.value
})

watch(frame, () => (audition.value = undefined))

/**
 * Every way of moving the camera (drag, wheel, sliders) lands here. On a
 * keyframe it edits that keyframe; between keyframes it auditions a pose
 * that Key commits; with no keyframes it is the one static camera.
 */
function setPose(patch: Partial<Pose>) {
  const key = keyframes.value.findIndex((k) => k.f === frame.value)
  if (key >= 0) {
    keyframes.value[key] = { ...keyframes.value[key], ...patch }
  } else if (keyframes.value.length >= 1) {
    audition.value = { ...pose.value, ...patch }
  } else {
    if (patch.az !== undefined) camera.azimuth = patch.az
    if (patch.el !== undefined) camera.elevation = patch.el
    if (patch.dist !== undefined) camera.distance = patch.dist
    if (patch.vs !== undefined) camera.verticalShift = patch.vs
  }
}

const onOrbit = (az: number, el: number) => setPose({ az, el })

function onDolly(step: number) {
  setPose({
    dist: Math.min(3, Math.max(0.1, +(pose.value.dist + step).toFixed(2)))
  })
}

function onKey() {
  const at = keyframes.value.findIndex((k) => k.f === frame.value)
  if (at >= 0) keyframes.value.splice(at, 1)
  // the pose may itself be a keyframe; the playhead decides the new one's frame
  else
    keyframes.value = [
      ...keyframes.value,
      { ...pose.value, f: frame.value }
    ].sort((a, b) => a.f - b.f)
  audition.value = undefined
}

/** The pose at the playhead, rounded for the sliders and the readout. */
const wrapDeg = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
const shown = computed(() => ({
  az: Math.round(wrapDeg(pose.value.az)),
  el: Math.round(pose.value.el),
  dist: pose.value.dist,
  vs: pose.value.vs
}))

// --- runs
const prompt = ref('')
const seed = ref(42)
let controller: AbortController | undefined
let jobId: string | undefined
/**
 * Every generation of this session, newest last. Held as object URLs in
 * memory only: nothing is stored, and a reload starts over.
 */
interface Take {
  readonly video: string
  readonly warp?: string
  /** The same take muxed with the source clip's audio instead of H3's. */
  readonly original?: string
  readonly label: string
}
const takes = ref<Take[]>([])
const current = ref(0)
const result = computed<Take | undefined>(() => takes.value[current.value])
const showing = ref<'result' | 'warp' | 'source'>('result')
const sound = ref<'generated' | 'original'>('generated')
/** The result as it is being watched and downloaded, with the chosen sound. */
const resultUrl = computed(() =>
  sound.value === 'original' && result.value?.original
    ? result.value.original
    : result.value?.video
)
let assetName: string | undefined

function describe(job: Job, label: string) {
  const s = job.status
  if (s === 'queued' || s === 'pending' || s === 'submitted') {
    if (waitedLong) return copy.stages.starting
    return job.queue_position
      ? copy.stages.queuedAt(job.queue_position)
      : copy.stages.queued
  }
  const p = job.progress
  const pct = p?.max ? ` · ${Math.round(((p.value ?? 0) / p.max) * 100)}%` : ''
  return `${label}${pct}`
}

let waitedLong = false
let longTimer: number | undefined

// Seconds since the current run started, for the overlay's clock.
const startedAt = ref(0)
const now = ref(Date.now())
let clock: number | undefined
const elapsed = computed(() => {
  const s = Math.max(0, Math.round((now.value - startedAt.value) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

async function track(workflow: object, label: string): Promise<Job> {
  controller = new AbortController()
  waitedLong = false
  startedAt.value = now.value = Date.now()
  window.clearInterval(clock)
  clock = window.setInterval(() => (now.value = Date.now()), 1000)
  window.clearTimeout(longTimer)
  longTimer = window.setTimeout(() => (waitedLong = true), 20000)
  jobId = await submit(
    workflow as Parameters<typeof submit>[0],
    () => (status.value = copy.stages.starting),
    controller.signal
  )
  try {
    return await waitFor(
      jobId,
      (job) => (status.value = describe(job, label)),
      controller.signal
    )
  } finally {
    window.clearTimeout(longTimer)
    window.clearInterval(clock)
    jobId = undefined
  }
}

const clip = () => ({
  video: assetName!,
  // the node caps this at what the clip holds, so the whole clip is used
  duration: MAX_SECONDS,
  aspect: aspect.value,
  megapixels: megapixels.value
})

async function analyze() {
  if (!file.value || clipError.value) return
  error.value = undefined
  stale.value = false
  startedAt.value = now.value = Date.now()
  window.clearInterval(clock)
  clock = window.setInterval(() => (now.value = Date.now()), 1000)
  phase.value = 'analyzing'
  try {
    const source = await fileOf(file.value)
    status.value = copy.stages.uploading
    assetName = uploaded.get(source) ?? (await uploadVideo(source))
    uploaded.set(source, assetName)
    const job = await track(analyzeWorkflow(clip()), copy.analyzing)
    status.value = copy.stages.downloading
    const blob = await download(job, '.cvgeo')
    geometry.value = await readGeometry(await blob.arrayBuffer())
    keyframes.value = []
    frame.value = 1
    phase.value = 'aiming'
  } catch (e) {
    fail(e, 'idle')
  }
}

async function generate() {
  if (!geometry.value || !assetName) return
  error.value = undefined
  status.value = copy.stages.queued
  phase.value = 'generating'
  const moving = keyframes.value.length >= 2
  const label = moving
    ? copy.takeMove(takes.value.length + 1, keyframes.value.length)
    : copy.takeStatic(takes.value.length + 1, shown.value.az, shown.value.el)
  try {
    const job = await track(
      generateWorkflow({
        clip: clip(),
        camera: {
          ...camera,
          pivot: pivot.value,
          keyframes: keyframes.value,
          motion: motion.value
        },
        prompt: prompt.value,
        seed: seed.value
      }),
      copy.stages.running
    )
    status.value = copy.stages.downloading
    const [video, warp, original] = await Promise.all([
      download(job, 'result'),
      download(job, 'warp').catch(() => undefined),
      download(job, 'original-audio').catch(() => undefined)
    ])
    takes.value = [
      ...takes.value,
      {
        video: URL.createObjectURL(video),
        warp: warp ? URL.createObjectURL(warp) : undefined,
        original: original ? URL.createObjectURL(original) : undefined,
        label
      }
    ]
    current.value = takes.value.length - 1
    showing.value = 'result'
    phase.value = 'done'
  } catch (e) {
    fail(e, 'aiming')
  }
}

function fail(e: unknown, back: Phase) {
  if (e instanceof DOMException && e.name === 'AbortError') {
    phase.value = back
    return
  }
  error.value = e instanceof Error ? e.message : String(e)
  phase.value = back
}

async function stop() {
  controller?.abort()
  if (jobId) await cancelJob(jobId)
}

function revoke() {
  for (const take of takes.value) {
    URL.revokeObjectURL(take.video)
    if (take.warp) URL.revokeObjectURL(take.warp)
    if (take.original) URL.revokeObjectURL(take.original)
  }
  takes.value = []
  current.value = 0
}

// Changing the clip invalidates everything aimed at the old one.
// Duration, aspect and size all change the frames themselves, so the depth
// no longer lines up and has to be estimated again. Nothing is kept between
// analyses: a real backend could cache depth per clip and settings.
const stale = ref(false)
watch([file, aspect, megapixels], () => {
  if (phase.value === 'aiming' || phase.value === 'done') {
    geometry.value = undefined
    phase.value = 'idle'
    stale.value = file.value !== undefined
  }
  if (file.value === undefined) assetName = undefined
})

// Takes belong to one clip; a new clip starts a new set.
watch(file, revoke)

onBeforeUnmount(() => {
  void stop()
  window.clearInterval(clock)
  revoke()
})

const busy = computed(
  () => phase.value === 'analyzing' || phase.value === 'generating'
)
const aimed = computed(() => !!geometry.value)

const labelClass =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const helpClass = 'text-xs text-primary-warm-gray'
const inputClass =
  'h-11 w-full rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 px-4 text-sm text-primary-warm-white outline-none focus-visible:border-primary-comfy-yellow disabled:opacity-50'
</script>

<template>
  <section
    class="grid gap-8 lg:grid-cols-12"
    data-testid="crossview-playground"
  >
    <div
      class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-5"
    >
      <header
        class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ copy.input }}
      </header>

      <div class="flex flex-col gap-8 p-5">
        <div class="flex flex-col gap-2">
          <span :class="labelClass">{{ copy.video }}</span>
          <p :class="helpClass">{{ copy.videoHelp }}</p>
          <FileSourceInput
            v-model="file"
            :field="videoField"
            :disabled="busy"
          />
          <p
            v-if="clipError"
            role="alert"
            class="text-xs text-primary-comfy-red"
            data-testid="crossview-clip-error"
          >
            {{ clipError }}
          </p>
          <p
            v-else-if="frames"
            :class="helpClass"
            data-testid="crossview-frames"
          >
            {{ copy.wholeClip(frames) }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <label for="crossview-aspect" :class="labelClass">{{
            copy.aspect
          }}</label>
          <select
            id="crossview-aspect"
            v-model="aspect"
            :disabled="busy"
            :class="inputClass"
            data-testid="crossview-aspect"
          >
            <option v-for="(label, value) in copy.aspects" :key="value" :value>
              {{ label }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <span :class="labelClass">{{ copy.size }}</span>
          <div class="flex gap-2" role="radiogroup" :aria-label="copy.size">
            <button
              v-for="option in copy.sizes"
              :key="option.mp"
              type="button"
              role="radio"
              :aria-checked="megapixels === option.mp"
              :disabled="busy"
              :class="
                cn(
                  'flex flex-1 flex-col items-start rounded-2xl border px-4 py-2 text-left disabled:opacity-50',
                  megapixels === option.mp
                    ? 'border-primary-comfy-yellow'
                    : 'border-transparency-white-t20 hover:border-transparency-white-t40'
                )
              "
              :data-testid="`crossview-mp-${option.mp}`"
              @click="megapixels = option.mp"
            >
              <span class="text-sm font-bold text-primary-warm-white">{{
                option.label
              }}</span>
              <span :class="helpClass">{{ option.help }}</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label for="crossview-prompt" :class="labelClass">{{
              copy.prompt
            }}</label>
            <span
              class="rounded-full border border-transparency-white-t20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary-warm-gray uppercase"
              >{{ copy.optional }}</span
            >
          </div>
          <p :class="helpClass">{{ copy.promptHelp }}</p>
          <p :class="helpClass" data-testid="crossview-prompt-dialogue">
            {{ copy.promptDialogue }}
          </p>
          <textarea
            id="crossview-prompt"
            v-model="prompt"
            rows="2"
            :placeholder="copy.promptPlaceholder"
            :disabled="busy"
            :class="cn(inputClass, 'h-auto resize-y py-3')"
            data-testid="crossview-prompt"
          />
        </div>

        <template v-if="aimed">
          <label class="flex flex-col gap-2">
            <span :class="labelClass">{{ copy.seed }}</span>
            <input
              v-model.number="seed"
              type="number"
              min="0"
              :disabled="busy"
              :class="inputClass"
            />
          </label>
        </template>
      </div>

      <div
        class="mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 p-3"
      >
        <p :class="cn(helpClass, 'px-1')">
          {{ aimed ? copy.demoNote : copy.analyzeHelp }}
        </p>
        <Button
          :variant="aimed ? 'outline' : undefined"
          size="lg"
          class="w-full"
          :disabled="!file || busy || !!clipError"
          data-testid="crossview-analyze"
          @click="analyze"
        >
          {{ aimed ? copy.reanalyze : copy.analyze }}
        </Button>
        <Button
          v-if="aimed"
          size="lg"
          class="w-full"
          :disabled="busy"
          data-testid="crossview-generate"
          @click="generate"
        >
          {{ copy.generate }}
        </Button>
        <Button
          v-if="busy"
          variant="outline"
          size="sm"
          class="w-full"
          @click="stop"
        >
          {{ copy.cancel }}
        </Button>
      </div>
    </div>

    <div
      class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-7"
    >
      <header
        class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ copy.output }}
      </header>

      <div
        class="flex flex-1 flex-col gap-4 p-5"
        data-testid="crossview-output"
      >
        <p
          v-if="error"
          role="alert"
          class="rounded-xl border border-primary-comfy-red/40 px-4 py-3 text-sm text-primary-warm-white"
        >
          <strong>{{ copy.failed }}.</strong> {{ error }}
        </p>

        <template v-if="phase === 'done' && result">
          <div
            v-if="takes.length > 1"
            class="flex flex-wrap gap-2"
            data-testid="crossview-takes"
          >
            <button
              v-for="(take, i) in takes"
              :key="take.video"
              type="button"
              :aria-pressed="current === i"
              :class="
                cn(
                  'rounded-full border px-3 py-1 text-xs',
                  current === i
                    ? 'border-primary-comfy-yellow text-primary-warm-white'
                    : 'border-transparency-white-t20 text-primary-warm-gray hover:text-primary-warm-white'
                )
              "
              @click="current = i"
            >
              {{ take.label }}
            </button>
          </div>
          <div class="flex gap-2" role="tablist">
            <button
              v-for="view in ['result', 'warp', 'source'] as const"
              v-show="view !== 'warp' || result.warp"
              :key="view"
              type="button"
              role="tab"
              :aria-selected="showing === view"
              :class="
                cn(
                  'rounded-full border px-3 py-1 text-xs font-bold',
                  showing === view
                    ? 'border-primary-comfy-yellow text-primary-warm-white'
                    : 'border-transparency-white-t20 text-primary-warm-gray'
                )
              "
              @click="showing = view"
            >
              {{ copy[view] }}
            </button>
          </div>
          <div
            v-if="showing === 'result' && result.original"
            class="flex items-center gap-2 text-xs text-primary-warm-gray"
            role="radiogroup"
            :aria-label="copy.sound"
            data-testid="crossview-sound"
          >
            <span>{{ copy.sound }}</span>
            <button
              v-for="option in ['generated', 'original'] as const"
              :key="option"
              type="button"
              role="radio"
              :aria-checked="sound === option"
              :class="
                cn(
                  'rounded-full border px-3 py-1 font-bold',
                  sound === option
                    ? 'border-primary-comfy-yellow text-primary-warm-white'
                    : 'border-transparency-white-t20 hover:text-primary-warm-white'
                )
              "
              @click="sound = option"
            >
              {{ copy.sounds[option] }}
            </button>
          </div>
          <video
            :key="`${current}-${showing}-${sound}`"
            :src="
              showing === 'result'
                ? resultUrl
                : showing === 'warp'
                  ? result.warp
                  : sourceUrl
            "
            controls
            autoplay
            loop
            playsinline
            class="w-full rounded-xl bg-black"
            data-testid="crossview-result"
          />
          <div class="flex gap-2">
            <Button variant="outline" size="sm" @click="phase = 'aiming'">{{
              copy.again
            }}</Button>
            <Button
              as="a"
              variant="outline"
              size="sm"
              :href="resultUrl"
              :download="`crossview-take-${current + 1}${sound === 'original' && result.original ? '-original-audio' : ''}.mp4`"
            >
              {{ copy.download }}
            </Button>
          </div>
        </template>

        <template v-else-if="geometry">
          <CrossViewPreview
            v-model:frame="frame"
            :geometry
            :pose
            :hfov="camera.hfov"
            :keep-source-aim="camera.keepSourceAim"
            :keyframes
            :disabled="busy"
            @orbit="onOrbit"
            @dolly="onDolly"
            @key="onKey"
          >
            <div
              v-if="phase === 'generating'"
              class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center backdrop-blur-sm"
              role="status"
              aria-live="polite"
              data-testid="crossview-generating"
            >
              <span
                class="size-8 animate-spin rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow"
                aria-hidden="true"
              />
              <p class="text-base font-bold text-primary-warm-white">
                {{ copy.generatingTitle }}
              </p>
              <p
                class="text-sm text-primary-warm-white tabular-nums"
                data-testid="crossview-status"
              >
                {{ status }} · {{ elapsed }}
              </p>
              <p class="max-w-sm text-xs text-primary-warm-gray">
                {{ copy.generatingHelp }}
              </p>
              <Button
                variant="outline"
                size="sm"
                class="pointer-events-auto"
                @click="stop"
              >
                {{ copy.cancel }}
              </Button>
            </div>
          </CrossViewPreview>

          <!-- The camera sits with the picture it moves, so aiming never
            scrolls the preview out of view. -->
          <div
            class="flex flex-col gap-5 rounded-xl border border-transparency-white-t8 p-4"
            data-testid="crossview-camera"
          >
            <div class="flex flex-col gap-0.5">
              <span :class="labelClass">{{ copy.camera }}</span>
              <p :class="helpClass">{{ copy.cameraHelp }}</p>
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              <label
                v-for="axis in ['azimuth', 'elevation'] as const"
                :key="axis"
                class="flex flex-col gap-1"
              >
                <span :class="helpClass"
                  >{{ copy[axis] }} ·
                  {{ shown[axis === 'azimuth' ? 'az' : 'el'] }}°</span
                >
                <input
                  :value="shown[axis === 'azimuth' ? 'az' : 'el']"
                  type="range"
                  :min="axis === 'azimuth' ? -90 : -45"
                  :max="axis === 'azimuth' ? 90 : 45"
                  step="1"
                  :disabled="busy"
                  class="accent-primary-comfy-yellow"
                  :data-testid="`crossview-${axis}`"
                  @input="
                    setPose({
                      [axis === 'azimuth' ? 'az' : 'el']: Number(
                        ($event.target as HTMLInputElement).value
                      )
                    })
                  "
                />
              </label>
              <label class="flex flex-col gap-1" :title="copy.distanceHelp">
                <span :class="helpClass"
                  >{{ copy.distance }} · {{ shown.dist.toFixed(2) }}</span
                >
                <input
                  :value="shown.dist"
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.05"
                  :disabled="busy"
                  class="accent-primary-comfy-yellow"
                  data-testid="crossview-distance"
                  @input="
                    setPose({
                      dist: Number(($event.target as HTMLInputElement).value)
                    })
                  "
                />
              </label>
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              <label class="flex flex-col gap-1">
                <span :class="helpClass"
                  >{{ copy.lens }} · {{ camera.hfov }}°</span
                >
                <input
                  v-model.number="camera.hfov"
                  type="range"
                  min="20"
                  max="120"
                  step="1"
                  :disabled="busy"
                  class="accent-primary-comfy-yellow"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span :class="helpClass"
                  >{{ copy.shift }} · {{ shown.vs.toFixed(2) }}</span
                >
                <input
                  :value="shown.vs"
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.02"
                  :disabled="busy"
                  class="accent-primary-comfy-yellow"
                  @input="
                    setPose({
                      vs: Number(($event.target as HTMLInputElement).value)
                    })
                  "
                />
              </label>
              <label class="flex items-start gap-2" :title="copy.keepAimHelp">
                <input
                  v-model="camera.keepSourceAim"
                  type="checkbox"
                  :disabled="busy"
                  class="mt-0.5 accent-primary-comfy-yellow"
                />
                <span class="text-xs text-primary-warm-white">{{
                  copy.keepAim
                }}</span>
              </label>
            </div>
            <div
              class="flex flex-col gap-3 border-t border-transparency-white-t8 pt-4"
            >
              <div class="flex flex-col gap-0.5">
                <span :class="labelClass">{{ copy.move }}</span>
                <p :class="helpClass">{{ copy.moveHelp }}</p>
              </div>
              <div class="flex items-center gap-3">
                <select
                  v-model="motion"
                  :aria-label="copy.motion"
                  :disabled="busy || keyframes.length < 2"
                  :class="inputClass"
                >
                  <option
                    v-for="(label, value) in copy.motions"
                    :key="value"
                    :value
                  >
                    {{ label }}
                  </option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy || keyframes.length === 0"
                  data-testid="crossview-clear-keys"
                  @click="keyframes = []"
                >
                  {{ copy.clearKeys }}
                </Button>
              </div>
            </div>
          </div>
          <Button
            v-if="phase === 'aiming' && result"
            variant="outline"
            size="sm"
            class="self-start"
            data-testid="crossview-view-result"
            @click="phase = 'done'"
          >
            {{ copy.viewResult }} · {{ result.label }}
          </Button>
        </template>

        <template v-else>
          <div
            v-if="sourceUrl || phase === 'analyzing'"
            class="relative overflow-hidden rounded-xl bg-black"
          >
            <video
              v-if="sourceUrl"
              :src="sourceUrl"
              muted
              loop
              autoplay
              playsinline
              class="w-full"
            />
            <div v-else class="aspect-video" />
            <div
              v-if="phase === 'analyzing'"
              class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center backdrop-blur-sm"
              role="status"
              aria-live="polite"
              data-testid="crossview-analyzing"
            >
              <span
                class="size-8 animate-spin rounded-full border-2 border-transparency-white-t20 border-t-primary-comfy-yellow"
                aria-hidden="true"
              />
              <p class="text-base font-bold text-primary-warm-white">
                {{ copy.analyzingTitle }}
              </p>
              <p
                class="text-sm text-primary-warm-white tabular-nums"
                data-testid="crossview-status"
              >
                {{ status }} · {{ elapsed }}
              </p>
              <p class="max-w-sm text-xs text-primary-warm-gray">
                {{ copy.analyzingHelp }}
              </p>
              <Button variant="outline" size="sm" @click="stop">
                {{ copy.cancel }}
              </Button>
            </div>
          </div>
          <div
            v-if="isExample && phase === 'idle' && !stale"
            class="flex flex-col gap-2"
            data-testid="crossview-example"
          >
            <span :class="labelClass">{{ copy.exampleResult }}</span>
            <video
              :src="EXAMPLE_RESULT"
              muted
              loop
              autoplay
              playsinline
              controls
              class="w-full rounded-xl bg-black"
            />
            <p :class="helpClass">{{ copy.exampleHelp }}</p>
          </div>
          <p
            v-if="phase !== 'analyzing'"
            class="text-sm text-primary-warm-gray"
            data-testid="crossview-status"
          >
            {{ stale ? copy.stale : copy.empty }}
          </p>
        </template>
      </div>
    </div>
  </section>
</template>
