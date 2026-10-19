import { useMounted, useObjectUrl } from '@vueuse/core'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

import type { VideoTrim } from '@/components/workshop/video-trim/VideoTrimDialog.vue'
import { refreshWorkshopCredits } from '@/config/workshop-credits'
import { useWorkshopSession } from '@/config/workshop-session-state'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { ReshootError } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import type { SwapSize, SwapWindow } from '@/lib/workshop/openjutsu/clip'
import {
  SWAP_SIZES,
  SWAP_TRIM_LIMITS,
  resultSize,
  swapCanvas,
  swapSeconds
} from '@/lib/workshop/openjutsu/clip'
import type { SwapExample } from '@/lib/workshop/openjutsu/examples'
import { priceReadable, swapPriceNote } from '@/lib/workshop/openjutsu/price'
import type { SwapOutcome } from '@/lib/workshop/openjutsu/run-report'
import { swapRunReport } from '@/lib/workshop/openjutsu/run-report'
import type { SwapJob } from '@/lib/workshop/openjutsu/run-swap'
import { routerAnchor } from '@/lib/workshop/openjutsu/anchor'
import { runSwap, uploadOnce } from '@/lib/workshop/openjutsu/run-swap'
import {
  canSwap,
  missingInput,
  quoteFailure,
  quoteRefusesCredit,
  swapFailureNote,
  swapFailureReason,
  swapGate
} from '@/lib/workshop/openjutsu/swap-rules'
import {
  OPENJUTSU_NO_ACCOUNT,
  OPENJUTSU_SAMPLE_MODE,
  openjutsuTransport
} from '@/lib/workshop/openjutsu/transport-config'
import type { SwapTake } from '@/lib/workshop/openjutsu/take'
import { resolveSeed } from '@/lib/workshop/openjutsu/workflow'
import { readVideoFacts } from '@/lib/workshop/video-trim/filmstrip'
import {
  initialTrim,
  longerThanLimit,
  tooShortToTrim
} from '@/lib/workshop/video-trim/range'
import { useWorkshopAuthFlag } from '@/scripts/posthog'

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
  async function sessionToken() {
    const credential = await ensureFresh()
    if (credential?.status !== 'ok') throw new ReshootError('unauthorized')
    return credential.session.token
  }
  const transport = openjutsuTransport(sessionToken)

  // --- the two inputs. A video that fits a run is used as soon as it is
  // read; any other waits in the trim dialog while the earlier one stays.
  const video = shallowRef<File>()
  const videoUrl = useObjectUrl(video)
  /** What was read of the video in use, with the part chosen. */
  const trim = shallowRef<VideoTrim>()
  /** The file the trim dialog is showing: a new pick, or the one in use. */
  const trimming = shallowRef<File>()
  const trimOpen = ref(false)
  /** The video taken out last, kept so it can be put back. */
  const removed = shallowRef<{ video: File; trim: VideoTrim }>()
  const character = shallowRef<File>()
  const characterUrl = useObjectUrl(character)
  const target = ref('')
  /** A fixed seed, or none: then every take draws its own. */
  const seed = ref<number>()

  const clipSeconds = computed(() => trim.value?.duration)
  /** The video runs past the longest part, so only some of it is used. */
  const trimmed = computed(
    () => !!trim.value && longerThanLimit(trim.value.duration, SWAP_TRIM_LIMITS)
  )
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
  const size = ref<SwapSize>(SWAP_SIZES[0])
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

  const exampleFailed = ref(false)
  function adoptVideo(file: File, next: VideoTrim) {
    exampleFailed.value = false
    video.value = file
    trim.value = next
    removed.value = undefined
    selected.value = 'source'
  }
  function openTrim(file: File) {
    trimming.value = file
    trimOpen.value = true
  }

  let videoRequest = 0
  function takeVideo(file: File) {
    videoRequest += 1
    exampleFailed.value = false
    openTrim(file)
  }
  async function useWholeClip(file: File) {
    const request = ++videoRequest
    const url = URL.createObjectURL(file)
    const facts = await readVideoFacts(url, new AbortController().signal)
    URL.revokeObjectURL(url)
    if (request !== videoRequest) return
    if (!facts || tooShortToTrim(facts.duration, SWAP_TRIM_LIMITS))
      return openTrim(file)
    adoptVideo(file, {
      ...initialTrim(facts.duration, SWAP_TRIM_LIMITS),
      ...facts
    })
  }
  /** Reopens the trim dialog on the video in use, at the part chosen. */
  function editTrim() {
    if (video.value) openTrim(video.value)
  }
  function confirmTrim(next: VideoTrim) {
    if (trimming.value) adoptVideo(trimming.value, next)
  }
  function removeVideo() {
    if (video.value && trim.value)
      removed.value = { video: video.value, trim: trim.value }
    video.value = undefined
    trim.value = undefined
    selected.value = 'source'
  }
  function restoreVideo() {
    if (removed.value) adoptVideo(removed.value.video, removed.value.trim)
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

  /** The example being fetched, so its card can show it is on its way. */
  const loadingExample = ref<SwapExample['id']>()
  let exampleRequest = 0
  async function fileFrom(url: string) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url} answered ${response.status}`)
    const blob = await response.blob()
    return new File([blob], url.split('/').at(-1) ?? 'example', {
      type: blob.type
    })
  }
  async function takeExample(example: SwapExample) {
    const request = ++exampleRequest
    const videoAt = ++videoRequest
    loadingExample.value = example.id
    exampleFailed.value = false
    const stale = () => videoAt !== videoRequest || disposed
    try {
      const [clip, image] = await Promise.all([
        fileFrom(example.video),
        fileFrom(example.character)
      ])
      if (stale()) return
      character.value = image
      target.value = ''
      size.value = SWAP_SIZES[0]
      seed.value = undefined
      await useWholeClip(clip)
    } catch {
      if (!stale()) exampleFailed.value = true
    } finally {
      if (request === exampleRequest) loadingExample.value = undefined
    }
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
  let disposed = false

  const signedIn = () => OPENJUTSU_NO_ACCOUNT || !!session.value
  /** The backend to ask for a price, when there is one and someone to ask as. */
  const quoteSource = () => (signedIn() ? transport : undefined)

  function quoteArrived(next: ReshootQuote | undefined) {
    quote.value = next
    quoteSettled.value = true
    quoteFailed.value = false
    quoteFailures = 0
    unavailable.value = false
  }
  /** A failed quote: the price is unknown, so ask again unless waiting cannot help. */
  function quoteFailedWith(error: unknown) {
    if (disposed) return
    const failure = quoteFailure(error, quoteFailures)
    quote.value = undefined
    quoteSettled.value = false
    if (failure.unavailable) unavailable.value = true
    quoteFailed.value = failure.retryInMs !== undefined
    if (failure.retryInMs === undefined) return
    quoteFailures += 1
    quoteRetry = setTimeout(() => void refreshQuote(), failure.retryInMs)
  }
  async function refreshQuote() {
    if (disposed) return
    const request = ++quoteRequest
    clearTimeout(quoteRetry)
    const source = quoteSource()
    if (!source) {
      quote.value = undefined
      quoteSettled.value = false
      return
    }
    const answer = await source.quote().then(
      (next) => () => quoteArrived(next),
      (error: unknown) => () => quoteFailedWith(error)
    )
    if (request === quoteRequest) answer()
  }
  watch(
    () => [mounted.value, session.value?.workspace.id] as const,
    ([isMounted]) => {
      if (isMounted) void refreshQuote()
    },
    { immediate: true }
  )

  const refusesCredit = computed(() =>
    quoteRefusesCredit(rendering.value, quote.value)
  )
  const gate = computed(() =>
    swapGate({
      noAccount: OPENJUTSU_NO_ACCOUNT,
      unavailable: unavailable.value,
      mounted: mounted.value,
      authEnabled: authEnabled.value,
      sessionFailed: !!sessionFailure.value,
      sessionSettled: settled.value,
      hasUser: !!user.value,
      hasSession: !!session.value,
      role: session.value?.role,
      refusesCredit: refusesCredit.value
    })
  )
  /** What is still missing before Generate, in the order the panel asks. */
  const missing = computed(() =>
    missingInput({
      video: !!video.value && !!trim.value,
      character: !!character.value
    })
  )
  const canGenerate = computed(() =>
    canSwap({
      gate: gate.value,
      missing: missing.value,
      rendering: rendering.value,
      quoteSettled: quoteSettled.value,
      quote: quote.value,
      priceReadable: priceReadable(quote.value, {
        seconds: partSeconds.value,
        size: size.value
      })
    })
  )
  const priceNote = computed(() => {
    if (!quote.value)
      return quoteFailed.value ? t('reshoot.quote.failed') : undefined
    return swapPriceNote(
      quote.value,
      { size: size.value, seconds: partSeconds.value },
      locale
    )
  })

  const noteFor = (error: unknown) =>
    swapFailureNote(error, {
      locale,
      role: session.value?.role,
      workspace: session.value?.workspace.name,
      price: quote.value?.price_credits
    })

  // --- the run
  const backend = transport && { transport, upload: uploadOnce(transport) }
  const runs = new Map<string, AbortController>()
  const objectUrls: string[] = []

  /**
   * Everything the next run uses, read at once: edits made while it renders
   * belong to the next take, and a blank seed is drawn once, here.
   */
  function nextJob(): SwapJob | undefined {
    const clip = video.value
    const image = character.value
    const read = trim.value
    if (!clip || !image || !read) return undefined
    const canvasSize = swapCanvas(read.width, read.height, size.value)
    return {
      video: clip,
      character: image,
      makeAnchor: (signal) =>
        routerAnchor({
          video: clip,
          start: read.start,
          character: image,
          token: sessionToken,
          signal
        }),
      request: {
        target: target.value.trim(),
        start: read.start,
        seconds: swapSeconds(read.end - read.start),
        size: size.value,
        canvas: canvasSize,
        result: resultSize(read.width, read.height, canvasSize),
        seed: resolveSeed(seed.value)
      }
    }
  }

  /** Adds the take a job will fill, shows it, and hands back how to stop it. */
  function openTake(job: SwapJob, chosenSeconds: number) {
    const sourceUrl = URL.createObjectURL(job.video)
    objectUrls.push(sourceUrl)
    const take: SwapTake = {
      id: crypto.randomUUID(),
      n: takes.value.length + 1,
      sourceUrl,
      frame: job.request.result,
      target: job.request.target,
      window: { start: job.request.start, seconds: chosenSeconds },
      seconds: job.request.seconds,
      size: size.value,
      seed: job.request.seed,
      status: 'rendering',
      phase: 'uploading'
    }
    takes.value = [...takes.value, take]
    selected.value = take.id
    const controller = new AbortController()
    runs.set(take.id, controller)
    return { id: take.id, signal: controller.signal }
  }

  /** A finished run: its video becomes the take's result. */
  function takeDone(id: string, result: Blob): SwapOutcome {
    const url = URL.createObjectURL(result)
    objectUrls.push(url)
    updateTake(id, { status: 'done', phase: undefined, url })
    return { status: 'succeeded', output_count: 1 }
  }
  function takeFailed(id: string, error: unknown): SwapOutcome {
    updateTake(id, {
      status: 'failed',
      phase: undefined,
      note: noteFor(error)
    })
    return { status: 'failed', reason: swapFailureReason(error) }
  }

  function afterRun(id: string, hadAccount: boolean) {
    runs.delete(id)
    if (disposed) return
    void refreshQuote()
    if (hadAccount) void refreshWorkshopCredits({ force: true })
  }

  /** Runs one job into a new take, on whichever backend the page has. */
  async function runTake(via: NonNullable<typeof backend>, job: SwapJob) {
    const chosen = range.value?.seconds ?? job.request.seconds
    const take = openTake(job, chosen)
    const startedFor = session.value
    const report = swapRunReport(startedFor)
    report.started()
    // A stopped run is cancelled whichever way it ended; `cancel` has already
    // marked its take.
    const settle = (outcome: () => SwapOutcome) =>
      report.finished(take.signal.aborted ? { status: 'cancelled' } : outcome())
    try {
      const result = await runSwap(
        via.transport,
        via.upload,
        job,
        (phase) => updateTake(take.id, { phase }),
        take.signal
      )
      settle(() => takeDone(take.id, result))
    } catch (error) {
      settle(() => takeFailed(take.id, error))
    } finally {
      afterRun(take.id, startedFor !== undefined)
    }
  }

  async function generate() {
    const job = nextJob()
    if (!backend || !canGenerate.value || !job) return
    await runTake(backend, job)
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
    disposed = true
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
    trimmed,
    removed,
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
    removeVideo,
    restoreVideo,
    takeCharacter,
    loadingExample,
    exampleFailed,
    takeExample,
    generate,
    cancel,
    reuse
  }
}
