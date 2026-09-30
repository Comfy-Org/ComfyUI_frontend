import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'

import { refreshWorkshopCredits } from '../config/workshop-credits'
import { useWorkshopSession } from '../config/workshop-session-state'
import type { Locale } from '../i18n/site'
import { t } from '../i18n/site'
import { studioGate } from '../lib/workshop/cinematic-studio/gate'
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
import { clipSecondsOf } from '../lib/workshop/cinematic-studio/reshoot-clip'
import { studioT as rc } from '../lib/workshop/cinematic-studio/copy'
import type {
  Pose,
  Vec3
} from '../lib/workshop/cinematic-studio/reshoot-engine/camera'
import {
  estimatePivot,
  focalPx
} from '../lib/workshop/cinematic-studio/reshoot-engine/camera'
import {
  cameraAt,
  keyIndexAt,
  roundCamera
} from '../lib/workshop/cinematic-studio/reshoot-path'
import type { Geometry } from '../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import { readGeometry } from '../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import type { ReshootRun } from '../lib/workshop/cinematic-studio/reshoot-engine/notes'
import {
  failureNote,
  quoteNote,
  runPrice
} from '../lib/workshop/cinematic-studio/reshoot-engine/notes'
import type { ReshootRunPhase } from '../lib/workshop/cinematic-studio/reshoot-engine/run'
import {
  downloadOutput,
  runJob
} from '../lib/workshop/cinematic-studio/reshoot-engine/run'
import type {
  ReshootQuote,
  ReshootTransport
} from '../lib/workshop/cinematic-studio/reshoot-engine/transport'
import { ReshootError } from '../lib/workshop/cinematic-studio/reshoot-engine/transport'
import { reshootTransport } from '../lib/workshop/cinematic-studio/reshoot-engine/transport-config'
import type { ReshootClip } from '../lib/workshop/cinematic-studio/reshoot-engine/workflow'
import {
  analyzeWorkflow,
  generateSeconds,
  generateWorkflow
} from '../lib/workshop/cinematic-studio/reshoot-engine/workflow'
import { useWorkshopAuthFlag } from '../scripts/posthog'

/** Waits before asking for the price again after a failed quote. */
const QUOTE_RETRY_MS = [5_000, 15_000, 30_000, 60_000]
/** Quote failures that waiting cannot fix: no such app, or signed out. */
const QUOTE_FINAL = new Set(['not_found', 'unauthorized'])

/** Read scenes kept for reuse: the 480p and 768p reads of two clips. */
const MAX_READ_SCENES = 4

/** The node's frame rate, and the longest clip it takes. */
const FPS = 24
const MAX_SECONDS = 15

export type DepthState = 'none' | 'analyzing' | 'ready' | 'failed'

export interface ReshootTake {
  readonly id: string
  readonly n: number
  readonly camera: Readonly<ReshootCamera>
  readonly keys: number
  readonly status: 'rendering' | 'done' | 'cancelled' | 'failed'
  readonly startedAt: number
  readonly phase?: ReshootRunPhase
  readonly url?: string
  readonly warpUrl?: string
  /** The same take with the clip's own sound instead of the generated one. */
  readonly originalUrl?: string
  readonly note?: string
}

/** Reading the scene: the clip's depth, which aiming and generating need. */
type Scene =
  | { readonly phase: 'none' }
  | {
      readonly phase: 'analyzing'
      readonly stage?: ReshootRunPhase
    }
  | {
      readonly phase: 'ready'
      readonly clip: ReshootClip
      readonly geometry: Geometry
    }
  | { readonly phase: 'failed'; readonly note: string }

const EXAMPLE_TAKE: ReshootTake = {
  id: 'example',
  n: 0,
  camera: DEFAULT_CAMERA,
  keys: 0,
  status: 'done',
  startedAt: 0,
  url: RESHOOT_EXAMPLE.result
}

/**
 * The Re-shoot app's state and runs. Picking a clip, or changing its framing,
 * reads its depth again on the deployment (free, but signed in); Generate is
 * the metered run, priced by the app proxy's quote.
 */
