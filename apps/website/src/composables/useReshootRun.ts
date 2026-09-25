import { useObjectUrl } from '@vueuse/core'
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'

import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootMotion,
  ReshootSize
} from '../lib/workshop/cinematic-studio/reshoot'
import {
  DEFAULT_CAMERA,
  RESHOOT_EXAMPLE,
  clipFits,
  withKey
} from '../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../lib/workshop/cinematic-studio/reshoot-copy'
import type {
  Keyframe,
  Pose,
  Vec3
} from '../lib/workshop/cinematic-studio/reshoot-engine/camera'
import {
  estimatePivot,
  focalPx
} from '../lib/workshop/cinematic-studio/reshoot-engine/camera'
import type { Geometry } from '../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import { readGeometry } from '../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import type { Job } from '../lib/workshop/cinematic-studio/reshoot-engine/deployment'
import {
  analyzeWorkflow,
  cancel as cancelJob,
  download,
  generateWorkflow,
  submit,
  uploadVideo,
  waitFor
} from '../lib/workshop/cinematic-studio/reshoot-engine/deployment'
import type { Locale } from '../i18n/translations'

export type DepthState = 'none' | 'analyzing' | 'ready' | 'stale'

export interface ReshootTake {
  readonly id: string
  readonly n: number
  readonly camera: Readonly<ReshootCamera>
  readonly keys: number
  readonly status: 'rendering' | 'done' | 'cancelled' | 'failed'
  readonly startedAt: number
  /** The new view with the model's own sound. */
  readonly url?: string
  /** The same frames with the clip's original sound. */
  readonly originalUrl?: string
  /** The warp guide the model was conditioned on. */
  readonly warpUrl?: string
  /** Where the run stands while it renders, or why it failed. */
  readonly stage?: string
}

const FPS = 24
const MAX_SECONDS = 15
const SIZE_MEGAPIXELS: Record<ReshootSize, number> = {
  '480p': 0.4,
  '768p': 1.0
}

const EXAMPLE_TAKE: ReshootTake = {
  id: 'example',
  n: 0,
  camera: DEFAULT_CAMERA,
  keys: 0,
  status: 'done',
  startedAt: 0,
  url: RESHOOT_EXAMPLE.result
}

function clipSecondsOf(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = video.onerror = () => resolve(video.duration)
    video.src = url
  })
}

/**
 * The Re-shoot app, run for real: the same state as the design mock
 * this page first had, with the depth analysis and every take as jobs on the
 * CrossView deployment. Analysis costs a run, so it waits for its button;
 * the camera is then aimed against a live warp of the clip's own geometry.
 */
