import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

import { refreshWorkshopCredits } from '@/config/workshop-credits'
import { useWorkshopSession } from '@/config/workshop-session-state'
import { workshopIdempotencyKey } from '@/config/workshop-snippets'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import { studioGate } from '@/lib/workshop/cinematic-studio/gate'
import {
  failureNote,
  quoteNote
} from '@/lib/workshop/cinematic-studio/reshoot-engine/notes'
import type { ReshootRunPhase } from '@/lib/workshop/cinematic-studio/reshoot-engine/run'
import {
  downloadOutput,
  runJob
} from '@/lib/workshop/cinematic-studio/reshoot-engine/run'
import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { ReshootError } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import type { VideoTrim } from '@/components/workshop/video-trim/VideoTrimDialog.vue'
import type { SwapWindow,SwapSize } from '@/lib/workshop/openjutsu/clip'
import {
  resultSize,
  swapCanvas,
  swapSeconds
} from '@/lib/workshop/openjutsu/clip'
import {
  OPENJUTSU_SAMPLE_MODE,
  openjutsuTransport
} from '@/lib/workshop/openjutsu/transport-config'
import { resolveSeed, swapWorkflow } from '@/lib/workshop/openjutsu/workflow'
import { captureWorkshopEvent, useWorkshopAuthFlag } from '@/scripts/posthog'
import type { WorkshopRunAnalytics } from '@/scripts/workshop-analytics'

const OPENJUTSU_APP_SLUG = 'apps/openjutsu'

/** Waits before asking for the price again after a failed quote. */
const QUOTE_RETRY_MS = [5_000, 15_000, 30_000, 60_000]
/** Quote failures that waiting cannot fix: no such app, or signed out. */
const QUOTE_FINAL = new Set(['not_found', 'unauthorized', 'app_unavailable'])
const UNAVAILABLE = new Set(['app_unavailable', 'not_found'])

type SwapPhase = 'uploading' | ReshootRunPhase | 'fetching'

export interface SwapTake {
  readonly id: string
  readonly n: number
  /** Who was replaced, as typed. */
  readonly target: string
  readonly window: SwapWindow
  /** Seconds of result asked for. */
  readonly seconds: number
  readonly size: SwapSize
  readonly seed: number
  readonly status: 'rendering' | 'done' | 'cancelled' | 'failed'
  readonly phase?: SwapPhase
  readonly url?: string
  readonly note?: string
}

/**
 * The Openjutsu app's state and its one metered run: a clip, a character
 * image and who to replace go in, the swapped clip with the source's own
 * sound comes out.
 */