export function useReshoot({ locale = 'en' }: { locale?: Locale } = {}) {
  const { user, session, sessionFailure, settled, ensureFresh } =
    useWorkshopSession()
  const authEnabled = useWorkshopAuthFlag()
  const mounted = useMounted()
  const transport = reshootTransport(async () => {
    const credential = await ensureFresh()
    if (credential?.status !== 'ok') throw new ReshootError('unauthorized')
    return credential.session.token
  })

  const upload = shallowRef<File>()
  const uploadUrl = useObjectUrl(upload)
  const clip = computed(() => uploadUrl.value ?? RESHOOT_EXAMPLE.clip)
  const clipName = computed(() => upload.value?.name ?? RESHOOT_EXAMPLE.name)
  const isExample = computed(() => upload.value === undefined)
  const picked = ref(false)

  const aspect = ref<ReshootAspect>('source')
  const size = ref<ReshootSize>('480p')
  const scene = shallowRef<Scene>({ phase: 'none' })
  const step = ref<1 | 2>(1)
  const camera = reactive<ReshootCamera>({ ...DEFAULT_CAMERA })
  const keepAim = ref(true)
  const frame = ref(0)
  const keys = ref<CameraKey[]>([])
  const motion = ref<ReshootMotion>('smooth')
  const prompt = ref('')
  /** A fixed seed, or none: then every take draws its own. */
  const seed = ref<number>()
  const takes = ref<ReshootTake[]>([EXAMPLE_TAKE])
  const selected = ref<string>('example')
  const quote = shallowRef<ReshootQuote>()
  /**
   * The last quote request answered. A metered transport answers with the
   * price, the unmetered dev transport with nothing; one that failed leaves
   * the price unknown, so Generate waits rather than run without showing it.
   */
  const quoteSettled = ref(false)
  const unavailable = ref(transport === undefined)

  const depth = computed<DepthState>(() => scene.value.phase)
  const rendering = computed(() =>
    takes.value.some((take) => take.status === 'rendering')
  )
  const current = computed(() =>
    takes.value.find((take) => take.id === selected.value)
  )
  const geometry = computed(() =>
    scene.value.phase === 'ready' ? scene.value.geometry : undefined
  )

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
  /**
   * The read scene's frames once there is one; before that, as many as H3's
   * 17k + 5 grid fits in the clip at 24 fps, so the timeline has its length.
   */
  const frames = computed(() => {
    if (geometry.value) return geometry.value.frames
    const s = clipSeconds.value
    if (s === undefined || !Number.isFinite(s)) return undefined
    const available = Math.floor(Math.min(s, MAX_SECONDS) * FPS)
    return available - ((available - 5) % 17)
  })
  // Only a chosen clip can be turned away, and only for a length the browser
  // could read, as on Change: an unreadable one (NaN) is left for the node to
  // judge, and the bundled example is known to fit.
  const clipError = computed(() => {
    const s = clipSeconds.value
    return upload.value && s !== undefined && Number.isFinite(s) && !clipFits(s)
      ? rc('reshoot.clipLength', { seconds: s.toFixed(1) }, { locale: locale })
      : undefined
  })

  // The node takes its pivot from frame 0, and so does the page; the pivot
  // found here is the one the generation is told to orbit.
  const pivot = computed<Vec3>(() => {
    const read = geometry.value
    if (!read) return [0, 0, 1.05]
    return estimatePivot(
      read.depth[0],
      read.width,
      read.height,
      focalPx(read.width, camera.fov)
    )
  })

  // --- the camera at the playhead. With no keys `camera` is the one camera;
  // with keys the playhead flies the path, and a pose tried between keys is
  // shown until Key writes it (moving the playhead lets it go).
  const audition = shallowRef<ReshootCamera>()
  watch(frame, () => (audition.value = undefined))
  const path = computed<ReshootCamera>(() =>
    audition.value && keys.value.length
      ? { ...audition.value, fov: camera.fov }
      : cameraAt(keys.value, frame.value, motion.value, camera)
  )
  /** What the globe, sliders and readouts show. */
  const view = computed(() => roundCamera(path.value))
  const onKey = computed(() => keyIndexAt(keys.value, frame.value) >= 0)
  /** The pose the preview draws: the camera at the playhead, around the pivot. */
  const pose = computed<Pose>(() => ({
    az: path.value.azimuth,
    el: path.value.elevation,
    dist: path.value.distance,
    vs: path.value.shift,
    px: pivot.value[0],
    py: pivot.value[1],
    pz: pivot.value[2]
  }))

  const quoteRefusesCredit = computed(
    () =>
      !rendering.value && quote.value?.blocked_reason === 'insufficient_credits'
  )
  const gate = computed(() =>
    studioGate({
      runEnabled: !unavailable.value,
      modelRunnable: true,
      mounted: mounted.value,
      authAvailable: authEnabled.value && !sessionFailure.value,
      sessionSettled: settled.value && !(user.value && !session.value),
      role: session.value?.role,
      credits: quoteRefusesCredit.value ? 0 : undefined
    })
  )
  const canGenerate = computed(
    () =>
      gate.value === 'ready' &&
      depth.value === 'ready' &&
      !clipError.value &&
      !rendering.value &&
      quoteSettled.value &&
      quote.value?.next_run !== 'blocked'
  )
  const run = computed<ReshootRun>(() => ({
    size: size.value,
    seconds:
      scene.value.phase === 'ready'
        ? generateSeconds(scene.value.geometry.frames, scene.value.geometry.fps)
        : undefined
  }))
  /** The last quote request failed, so the price is unknown and Generate waits. */
  const quoteFailed = ref(false)
  const priceNote = computed(() => {
    if (quote.value) return quoteNote(quote.value, locale, run.value)
    return quoteFailed.value
      ? rc('reshoot.quote.failed', {}, { locale: locale })
      : undefined
  })
  /** Why the viewport cannot show a read scene, if it cannot. */
  const notice = computed(() => {
    if (!picked.value) return undefined
    if (unavailable.value)
      return rc('reshoot.unavailable', {}, { locale: locale })
    if (scene.value.phase === 'failed') return scene.value.note
    if (gate.value === 'signedOut')
      return rc('reshoot.signIn', {}, { locale: locale })
    return undefined
  })
  const stage = computed(() =>
    scene.value.phase === 'analyzing' ? scene.value.stage : undefined
  )

  let quoteRequest = 0
  let quoteRetry: ReturnType<typeof setTimeout> | undefined
  let quoteFailures = 0
  function settleQuote(next: ReshootQuote | undefined, settled: boolean) {
    quote.value = next
    quoteSettled.value = settled
    quoteFailed.value = false
    quoteFailures = 0
  }
  /** A failed quote: the price is unknown, so ask again unless waiting cannot help. */
  function quoteFailedWith(error: unknown) {
    const code = error instanceof ReshootError ? error.code : ''
    const final = QUOTE_FINAL.has(code)
    quote.value = undefined
    quoteSettled.value = false
    quoteFailed.value = !final
    if (code === 'app_unavailable') unavailable.value = true
    if (final) return
    const delay =
      QUOTE_RETRY_MS[Math.min(quoteFailures, QUOTE_RETRY_MS.length - 1)]
    quoteFailures += 1
    quoteRetry = setTimeout(() => void refreshQuote(), delay)
  }
  async function refreshQuote() {
    const request = ++quoteRequest
    clearTimeout(quoteRetry)
    if (!transport || !session.value) return settleQuote(undefined, false)
    try {
      const next = await transport.quote()
      if (request !== quoteRequest) return
      settleQuote(next, true)
      unavailable.value = false
    } catch (error) {
      if (request === quoteRequest) quoteFailedWith(error)
    }
  }

  function noCreditsNote() {
    const key =
      session.value?.role === 'member'
        ? 'workshop.error.memberNoCredits'
        : 'workshop.error.noCreditsCloud'
    return t(
      key,
      { workspace: session.value?.workspace.name ?? '' },
      { locale: locale }
    )
  }

  function noteFor(error: unknown): string {
    if (error instanceof ReshootError && error.code === 'insufficient_credits')
      return noCreditsNote()
    return failureNote(
      error,
      locale,
      quote.value ? runPrice(quote.value, run.value) : undefined
    )
  }

  const uploads = new WeakMap<File, string>()
  let example: Promise<File> | undefined
  function exampleFile(): Promise<File> {
    example ??= fetch(RESHOOT_EXAMPLE.clip)
      .then((response) => {
        if (!response.ok)
          throw new Error(`example clip: HTTP ${response.status}`)
        return response.blob()
      })
      .then(
        (blob) =>
          new File([blob], RESHOOT_EXAMPLE.name, {
            type: blob.type || 'video/mp4'
          })
      )
    example.catch(() => (example = undefined))
    return example
  }

  /**
   * Scenes already read, by clip and settings: analyses are rate limited.
   * Each holds depth and frame images, so only the most recent few are kept.
   */
  const reads = new Map<string, Geometry>()
  function remember(key: string, geometry: Geometry) {
    reads.delete(key)
    reads.set(key, geometry)
    for (const oldest of reads.keys()) {
      if (reads.size <= MAX_READ_SCENES) break
      reads.delete(oldest)
    }
  }
  async function readScene(
    via: ReshootTransport,
    clip: ReshootClip,
    signal: AbortSignal
  ) {
    const job = await runJob(
      via,
      analyzeWorkflow(clip),
      (stage) => {
        if (!signal.aborted) scene.value = { phase: 'analyzing', stage }
      },
      signal
    )
    const bytes = await downloadOutput(via, job, '.cvgeo', signal)
    return readGeometry(await bytes.arrayBuffer())
  }

  /** The chosen clip, uploaded once, and its scene, read once per settings. */
  async function clipScene(via: ReshootTransport, signal: AbortSignal) {
    const file = upload.value ?? (await exampleFile())
    const video = uploads.get(file) ?? (await via.upload(file, signal))
    uploads.set(file, video)
    const clip = { video, aspect: aspect.value, size: size.value }
    const key = `${video}|${clip.aspect}|${clip.size}`
    const geometry = reads.get(key) ?? (await readScene(via, clip, signal))
    remember(key, geometry)
    return { clip, geometry }
  }

  let analysis: AbortController | undefined
  async function analyze() {
    analysis?.abort()
    const controller = new AbortController()
    analysis = controller
    selected.value = 'aim'
    // A clip too long for the node is never read: the page says why instead.
    if (!transport || unavailable.value || !session.value || clipError.value) {
      scene.value = { phase: 'none' }
      return
    }
    const { signal } = controller
    scene.value = { phase: 'analyzing' }
    try {
      const read = await clipScene(transport, signal)
      if (signal.aborted) return
      scene.value = { phase: 'ready', ...read }
      // A re-read for a new format keeps the aim and the keys: the clip's
      // length, and so its frames, did not change.
      const last = read.geometry.frames - 1
      keys.value = keys.value.filter((key) => key.frame <= last)
      frame.value = Math.min(frame.value, last)
      step.value = 2
      if (!quoteSettled.value) void refreshQuote()
    } catch (error) {
      if (!signal.aborted)
        scene.value = { phase: 'failed', note: noteFor(error) }
    }
  }

  // The clip's length arrives after the read may have started: a clip that
  // turns out too long retires that read rather than letting it finish.
  watch(clipError, (tooLong) => {
    if (tooLong && depth.value === 'analyzing') void analyze()
  })
  watch([aspect, size], () => {
    if (picked.value) void analyze()
  })
  watch(
    upload,
    () => {
      keys.value = []
      scene.value = { phase: 'none' }
      if (picked.value) void analyze()
    },
    { flush: 'sync' }
  )
  watch(
    () => [session.value?.uid, session.value?.workspace.id],
    () => {
      void refreshQuote()
      if (picked.value && depth.value === 'none') void analyze()
    },
    { immediate: true }
  )

  function pick(file?: File) {
    picked.value = true
    if (upload.value === file) void analyze()
    else upload.value = file
  }

  function updateTake(id: string, patch: Partial<ReshootTake>) {
    takes.value = takes.value.map((take) =>
      take.id === id ? { ...take, ...patch } : take
    )
  }

  const runs = new Map<string, AbortController>()
  const objectUrls: string[] = []
  const objectUrl = (blob?: Blob) => {
    if (!blob) return undefined
    const url = URL.createObjectURL(blob)
    objectUrls.push(url)
    return url
  }

  /**
   * The camera the take is shot with: one key holds there, two or more move
   * from the first. Aiming on a key edits the key, not `camera`, so a keyed
   * shot must start from the keys. The lens is one for the whole clip.
   */
  function stillCamera(): ReshootCamera {
    return { ...(keys.value[0]?.camera ?? camera), fov: camera.fov }
  }

  async function generate() {
    const read = scene.value
    if (!canGenerate.value || !transport || read.phase !== 'ready') return
    const n = takes.value.length
    const id = `take-${n}`
    const still = stillCamera()
    takes.value = [
      ...takes.value,
      {
        id,
        n,
        camera: still,
        keys: keys.value.length,
        status: 'rendering',
        startedAt: Date.now()
      }
    ]
    selected.value = id
    const controller = new AbortController()
    runs.set(id, controller)
    const { signal } = controller
    const { geometry } = read
    try {
      const job = await runJob(
        transport,
        generateWorkflow({
          clip: read.clip,
          seconds: generateSeconds(geometry.frames, geometry.fps),
          camera: still,
          keepAim: keepAim.value,
          pivot: pivot.value,
          keys: keys.value,
          motion: motion.value,
          prompt: prompt.value,
          seed: seed.value ?? Math.floor(Math.random() * 2 ** 32)
        }),
        (phase) => updateTake(id, { phase }),
        signal
      )
      const optional = (part: string) =>
        downloadOutput(transport, job, part, signal).catch(() => undefined)
      const [video, warp, original] = await Promise.all([
        downloadOutput(transport, job, 'result', signal),
        optional('warp'),
        optional('original-audio')
      ])
      if (signal.aborted) return
      updateTake(id, {
        status: 'done',
        url: objectUrl(video),
        warpUrl: objectUrl(warp),
        originalUrl: objectUrl(original)
      })
    } catch (error) {
      if (!signal.aborted)
        updateTake(id, { status: 'failed', note: noteFor(error) })
    } finally {
      runs.delete(id)
      void refreshQuote()
      void refreshWorkshopCredits({ force: true })
    }
  }

  function cancel() {
    runs.forEach((controller) => controller.abort())
    takes.value = takes.value.map((take) =>
      take.status === 'rendering' ? { ...take, status: 'cancelled' } : take
    )
  }

  /**
   * Every way of aiming (globe, drag, wheel, sliders) lands here. On a key it
   * edits that key; between keys it tries a pose that Key writes; with no
   * keys it moves the one camera. The lens is one for the whole clip.
   */
  function aim(patch: Partial<ReshootCamera>) {
    selected.value = 'aim'
    const { fov, ...move } = patch
    if (fov !== undefined) camera.fov = fov
    if (Object.keys(move).length === 0) return
    const at = keyIndexAt(keys.value, frame.value)
    if (at >= 0)
      keys.value = keys.value.map((key, i) =>
        i === at ? { ...key, camera: { ...key.camera, ...move } } : key
      )
    else if (keys.value.length) audition.value = { ...path.value, ...move }
    else Object.assign(camera, move)
  }

  /** Key the pose at the playhead, or take away the key already there. */
  function toggleKey() {
    const at = keyIndexAt(keys.value, frame.value)
    keys.value =
      at >= 0
        ? keys.value.filter((_, i) => i !== at)
        : withKey(keys.value, { frame: frame.value, camera: view.value })
    audition.value = undefined
  }

  function removeKey(at: number) {
    keys.value = keys.value.filter((key) => key.frame !== at)
  }

  function reuse(id: string) {
    const take = takes.value.find((entry) => entry.id === id)
    if (take) aim(take.camera)
  }

  onScopeDispose(() => {
    clearTimeout(quoteRetry)
    quoteRequest += 1
    analysis?.abort()
    runs.forEach((controller) => controller.abort())
    objectUrls.forEach((url) => URL.revokeObjectURL(url))
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
    stage,
    notice,
    frames,
    clipError,
    geometry,
    step,
    camera,
    view,
    pose,
    onKey,
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
    gate,
    canGenerate,
    priceNote,
    session,
    pick,
    analyze,
    generate,
    cancel,
    aim,
    toggleKey,
    removeKey,
    reuse
  }
}