export function useReshootRun(locale: Locale = 'en') {
  const upload = shallowRef<File>()
  const uploadUrl = useObjectUrl(upload)
  const clip = computed(() => uploadUrl.value ?? RESHOOT_EXAMPLE.clip)
  const clipName = computed(() => upload.value?.name ?? RESHOOT_EXAMPLE.name)
  const isExample = computed(() => upload.value === undefined)
  const picked = ref(false)

  const aspect = ref<ReshootAspect>('source')
  const size = ref<ReshootSize>('480p')
  const depth = ref<DepthState>('none')
  const step = ref<1 | 2>(1)
  const camera = reactive<ReshootCamera>({ ...DEFAULT_CAMERA })
  const keepAim = ref(true)
  const frame = ref(0)
  const keys = ref<CameraKey[]>([])
  const motion = ref<ReshootMotion>('smooth')
  const prompt = ref('')
  const seed = ref(42)
  const takes = ref<ReshootTake[]>([EXAMPLE_TAKE])
  const selected = ref<string>('example')

  const geometry = shallowRef<Geometry>()
  const status = ref('')
  const error = ref<string>()

  // --- the clip: its length decides the frames and whether it fits at all
  const clipSeconds = ref<number>()
  watch(
    clip,
    async (url) => {
      clipSeconds.value = undefined
      const seconds = await clipSecondsOf(url)
      if (url === clip.value) clipSeconds.value = seconds
    },
    { immediate: true }
  )
  /** As many frames as H3's 17k + 5 grid fits in the clip at 24 fps. */
  const frames = computed(() => {
    const s = clipSeconds.value
    if (s === undefined || !Number.isFinite(s)) return undefined
    const available = Math.floor(Math.min(s, MAX_SECONDS) * FPS)
    return available - ((available - 5) % 17)
  })
  const clipError = computed(() =>
    clipSeconds.value !== undefined && !clipFits(clipSeconds.value)
      ? rc('reshoot.clipLength', locale).replace(
          '{seconds}',
          clipSeconds.value.toFixed(1)
        )
      : undefined
  )

  watch([aspect, size], () => {
    if (depth.value === 'ready') depth.value = 'stale'
  })
  watch(
    upload,
    () => {
      depth.value = 'none'
      geometry.value = undefined
      keys.value = []
      frame.value = 0
      error.value = undefined
    },
    { flush: 'sync' }
  )

  const rendering = computed(() =>
    takes.value.some((take) => take.status === 'rendering')
  )
  const current = computed(() =>
    takes.value.find((take) => take.id === selected.value)
  )

  // The node takes its pivot from frame 0, and so does the page; the pivot
  // found here is the one the generation is told to orbit.
  const pivot = computed<Vec3>(() => {
    const g = geometry.value
    if (!g) return [0, 0, 1.05]
    return estimatePivot(
      g.depth[0],
      g.width,
      g.height,
      focalPx(g.width, camera.fov)
    )
  })

  /** The pose the preview draws: the camera being aimed, around that pivot. */
  const pose = computed<Pose>(() => ({
    az: camera.azimuth,
    el: camera.elevation,
    dist: camera.distance,
    vs: camera.shift,
    px: pivot.value[0],
    py: pivot.value[1],
    pz: pivot.value[2]
  }))

  // --- runs
  const running = new Map<
    string,
    { controller: AbortController; job?: string }
  >()
  onScopeDispose(() => {
    for (const [, run] of running) {
      run.controller.abort()
      if (run.job) void cancelJob(run.job)
    }
  })

  function describe(job: Job, label: string) {
    const s = job.status
    if (s === 'queued' || s === 'pending' || s === 'submitted')
      return job.queue_position
        ? rc('reshoot.stage.queuedAt', locale).replace(
            '{n}',
            String(job.queue_position)
          )
        : rc('reshoot.stage.queued', locale)
    return label
  }

  // Each clip is uploaded once: the example on first use, a chosen file the
  // first time it is analyzed or generated from.
  let exampleAsset: string | undefined
  const uploaded = new WeakMap<File, string>()
  async function assetName(): Promise<string> {
    const file = upload.value
    if (!file) {
      if (!exampleAsset) {
        const blob = await (await fetch(RESHOOT_EXAMPLE.clip)).blob()
        exampleAsset = await uploadVideo(
          new File([blob], RESHOOT_EXAMPLE.name, { type: 'video/mp4' })
        )
      }
      return exampleAsset
    }
    const known = uploaded.get(file)
    if (known) return known
    const name = await uploadVideo(file)
    uploaded.set(file, name)
    return name
  }

  const clipSettings = async () => ({
    video: await assetName(),
    // the node caps this at what the clip holds, so the whole clip is used
    duration: MAX_SECONDS,
    aspect: aspect.value,
    megapixels: SIZE_MEGAPIXELS[size.value]
  })

  async function track(
    key: string,
    workflow: Parameters<typeof submit>[0],
    label: string,
    onStage: (stage: string) => void
  ): Promise<Job> {
    const controller = new AbortController()
    const run: { controller: AbortController; job?: string } = { controller }
    running.set(key, run)
    try {
      run.job = await submit(
        workflow,
        () => onStage(rc('reshoot.stage.starting', locale)),
        controller.signal
      )
      return await waitFor(
        run.job,
        (job) => onStage(describe(job, label)),
        controller.signal
      )
    } finally {
      running.delete(key)
    }
  }

  const failure = (e: unknown) => (e instanceof Error ? e.message : String(e))
  const aborted = (e: unknown) =>
    e instanceof DOMException && e.name === 'AbortError'

  async function analyze() {
    if (clipError.value || depth.value === 'analyzing') return
    const before = depth.value
    error.value = undefined
    depth.value = 'analyzing'
    selected.value = 'aim'
    status.value = rc('reshoot.stage.uploading', locale)
    try {
      const settings = await clipSettings()
      const job = await track(
        'analyze',
        analyzeWorkflow(settings),
        rc('reshoot.analyzing', locale),
        (stage) => (status.value = stage)
      )
      status.value = rc('reshoot.stage.fetching', locale)
      const blob = await download(job, '.cvgeo')
      geometry.value = await readGeometry(await blob.arrayBuffer())
      keys.value = []
      frame.value = 0
      depth.value = 'ready'
      step.value = 2
    } catch (e) {
      depth.value = before === 'ready' ? 'stale' : before
      if (!aborted(e)) error.value = failure(e)
    }
  }

  function prepare() {
    if (depth.value === 'ready') step.value = 2
    else void analyze()
  }

  function pick(file?: File) {
    picked.value = true
    upload.value = file
  }

  function back() {
    step.value = 1
    selected.value = 'aim'
  }

  function updateTake(id: string, patch: Partial<ReshootTake>) {
    takes.value = takes.value.map((take) =>
      take.id === id ? { ...take, ...patch } : take
    )
  }

  /** Her keys hold a camera per 0-based frame; the node wants 1-based poses. */
  function keyframes(): Keyframe[] {
    return keys.value.map((key) => ({
      f: key.frame + 1,
      az: key.camera.azimuth,
      el: key.camera.elevation,
      dist: key.camera.distance,
      vs: key.camera.shift,
      px: pivot.value[0],
      py: pivot.value[1],
      pz: pivot.value[2]
    }))
  }

  async function generate() {
    if (depth.value !== 'ready' || rendering.value) return
    error.value = undefined
    const n = takes.value.length
    const id = `take-${n}`
    takes.value = [
      ...takes.value,
      {
        id,
        n,
        camera: { ...camera },
        keys: keys.value.length,
        status: 'rendering',
        startedAt: Date.now(),
        stage: rc('reshoot.stage.queued', locale)
      }
    ]
    selected.value = id
    try {
      const job = await track(
        id,
        generateWorkflow({
          clip: await clipSettings(),
          camera: {
            azimuth: camera.azimuth,
            elevation: camera.elevation,
            distance: camera.distance,
            hfov: camera.fov,
            verticalShift: camera.shift,
            pivot: pivot.value,
            keepSourceAim: keepAim.value,
            keyframes: keyframes(),
            motion: motion.value
          },
          prompt: prompt.value,
          seed: seed.value
        }),
        // the take's own heading already says it is generating
        '',
        (stage) => updateTake(id, { stage: stage || undefined })
      )
      updateTake(id, { stage: rc('reshoot.stage.fetching', locale) })
      const [result, original, warp] = await Promise.all([
        download(job, 'result'),
        download(job, 'original-audio').catch(() => undefined),
        download(job, 'warp').catch(() => undefined)
      ])
      updateTake(id, {
        status: 'done',
        stage: undefined,
        url: URL.createObjectURL(result),
        originalUrl: original ? URL.createObjectURL(original) : undefined,
        warpUrl: warp ? URL.createObjectURL(warp) : undefined
      })
    } catch (e) {
      if (aborted(e)) updateTake(id, { status: 'cancelled', stage: undefined })
      else updateTake(id, { status: 'failed', stage: failure(e) })
    }
  }

  function cancel() {
    for (const [key, run] of running) {
      if (key === 'analyze') continue
      run.controller.abort()
      if (run.job) void cancelJob(run.job)
    }
  }

  function cancelAnalysis() {
    const run = running.get('analyze')
    if (!run) return
    run.controller.abort()
    if (run.job) void cancelJob(run.job)
  }

  function aim(patch: Partial<ReshootCamera>) {
    Object.assign(camera, patch)
    selected.value = 'aim'
  }

  function addKey() {
    keys.value = withKey(keys.value, {
      frame: frame.value,
      camera: { ...camera }
    })
  }

  function removeKey(at: number) {
    keys.value = keys.value.filter((key) => key.frame !== at)
  }

  function reuse(id: string) {
    const take = takes.value.find((entry) => entry.id === id)
    if (take) aim(take.camera)
  }

  onScopeDispose(() => {
    for (const take of takes.value) {
      for (const url of [take.url, take.originalUrl, take.warpUrl])
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  })

  return {
    upload,
    clip,
    clipName,
    isExample,
    picked,
    aspect,
    size,
    depth,
    step,
    camera,
    keepAim,
    frame,
    keys,
    motion,
    prompt,
    seed,
    takes,
    selected,
    current,
    rendering,
    frames,
    clipError,
    geometry,
    pose,
    status,
    error,
    prepare,
    analyze,
    cancelAnalysis,
    pick,
    back,
    generate,
    cancel,
    aim,
    addKey,
    removeKey,
    reuse
  }
}
