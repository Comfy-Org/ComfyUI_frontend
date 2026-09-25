import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'

import { refreshWorkshopCredits } from '../config/workshop-credits'
import { useWorkshopSession } from '../config/workshop-session-state'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'
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
  RESHOOT_FRAMES,
  withKey
} from '../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../lib/workshop/cinematic-studio/reshoot-copy'
import {
  estimatePivot,
  focalPx
} from '../lib/workshop/cinematic-studio/reshoot-engine/camera'
import type { Geometry } from '../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import { readGeometry } from '../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import {
  failureNote,
  quoteNote
} from '../lib/workshop/cinematic-studio/reshoot-engine/notes'
import type { ReshootRunPhase } from '../lib/workshop/cinematic-studio/reshoot-engine/run'
import {
  downloadOutput,
  runJob
} from '../lib/workshop/cinematic-studio/reshoot-engine/run'
import type { ReshootQuote } from '../lib/workshop/cinematic-studio/reshoot-engine/transport'
import { ReshootError } from '../lib/workshop/cinematic-studio/reshoot-engine/transport'
import { reshootTransport } from '../lib/workshop/cinematic-studio/reshoot-engine/transport-config'
import type { ReshootClip } from '../lib/workshop/cinematic-studio/reshoot-engine/workflow'
import {
  analyzeWorkflow,
  generateWorkflow
} from '../lib/workshop/cinematic-studio/reshoot-engine/workflow'
import { useWorkshopAuthFlag } from '../scripts/posthog'

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
  const seed = ref(42)
  const takes = ref<ReshootTake[]>([EXAMPLE_TAKE])
  const selected = ref<string>('example')
  const quote = shallowRef<ReshootQuote>()
  const unavailable = ref(transport === undefined)

  const depth = computed<DepthState>(() => scene.value.phase)
  const rendering = computed(() =>
    takes.value.some((take) => take.status === 'rendering')
  )
  const current = computed(() =>
    takes.value.find((take) => take.id === selected.value)
  )
  const frames = computed(() =>
    scene.value.phase === 'ready' ? scene.value.geometry.frames : RESHOOT_FRAMES
  )

  const gate = computed(() =>
    studioGate({
      runEnabled: !unavailable.value,
      modelRunnable: true,
      mounted: mounted.value,
      authAvailable: authEnabled.value && !sessionFailure.value,
      sessionSettled: settled.value && !(user.value && !session.value),
      role: session.value?.role,
      outOfCredits:
        !rendering.value &&
        quote.value?.blocked_reason === 'insufficient_credits'
    })
  )
  const canGenerate = computed(
    () =>
      gate.value === 'ready' &&
      depth.value === 'ready' &&
      !rendering.value &&
      quote.value?.next_run !== 'blocked'
  )
  const priceNote = computed(() =>
    quote.value ? quoteNote(quote.value, locale) : undefined
  )
  /** Why the viewport cannot show a read scene, if it cannot. */
  const notice = computed(() => {
    if (!picked.value) return undefined
    if (unavailable.value) return rc('reshoot.unavailable', locale)
    if (scene.value.phase === 'failed') return scene.value.note
    if (gate.value === 'signedOut') return rc('reshoot.signIn', locale)
    return undefined
  })
  const stage = computed(() =>
    scene.value.phase === 'analyzing' ? scene.value.stage : undefined
  )

  async function refreshQuote() {
    if (!transport || !session.value) {
      quote.value = undefined
      return
    }
    quote.value = await transport.quote().catch((error: unknown) => {
      if (error instanceof ReshootError && error.code === 'app_unavailable')
        unavailable.value = true
      return undefined
    })
  }

  function noCreditsNote() {
    const key =
      session.value?.role === 'member'
        ? 'workshop.error.memberNoCredits'
        : 'workshop.error.noCreditsCloud'
    return t(key, locale).replace(
      '{workspace}',
      session.value?.workspace.name ?? ''
    )
  }

  function noteFor(error: unknown): string {
    if (error instanceof ReshootError) {
      if (error.code === 'app_unavailable') unavailable.value = true
      if (error.code === 'insufficient_credits') return noCreditsNote()
    }
    return failureNote(error, locale, quote.value?.price_credits)
  }

  const uploads = new WeakMap<File, string>()
  let example: Promise<File> | undefined
  function exampleFile(): Promise<File> {
    example ??= fetch(RESHOOT_EXAMPLE.clip)
      .then((response) => response.blob())
      .then(
        (blob) =>
          new File([blob], RESHOOT_EXAMPLE.name, {
            type: blob.type || 'video/mp4'
          })
      )
    example.catch(() => (example = undefined))
    return example
  }

  let analysis: AbortController | undefined
  async function analyze() {
    analysis?.abort()
    const controller = new AbortController()
    analysis = controller
    selected.value = 'aim'
    if (!transport || unavailable.value || !session.value) {
      scene.value = { phase: 'none' }
      return
    }
    const { signal } = controller
    scene.value = { phase: 'analyzing' }
    try {
      const file = upload.value ?? (await exampleFile())
      const video = uploads.get(file) ?? (await transport.upload(file, signal))
      uploads.set(file, video)
      const settings = { video, aspect: aspect.value, size: size.value }
      const job = await runJob(
        transport,
        analyzeWorkflow(settings),
        (stage) => {
          if (!signal.aborted) scene.value = { phase: 'analyzing', stage }
        },
        signal
      )
      const bytes = await downloadOutput(transport, job, '.cvgeo', signal)
      const geometry = await readGeometry(await bytes.arrayBuffer())
      if (signal.aborted) return
      scene.value = { phase: 'ready', clip: settings, geometry }
      frame.value = Math.min(frame.value, geometry.frames - 1)
      step.value = 2
    } catch (error) {
      if (!signal.aborted)
        scene.value = { phase: 'failed', note: noteFor(error) }
    }
  }

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

  async function generate() {
    const read = scene.value
    if (!canGenerate.value || !transport || read.phase !== 'ready') return
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
          camera,
          keepAim: keepAim.value,
          pivot: estimatePivot(
            geometry.depth[0],
            geometry.width,
            geometry.height,
            focalPx(geometry.width, camera.fov)
          ),
          keys: keys.value,
          motion: motion.value,
          prompt: prompt.value,
          seed: seed.value
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
    gate,
    canGenerate,
    priceNote,
    session,
    pick,
    generate,
    cancel,
    aim,
    addKey,
    removeKey,
    reuse
  }
}