export function useOpenjutsu({ locale = 'en' }: { locale?: Locale } = {}) {
  const { t } = translationsFor(locale)
  const { user, session, sessionFailure, settled, ensureFresh } =
    useWorkshopSession()
  const authEnabled = useWorkshopAuthFlag()
  const mounted = useMounted()
  const transport = openjutsuTransport(async () => {
    const credential = await ensureFresh()
    if (credential?.status !== 'ok') throw new ReshootError('unauthorized')
    return credential.session.token
  })

  // --- the two inputs. A video becomes the one in use only once its part to
  // swap is confirmed in the trim dialog; until then the earlier one stays.
  const video = shallowRef<File>()
  const videoUrl = useObjectUrl(video)
  /** What the trim dialog read of the video in use, with the part chosen. */
  const trim = shallowRef<VideoTrim>()
  /** The file the trim dialog is showing: a new pick, or the one in use. */
  const trimming = shallowRef<File>()
  const trimOpen = ref(false)
  const character = shallowRef<File>()
  const characterUrl = useObjectUrl(character)
  const target = ref('')
  /** A fixed seed, or none: then every take draws its own. */
  const seed = ref<number>()

  const clipSeconds = computed(() => trim.value?.duration)
  const range = computed<SwapWindow | undefined>(
    () =>
      trim.value && {
        start: trim.value.start,
        seconds: trim.value.end - trim.value.start
      }
  )
  /** The seconds a run gives back for the part chosen. */
  const partSeconds = computed(
    () => range.value && swapSeconds(range.value.seconds)
  )
  /** The quality of the next run; a sharper one costs more. */
  const size = ref<SwapSize>('768p')
  const canvas = computed(
    () =>
      trim.value && swapCanvas(trim.value.width, trim.value.height, size.value)
  )
  /** The saved frame: the source's own shape, never a different one. */
  const savedSize = computed(
    () =>
      trim.value &&
      canvas.value &&
      resultSize(trim.value.width, trim.value.height, canvas.value)
  )

  function takeVideo(file: File) {
    trimming.value = file
    trimOpen.value = true
  }
  /** Reopens the trim dialog on the video in use, at the part chosen. */
  function editTrim() {
    if (video.value) takeVideo(video.value)
  }
  function confirmTrim(next: VideoTrim) {
    video.value = trimming.value
    trim.value = next
    selected.value = 'source'
  }
  /** The part to reopen the dialog on: only the video in use has one. */
  const trimInitial = computed(() =>
    trimming.value === video.value && trim.value
      ? { start: trim.value.start, end: trim.value.end }
      : undefined
  )
  function takeCharacter(file: File) {
    character.value = file
  }

  // --- takes
  const takes = ref<SwapTake[]>([])
  /** `source` shows the clip and its trim; anything else is a take's id. */
  const selected = ref('source')
  const current = computed(() =>
    takes.value.find((take) => take.id === selected.value)
  )
  const rendering = computed(() =>
    takes.value.some((take) => take.status === 'rendering')
  )
  function updateTake(id: string, patch: Partial<SwapTake>) {
    takes.value = takes.value.map((take) =>
      take.id === id ? { ...take, ...patch } : take
    )
  }

  // --- what the next run costs, and whether it may start
  const quote = shallowRef<ReshootQuote>()
  const quoteSettled = ref(false)
  const quoteFailed = ref(false)
  const unavailable = ref(transport === undefined)
  let quoteRequest = 0
  let quoteRetry: ReturnType<typeof setTimeout> | undefined
  let quoteFailures = 0

  const signedIn = () => OPENJUTSU_SAMPLE_MODE || !!session.value
  async function refreshQuote() {
    const request = ++quoteRequest
    clearTimeout(quoteRetry)
    if (!transport || !signedIn()) {
      quote.value = undefined
      quoteSettled.value = false
      return
    }
    try {
      const next = await transport.quote()
      if (request !== quoteRequest) return
      quote.value = next
      quoteSettled.value = true
      quoteFailed.value = false
      quoteFailures = 0
      unavailable.value = false
    } catch (error) {
      if (request !== quoteRequest) return
      const code = error instanceof ReshootError ? error.code : ''
      quote.value = undefined
      quoteSettled.value = false
      if (UNAVAILABLE.has(code)) unavailable.value = true
      quoteFailed.value = !QUOTE_FINAL.has(code)
      if (!quoteFailed.value) return
      const delay =
        QUOTE_RETRY_MS[Math.min(quoteFailures, QUOTE_RETRY_MS.length - 1)]
      quoteFailures += 1
      quoteRetry = setTimeout(() => void refreshQuote(), delay)
    }
  }
  watch(
    () => [mounted.value, session.value?.workspace.id] as const,
    ([isMounted]) => {
      if (isMounted) void refreshQuote()
    },
    { immediate: true }
  )

  const quoteRefusesCredit = computed(
    () =>
      !rendering.value && quote.value?.blocked_reason === 'insufficient_credits'
  )
  const gate = computed<StudioGate>(() => {
    if (OPENJUTSU_SAMPLE_MODE && !unavailable.value)
      return !mounted.value
        ? 'pending'
        : quoteRefusesCredit.value
          ? 'noCredits'
          : 'ready'
    return studioGate({
      runEnabled: !unavailable.value,
      modelRunnable: true,
      mounted: mounted.value,
      authAvailable: authEnabled.value && !sessionFailure.value,
      sessionSettled: settled.value && !(user.value && !session.value),
      role: session.value?.role,
      credits: quoteRefusesCredit.value ? 0 : undefined
    })
  })
  /** What is still missing before Generate, in the order the panel asks. */
  const missing = computed(() => {
    if (!video.value || !trim.value) return 'video'
    if (!character.value) return 'character'
    if (!target.value.trim()) return 'target'
    return undefined
  })
  const canGenerate = computed(
    () =>
      gate.value === 'ready' &&
      missing.value === undefined &&
      !rendering.value &&
      quoteSettled.value &&
      quote.value?.next_run !== 'blocked'
  )
  const priceNote = computed(() => {
    if (quote.value)
      return quoteNote(quote.value, locale, {
        size: size.value,
        seconds: partSeconds.value
      })
    return quoteFailed.value ? t('reshoot.quote.failed') : undefined
  })

  function noteFor(error: unknown): string {
    const code = error instanceof ReshootError ? error.code : ''
    if (code === 'insufficient_credits')
      return t(
        session.value?.role === 'member'
          ? 'workshop.error.memberNoCredits'
          : 'workshop.error.noCreditsCloud',
        { workspace: session.value?.workspace.name ?? '' }
      )
    if (UNAVAILABLE.has(code)) return t('openjutsu.unavailable')
    if (code === 'unauthorized') return t('openjutsu.signIn')
    if (code === 'job_failed') return t('openjutsu.error.swap')
    return failureNote(error, locale, quote.value?.price_credits)
  }

  // --- the run
  const uploads = new WeakMap<File, Promise<string>>()
  const runs = new Map<string, AbortController>()
  const objectUrls: string[] = []

  /** Bytes already sent keep their name, so a retake uploads nothing twice. */
  function uploaded(file: File, signal: AbortSignal): Promise<string> {
    if (!transport) return Promise.reject(new ReshootError('app_unavailable'))
    const known = uploads.get(file)
    if (known) return known
    const sending = transport.upload(file, signal)
    uploads.set(file, sending)
    sending.catch(() => uploads.delete(file))
    return sending
  }

  async function generate() {
    const clip = video.value
    const image = character.value
    const shape = canvas.value
    const saved = savedSize.value
    const length = partSeconds.value
    const part = range.value
    if (
      !transport ||
      !canGenerate.value ||
      !clip ||
      !image ||
      !shape ||
      !saved ||
      !length ||
      !part
    )
      return
    // Everything the run uses is read now: edits made while it renders belong
    // to the next take, and a blank seed is drawn once, here.
    const request = {
      target: target.value.trim(),
      window: part,
      seconds: length,
      size: size.value,
      seed: resolveSeed(seed.value)
    }
    const id = crypto.randomUUID()
    const n = takes.value.length + 1
    takes.value = [
      ...takes.value,
      { id, n, ...request, status: 'rendering', phase: 'uploading' }
    ]
    selected.value = id
    const controller = new AbortController()
    runs.set(id, controller)
    const { signal } = controller
    const startedFor = session.value
    const analytics: WorkshopRunAnalytics | undefined = startedFor && {
      model_slug: OPENJUTSU_APP_SLUG,
      page_type: 'app',
      app_slug: OPENJUTSU_APP_SLUG,
      user_id: startedFor.uid,
      workspace_id: startedFor.workspace.id,
      attempt_id: workshopIdempotencyKey()
    }
    const startedAt = Date.now()
    const finish = (
      outcome:
        | { status: 'succeeded'; output_count: number }
        | { status: 'cancelled' }
        | { status: 'failed'; reason: 'provider' | 'client' }
    ) => {
      if (analytics)
        captureWorkshopEvent({
          name: 'run_finished',
          properties: {
            ...analytics,
            duration_ms: Date.now() - startedAt,
            ...outcome
          }
        })
    }
    if (analytics)
      captureWorkshopEvent({ name: 'run_started', properties: analytics })
    try {
      const [videoName, characterName] = await Promise.all([
        uploaded(clip, signal),
        uploaded(image, signal)
      ])
      const job = await runJob(
        transport,
        swapWorkflow({
          video: videoName,
          character: characterName,
          target: request.target,
          start: request.window.start,
          seconds: request.seconds,
          canvas: shape,
          result: saved,
          seed: request.seed
        }),
        (phase) => updateTake(id, { phase }),
        signal
      )
      updateTake(id, { phase: 'fetching' })
      const result = await downloadOutput(transport, job, 'result', signal)
      if (signal.aborted) return finish({ status: 'cancelled' })
      const url = URL.createObjectURL(result)
      objectUrls.push(url)
      updateTake(id, { status: 'done', phase: undefined, url })
      finish({ status: 'succeeded', output_count: 1 })
    } catch (error) {
      if (signal.aborted) return finish({ status: 'cancelled' })
      updateTake(id, {
        status: 'failed',
        phase: undefined,
        note: noteFor(error)
      })
      finish({
        status: 'failed',
        reason: error instanceof ReshootError ? 'provider' : 'client'
      })
    } finally {
      runs.delete(id)
      void refreshQuote()
      if (startedFor) void refreshWorkshopCredits({ force: true })
    }
  }

  function cancel() {
    runs.forEach((controller) => controller.abort())
    takes.value = takes.value.map((take) =>
      take.status === 'rendering'
        ? { ...take, status: 'cancelled', phase: undefined }
        : take
    )
  }

  /** Puts a take's own words and seed back, ready to run again or adjust. */
  function reuse(id: string) {
    const take = takes.value.find((entry) => entry.id === id)
    if (!take) return
    target.value = take.target
    seed.value = take.seed
    selected.value = 'source'
  }

  onScopeDispose(() => {
    clearTimeout(quoteRetry)
    quoteRequest += 1
    runs.forEach((controller) => controller.abort())
    objectUrls.forEach((url) => URL.revokeObjectURL(url))
  })

  return {
    sample: OPENJUTSU_SAMPLE_MODE,
    video,
    videoUrl,
    clipSeconds,
    character,
    characterUrl,
    target,
    seed,
    range,
    partSeconds,
    size,
    savedSize,
    takes,
    selected,
    current,
    rendering,
    gate,
    missing,
    canGenerate,
    priceNote,
    unavailable,
    session,
    trimming,
    trimOpen,
    trimInitial,
    takeVideo,
    editTrim,
    confirmTrim,
    takeCharacter,
    generate,
    cancel,
    reuse
  }
}
