<script setup lang="ts">
import {
  useElementVisibility,
  useEventListener,
  useMounted,
  useTimestamp
} from '@vueuse/core'
import {
  computed,
  effectScope,
  onMounted,
  onScopeDispose,
  onUnmounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useWorkshopFormDraft } from '@/composables/useWorkshopFormDraft'
import { useWorkshopDelivery } from '@/composables/useWorkshopDelivery'
import { sameFormValues } from '@/lib/workshop/form-values'
import { validateWorkshopMediaInputs } from '@/config/workshop-media-validation'
import { useSignInHref } from '@/composables/useSignInHref'
import { usePersonalWorkspaceSwitch } from '@/composables/usePersonalWorkspaceSwitch'
import type { WorkshopModelDetail } from '@/config/models-catalogue'
import type { SnippetLanguage } from '@/config/models-snippets'
import type {
  FieldErrors,
  FormValues,
  PlaygroundExample
} from '@/config/workshop-playground'
import {
  exampleAlt,
  isVideoUrl,
  schemaForModel,
  validateForm
} from '@/config/workshop-playground'
import {
  initialWorkshopPageState,
  workshopExampleState,
  workshopPageSchema
} from '@/config/workshop-page-state'
import type { RunOutput, RunRecord, RunState } from '@/config/workshop-run'
import { IDLE, transition } from '@/config/workshop-run'
import { refreshWorkshopCredits } from '@/config/workshop-credits'
import { useWorkshopModelBalance } from '@/config/workshop-model-balance'
import { stopWorkshopAccountSource } from '@/config/workshop-account-source'
import { requestWorkshopBuyCredits } from '@/config/workshop-buy-credits'
import type { RouterRenderResult } from '@/config/router-render'
import { router_render } from '@/config/router-render'
import { createWorkshopUrlUploader } from '@/config/workshop-url-upload'
import {
  WorkshopRouterError,
  workshopRunMayStillSettle
} from '@/config/workshop-router-errors'
import { releaseRouterOutputs } from '@/config/workshop-response'
import { retainRunHistory } from '@/config/workshop-run-history'
import { reportWorkshopRun } from '@/config/workshop-run-state'
import { modelDocsHref } from '@/lib/workshop/model-docs'
import { linkLeavingPage } from '@/lib/workshop/leaving-link'
import { pagePaths } from '@/lib/workshop/page-paths'
import { routerSavesAssets } from '@/lib/workshop/asset-saving'
import { scrollToSection } from '@/lib/workshop/scroll-to-section'
import type { WorkshopSession } from '@/config/workshop-session-state'
import {
  stopWorkshopSession,
  useWorkshopSession
} from '@/config/workshop-session-state'
import { workshopIdempotencyKey } from '@/config/workshop-snippets'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopAuthFlag
} from '@/scripts/posthog'
import type { WorkshopRunAnalytics } from '@/scripts/workshop-analytics'
import {
  workshopFailureAnalytics,
  workshopFieldErrorCodes,
  workshopModelAnalytics
} from '@/scripts/workshop-analytics'
import ApiTab from './ApiTab.vue'
import ExamplesTab from './ExamplesTab.vue'
import {
  frameRatioRule,
  refusesRealFaces
} from '@/config/workshop-model-restrictions'
import PlaygroundForm from './PlaygroundForm.vue'
import PlaygroundOutput from './PlaygroundOutput.vue'
import ExampleReplaceDialog from './ExampleReplaceDialog.vue'
import RunLeaveDialog from './RunLeaveDialog.vue'
import SavedAssetsStrip from './SavedAssetsStrip.vue'
import ModelSamples from '@/components/workshop/model-detail/ModelSamples.vue'
import ModelApiHeading from '@/components/workshop/model-detail/ModelApiHeading.vue'
import PlaygroundInputHeader from '@/components/workshop/model-detail/PlaygroundInputHeader.vue'
import RunGateAction from '@/components/workshop/model-detail/RunGateAction.vue'
import RunRequestMeta from '@/components/workshop/model-detail/RunRequestMeta.vue'
import { WORKSHOP_LEAVE_RUNNING } from '@/config/workshop-router-queue'
import { WORKSHOP_ASSETS_URL } from '@/config/workshop-env'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopModelDetail
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const modelAnalytics = workshopModelAnalytics(model)
const frameRatio = frameRatioRule(model.slug)
const sectionClass = 'scroll-mt-24 lg:scroll-mt-32'

const initialPageState = initialWorkshopPageState(model)
const examples = initialPageState.examples
const runsHere = pagePaths(model).run
const apiSectionClass = cn(
  sectionClass,
  (runsHere || examples.length > 0) &&
    'mt-16 border-t border-transparency-white-t8 pt-12'
)
const firstExample = initialPageState.firstExample
const activeExample = ref<PlaygroundExample | undefined>(
  initialPageState.activeExample
)
const activeExampleId = ref(firstExample?.id)
const nativeJson = ref(false)
const schema = computed(() =>
  nativeJson.value && model.execution
    ? schemaForModel({
        fields: [],
        form: {
          source: 'router',
          raw: true,
          parameters: model.execution.inputSchema,
          roles: [],
          advancedFields: []
        }
      })
    : workshopPageSchema(model, activeExample.value)
)

function exampleOutput(example: PlaygroundExample): RunOutput {
  const kind = example.mediaKind ?? model.modality ?? 'other'
  const extension =
    kind === 'audio'
      ? 'mp3'
      : kind === 'video' || isVideoUrl(example.outputUrl)
        ? 'mp4'
        : 'webp'
  return {
    kind,
    url: example.outputUrl,
    fileName: `${model.slug}-${example.id}.${extension}`,
    alt: exampleAlt(model.name, example.title, locale)
  }
}

const fieldValues = ref<FormValues>(initialPageState.values)
const jsonValues = ref<FormValues>({
  request_body: JSON.stringify(
    model.execution?.inputSchema.example ?? {},
    null,
    2
  )
})
const values = computed<FormValues>({
  get: () => (nativeJson.value ? jsonValues.value : fieldValues.value),
  set: (value) => {
    if (nativeJson.value) jsonValues.value = value
    else fieldValues.value = value
  }
})
const { pending: draftPending, restoreFailed } = useWorkshopFormDraft(
  model.slug,
  schema,
  values,
  nativeJson,
  !!model.execution && model.execution.inputs === undefined
)
// The marks are what the page itself put on the form, taken before anything
// else can write. A restored draft is a reader's own work carried across a
// sign-in, so the restore moving the form away from these marks is exactly
// what makes it worth asking about.
//
// An example lands on the form and takes the reader there, so it can spend
// work typed in either editor whichever one is open. Both records are read,
// and writing anywhere is enough to be asked about.
const settledValues = ref<FormValues>(fieldValues.value)
const settledJson = ref<FormValues>(jsonValues.value)
const inputsEdited = computed(
  () =>
    !sameFormValues(fieldValues.value, settledValues.value) ||
    !sameFormValues(jsonValues.value, settledJson.value)
)
function markSettled(): void {
  settledValues.value = fieldValues.value
  settledJson.value = jsonValues.value
}

const runState = ref<RunState>(
  firstExample
    ? { status: 'example', output: exampleOutput(firstExample) }
    : IDLE
)
// With Cloud keeping every generation, a run outlives the page that started it:
// the reader can close the tab and find the result in their assets. Without it,
// the run exists only here, so leaving has to stop it.
const savesAssets =
  import.meta.env.PUBLIC_WORKSHOP_SAVE_ASSETS === '1' &&
  routerSavesAssets(model.routerId)
const runs = ref<RunRecord[]>([])
const earlier = computed(() => runs.value.slice(1))
const attachments = computed(() =>
  runState.value.status === 'succeeded'
    ? (runs.value[0]?.attachments ?? [])
    : []
)
const revealed = ref(false)

const workshopEnabled = useWorkshopEnabled()
const workshopEnabledSettled = useWorkshopEnabledSettled()
function startAccountServices() {
  const scope = effectScope(true)
  const services = scope.run(() => {
    const workshopSession = useWorkshopSession()
    return {
      ...workshopSession,
      balance: useWorkshopModelBalance(workshopSession.session)
    }
  })
  return services && { ...services, scope }
}
const account = shallowRef<ReturnType<typeof startAccountServices>>()
function stopAccountServices() {
  account.value?.scope.stop()
  stopWorkshopSession()
  stopWorkshopAccountSource()
  account.value = undefined
}
onScopeDispose(() => account.value?.scope.stop())
watch(
  workshopEnabled,
  (enabled) => {
    if (enabled) account.value ??= startAccountServices()
    else if (account.value && runState.value.status !== 'running')
      stopAccountServices()
  },
  { immediate: true }
)
const user = computed(() => account.value?.user.value)
const session = computed(() => account.value?.session.value)
const sessionFailure = computed(() => account.value?.sessionFailure.value)
const settled = computed(() => account.value?.settled.value ?? false)
const balance = computed(() => account.value?.balance.value)
const authEnabled = useWorkshopAuthFlag()
const mounted = useMounted()
const signInHref = useSignInHref(locale)
const docsHref = modelDocsHref(model)

watch(
  () => mounted.value && workshopEnabled.value,
  (visible) => {
    if (visible) {
      captureWorkshopEvent({ name: 'model_viewed', properties: modelAnalytics })
    }
  },
  { once: true }
)
const apiSection = useTemplateRef<HTMLElement>('apiSection')
const apiInView = useElementVisibility(apiSection)
watch([apiInView, workshopEnabled], ([inView, enabled]) => {
  if (enabled && inView) {
    captureWorkshopEvent({ name: 'api_viewed', properties: modelAnalytics })
  }
})
function captureApiKeyClick() {
  if (workshopEnabled.value)
    captureWorkshopEvent({
      name: 'api_key_clicked',
      properties: modelAnalytics
    })
}
function captureSnippetCopy(language: SnippetLanguage) {
  if (workshopEnabled.value)
    captureWorkshopEvent({
      name: 'api_snippet_copied',
      properties: { ...modelAnalytics, snippet_language: language }
    })
}
const canRunModel = computed(() => runsHere && !activeExample.value?.fields)
const flagOffGate = computed(() =>
  workshopEnabledSettled.value ? 'rollingOut' : 'resolving'
)
const gate = computed(() => {
  if (!canRunModel.value) return 'unavailable'
  if (!mounted.value) return 'resolving'
  if (!workshopEnabled.value) return flagOffGate.value
  if (draftPending.value) return 'pending'
  if (!authEnabled.value || sessionFailure.value) return 'unavailable'
  if (!settled.value || (user.value && !session.value)) return 'pending'
  if (!session.value) return 'signedOut'
  if (
    runState.value.status !== 'running' &&
    balance.value?.status === 'ok' &&
    balance.value.credits <= 0
  )
    return session.value.role === 'member' ? 'memberNoCredits' : 'noCredits'
  return 'ready'
})
const inputsLocked = computed(
  () => !mounted.value || isRunning.value || draftPending.value
)
const blockedRunLabel = computed<TranslationKey>(() => {
  if (gate.value === 'resolving') return 'workshop.run.resolvingAvailability'
  if (gate.value === 'pending') return 'workshop.run.preparingSession'
  return model.incompleteReason
    ? 'workshop.model.notSupported'
    : 'workshop.run.mappingUnavailable'
})
const errors = computed<FieldErrors>(() =>
  runState.value.status === 'failed' ? runState.value.fieldErrors : {}
)
const isRunning = computed(() => runState.value.status === 'running')
watch(isRunning, (running) => {
  if (!running && !workshopEnabled.value && account.value) stopAccountServices()
})
const protectedHistoryIndex = ref<number>()
let approvedTraversal = false
let restoringTraversal = false

function historyIndex(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null || !('index' in state))
    return undefined
  const index = Reflect.get(state, 'index')
  return typeof index === 'number' && Number.isInteger(index)
    ? index
    : undefined
}

watch(
  isRunning,
  (running) => {
    protectedHistoryIndex.value = running
      ? historyIndex(globalThis.window?.history.state)
      : undefined
    approvedTraversal = false
    restoringTraversal = false
  },
  { flush: 'sync' }
)

// A run in flight is money and minutes: leaving the page throws both away, so
// the browser asks first. The listener only exists while the run does, since a
// standing one costs the idle page its place in the back/forward cache.
// globalThis.window, not window: on the server the island has neither.
useEventListener(
  () => (isRunning.value ? globalThis.window : undefined),
  'beforeunload',
  (event: BeforeUnloadEvent) => event.preventDefault()
)

// Browser history moves before popstate. Intercept it ahead of Astro's bubble
// listener: declining restores the prior entry without unmounting this island;
// accepting lets Astro finish the traversal and cancel the run on unmount.
useEventListener(
  () => (isRunning.value ? globalThis.window : undefined),
  'popstate',
  (event: PopStateEvent) => {
    if (restoringTraversal) {
      restoringTraversal = false
      event.stopImmediatePropagation()
      return
    }
    const from = protectedHistoryIndex.value
    const to = historyIndex(event.state)
    if (from === undefined || to === undefined || from === to) return
    if (globalThis.window.confirm(t('workshop.run.leavePage'))) {
      protectedHistoryIndex.value = to
      approvedTraversal = true
      queueMicrotask(() => {
        approvedTraversal = false
      })
      return
    }
    event.stopImmediatePropagation()
    restoringTraversal = true
    globalThis.window.history.go(from - to)
  },
  { capture: true }
)

// Caught before the client router sees the click, nothing has moved yet, so
// this one route off the page can be asked in our own words. The rest still
// reach the guards above.
const leavingTo = ref<string>()
// Carrying on is only worth offering where the cloud would keep the result,
// and only once the Router has admitted the run: before that it exists on this
// page alone, so leaving it running would leave nothing running.
const leaveAction = computed(() =>
  savesAssets && requestId.value ? 'leaveSaved' : 'leave'
)
const assetsHref = computed(() =>
  leaveAction.value === 'leaveSaved' ? WORKSHOP_ASSETS_URL : undefined
)

// A kept result does not expire, so the note beneath it would be untrue. A run
// the cloud failed to keep expires like any other, and the reader has to hear
// that while the result is still there to download.
const saveFailed = ref(false)
const showsExpiry = computed(
  () =>
    runState.value.status === 'succeeded' && (!savesAssets || saveFailed.value)
)

// The strip belongs to one workspace's runs of one Router model, so it waits
// for both and has nothing to show for a model the Router does not serve.
const savedAssetsFor = computed(() =>
  savesAssets && session.value && model.routerId
    ? { modelId: model.routerId, key: session.value }
    : undefined
)

useEventListener(
  () => (isRunning.value ? globalThis.document : undefined),
  'click',
  (event: MouseEvent) => {
    const href = linkLeavingPage(event, location)
    if (!href) return
    event.preventDefault()
    leavingTo.value = href
  },
  { capture: true }
)
function leaveForLink() {
  const href = leavingTo.value
  leavingTo.value = undefined
  if (!href) return
  cancelRun()
  location.assign(href)
}

// The reader who started a long render on purpose and meant to walk away. A
// run admitted between the dialog opening and this click is the only one that
// can be left; anything else would be abandoned rather than kept.
function keepAndLeave() {
  const href = leavingTo.value
  leavingTo.value = undefined
  if (!href) return
  if (requestId.value) stopObserving()
  else cancelRun()
  location.assign(href)
}

// A push/replace has not moved history yet, so native fallback is safe and the
// beforeunload guard owns its confirmation. An approved traversal is the one
// exception: it was already confirmed in the capture-phase popstate handler.
useEventListener(
  () => (isRunning.value ? globalThis.document : undefined),
  'astro:before-preparation',
  (event: Event) => {
    const navigationType = Reflect.get(event, 'navigationType')
    if (navigationType === 'traverse' && approvedTraversal) {
      approvedTraversal = false
      return
    }
    event.preventDefault()
  }
)
const requestId = ref<string | null>(null)
interface ActiveRun {
  readonly controller: AbortController
  readonly analytics: WorkshopRunAnalytics
  readonly startedAt: number
}

let activeRun: ActiveRun | undefined
const credentialFailures = new WeakSet<ActiveRun>()
const delivery = useWorkshopDelivery()
let pendingRequest: { fingerprint: string; key: string } | undefined
const uploadUrl = createWorkshopUrlUploader()

const now = useTimestamp({ interval: 1000 })

// The header is its own island and switching workspace is not a navigation,
// so none of the guards above see it. This is how it learns there is a run.
watch(isRunning, (running) =>
  reportWorkshopRun(running ? cancelRun : undefined)
)
onScopeDispose(() => reportWorkshopRun(undefined))

function cancelRun() {
  delivery.cancel()
  if (activeRun) {
    activeRun.controller.abort()
    captureWorkshopEvent({
      name: 'run_finished',
      properties: {
        ...activeRun.analytics,
        status: 'cancelled',
        duration_ms: Date.now() - activeRun.startedAt
      }
    })
    activeRun = undefined
    pendingRequest = undefined
    rememberRequestId(null)
  }
  runState.value = transition(runState.value, { type: 'cancel' })
}

// Stop watching a run that Cloud is keeping. The reader finds it in their
// assets, so the machine stays busy on work they will still get.
function stopObserving() {
  activeRun?.controller.abort(WORKSHOP_LEAVE_RUNNING)
  activeRun = undefined
  runState.value = IDLE
  reportWorkshopRun(undefined)
}

/**
 * The address carries the run so that a reload finds it again. It belongs to
 * that run alone: one that ended, or one whose workspace is no longer this
 * reader's, takes it back rather than leaving an id for the next load to
 * restore as though it were still theirs.
 */
function rememberRequestId(id: string | null) {
  requestId.value = id
  if (!savesAssets) return
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('request_id', id)
  else url.searchParams.delete('request_id')
  window.history.replaceState(window.history.state, '', url)
}

// A reload lands on the run the address remembers, so the strip can show it
// still working rather than an empty shelf.
onMounted(() => {
  if (!savesAssets) return
  const id = new URL(window.location.href).searchParams.get('request_id')
  if (id && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))
    requestId.value = id
})

// The results on screen belong to the workspace that paid for them, so an
// owner who changes takes them with them. Only a saved run survives the change,
// and it survives in their assets rather than here.
function leaveOwner() {
  cancelRun()
  if (!savesAssets) return
  pendingRequest = undefined
  releaseRouterOutputs(
    runs.value.flatMap((run) => [run.output, ...run.attachments])
  )
  runs.value = []
  rememberRequestId(null)
}

// The strip asks for its own credential, and refuses one minted for anybody
// but the owner it started with, so a workspace that changed mid-request never
// reads another workspace's assets.
async function historyToken(): Promise<string> {
  const owner = session.value
  const result = await account.value?.ensureFresh()
  if (
    !owner ||
    result?.status !== 'ok' ||
    result.session.uid !== owner.uid ||
    result.session.workspace.id !== owner.workspace.id ||
    session.value?.uid !== owner.uid ||
    session.value?.workspace.id !== owner.workspace.id
  )
    throw new WorkshopRouterError('unavailable')
  return result.session.token
}

const {
  pending: personalSwitchPending,
  failed: personalSwitchError,
  switchToPersonal
} = usePersonalWorkspaceSwitch()

onUnmounted(() => {
  cancelRun()
  releaseRouterOutputs(
    runs.value.flatMap((run) => [run.output, ...run.attachments])
  )
})
watch(
  () => session.value?.uid,
  (uid, previous) => {
    if (previous !== undefined && uid !== previous) leaveOwner()
  }
)
watch(
  () => session.value?.workspace.id,
  (workspace, previous) => {
    if (previous !== undefined && workspace !== previous) leaveOwner()
  }
)

function runnableSession(): WorkshopSession | undefined {
  if (isRunning.value || gate.value !== 'ready' || !model.execution) return
  return session.value
}

function runIsActive(attempt: ActiveRun): boolean {
  return activeRun === attempt && !attempt.controller.signal.aborted
}

async function freshCredentialFor(
  startedFor: WorkshopSession,
  attempt: ActiveRun
): Promise<WorkshopSession> {
  const credential = await account.value?.ensureFresh(undefined, {
    signal: attempt.controller.signal
  })
  attempt.controller.signal.throwIfAborted()
  if (
    credential?.status !== 'ok' ||
    credential.session.uid !== startedFor.uid ||
    credential.session.workspace.id !== startedFor.workspace.id
  ) {
    credentialFailures.add(attempt)
    throw new WorkshopRouterError('unavailable')
  }
  return credential.session
}

function idempotencyKeyFor(
  startedFor: WorkshopSession,
  body: Readonly<Record<string, unknown>>
): string {
  const fingerprint = JSON.stringify([
    startedFor.uid,
    startedFor.workspace.id,
    model.routerId,
    body
  ])
  if (pendingRequest?.fingerprint !== fingerprint) {
    pendingRequest = { fingerprint, key: workshopIdempotencyKey() }
  }
  return pendingRequest.key
}

async function renderRun(
  startedFor: WorkshopSession,
  attempt: ActiveRun
): Promise<RouterRenderResult> {
  return router_render(
    model.slug,
    {},
    {
      model,
      comfy_save_asset: savesAssets,
      form: { schema: schema.value, values: values.value },
      signal: attempt.controller.signal,
      token: async () => (await freshCredentialFor(startedFor, attempt)).token,
      uploadFile: async (file, signal) => {
        const credential = await freshCredentialFor(startedFor, attempt)
        return uploadUrl(
          file,
          credential.token,
          JSON.stringify([startedFor.uid, startedFor.workspace.id]),
          signal
        )
      },
      idempotencyKey: (body) => idempotencyKeyFor(startedFor, body),
      onRequestId: (id) => {
        if (runIsActive(attempt)) rememberRequestId(id)
      }
    }
  )
}

function finishRun(result: RouterRenderResult, attempt: ActiveRun): void {
  if (!runIsActive(attempt)) {
    releaseRouterOutputs(result.outputs)
    return
  }
  pendingRequest = undefined
  rememberRequestId(result.requestId)
  const [output, ...attachments] = result.outputs
  if (!output)
    throw new WorkshopRouterError(
      'response',
      result.requestId,
      {},
      undefined,
      'response'
    )
  const { retained, discarded } = retainRunHistory([
    { output, attachments },
    ...runs.value
  ])
  runs.value = retained
  releaseRouterOutputs(
    discarded.flatMap((run) => [run.output, ...run.attachments])
  )
  delivery.start(attempt.analytics, result.requestId, output)
  runState.value = transition(runState.value, {
    type: 'complete',
    at: Date.now(),
    output,
    nsfw: output.nsfw === true
  })
  captureWorkshopEvent({
    name: 'run_finished',
    properties: {
      ...attempt.analytics,
      status: 'succeeded',
      duration_ms: Date.now() - attempt.startedAt,
      request_id: result.requestId ?? undefined,
      output_count: result.outputs.length
    }
  })
}

function failRun(error: unknown, attempt: ActiveRun): void {
  if (!runIsActive(attempt)) return
  const failure =
    error instanceof WorkshopRouterError
      ? error
      : new WorkshopRouterError('client', null, {}, undefined, undefined, {
          cause: error
        })
  if (!workshopRunMayStillSettle(failure)) pendingRequest = undefined
  rememberRequestId(failure.requestId)
  runState.value = transition(runState.value, {
    type: 'fail',
    reason: failure.reason,
    fieldErrors: failure.fieldErrors
  })
  captureWorkshopEvent({
    name: 'run_finished',
    properties: {
      ...attempt.analytics,
      status: 'failed',
      duration_ms: Date.now() - attempt.startedAt,
      ...workshopFailureAnalytics(failure, schema.value),
      ...(credentialFailures.has(attempt)
        ? { failure_stage: 'credential' }
        : {})
    }
  })
}

async function run() {
  const startedFor = runnableSession()
  if (!startedFor) return
  const fieldErrors = validateForm(schema.value, values.value)
  if (Object.keys(fieldErrors).length) {
    captureWorkshopEvent({
      name: 'run_validation_failed',
      properties: {
        ...modelAnalytics,
        field_error_codes: workshopFieldErrorCodes(fieldErrors),
        field_error_names: schema.value
          .filter((field) => Object.hasOwn(fieldErrors, field.name))
          .map((field) => field.name)
      }
    })
    runState.value = transition(runState.value, {
      type: 'fail',
      reason: 'validation',
      fieldErrors
    })
    return
  }
  const startedAt = Date.now()
  delivery.cancel()
  const analytics: WorkshopRunAnalytics = {
    ...modelAnalytics,
    user_id: startedFor.uid,
    workspace_id: startedFor.workspace.id,
    attempt_id: workshopIdempotencyKey()
  }
  const attempt: ActiveRun = {
    controller: new AbortController(),
    analytics,
    startedAt
  }
  activeRun = attempt
  captureWorkshopEvent({ name: 'run_started', properties: analytics })
  rememberRequestId(null)
  runState.value = transition(runState.value, { type: 'start', at: startedAt })
  try {
    await validateWorkshopMediaInputs(
      schema.value,
      values.value,
      attempt.controller.signal
    )
    if (!runIsActive(attempt)) return
    finishRun(await renderRun(startedFor, attempt), attempt)
  } catch (error) {
    failRun(error, attempt)
  } finally {
    if (activeRun === attempt) activeRun = undefined
    void refreshWorkshopCredits({ force: true })
  }
}

function captureOutputDownload(kind: RunOutput['kind']) {
  captureWorkshopEvent({
    name: 'output_download_clicked',
    properties: { ...modelAnalytics, output_kind: kind }
  })
}

function reset() {
  cancelRun()
  runState.value = IDLE
}

function applyExample(example: PlaygroundExample) {
  delivery.cancel()
  if (!example.sampleOnly) {
    nativeJson.value = false
    activeExample.value = example.fields ? example : undefined
    values.value = workshopExampleState(model, example).values
    // Agreeing settles both records: the reader has let the example win.
    markSettled()
  }
  activeExampleId.value = example.id
  runState.value = { status: 'example', output: exampleOutput(example) }
}

// An example overwrites the whole form, so where there is writing to lose the
// reader decides, instead of finding it gone.
const replacing = ref<PlaygroundExample>()

function openExample(example: PlaygroundExample) {
  if (isRunning.value || draftPending.value) return
  if (!example.sampleOnly && inputsEdited.value) {
    replacing.value = example
    return
  }
  applyExample(example)
}

function replaceWithExample() {
  const example = replacing.value
  replacing.value = undefined
  if (example) applyExample(example)
}

function useInCode() {
  scrollToSection('api')
}
const offersNativeJson = computed(
  () =>
    !!model.execution &&
    model.execution.inputs === undefined &&
    !activeExample.value?.fields
)
const showsOutput = computed(
  () =>
    (mounted.value && workshopEnabled.value) || runState.value.status !== 'idle'
)
const showsRunMeta = computed(
  () => runState.value.status === 'succeeded' || !!requestId.value
)
const policyMessage = computed(() =>
  refusesRealFaces(model.slug) ? t('workshop.error.policyRealFaces') : undefined
)
const memberWorkspace = computed(() =>
  session.value?.role === 'member' ? session.value.workspace.name : undefined
)

function retry() {
  if (gate.value === 'ready') void run()
  else reset()
}
</script>

<template>
  <div class="flex flex-col" data-testid="model-detail">
    <section
      v-if="runsHere"
      id="playground"
      aria-labelledby="playground-heading"
      :class="sectionClass"
      data-testid="playground-section"
    >
      <h2 id="playground-heading" class="sr-only">
        {{ t('workshop.model.tabs.playground') }}
      </h2>
      <div class="grid gap-8 lg:grid-cols-12">
        <div
          class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-5"
          data-testid="playground-input"
        >
          <PlaygroundInputHeader
            v-model:native-json="nativeJson"
            :offers-native-json
            :disabled="inputsLocked"
            :locale
          />

          <!-- Loading an example rewrites every field at once, so the form
          settles in instead of snapping. -->
          <div
            :key="activeExampleId"
            class="flex animate-soft-in flex-col gap-6 p-5"
          >
            <PlaygroundForm
              v-model="values"
              :schema
              :errors
              :frame-ratio
              :locale
              :disabled="inputsLocked"
              :file-uploads-disabled="!mounted"
            />
            <p
              v-if="restoreFailed"
              role="status"
              class="text-sm text-primary-warm-gray"
            >
              {{ t('workshop.form.draftRestoreFailed') }}
            </p>
          </div>

          <!-- Run follows the form down the page, so a long list of inputs never
          pushes it past the bottom of a laptop screen. -->
          <div
            class="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 bg-page/85 p-3 backdrop-blur-sm"
          >
            <RunGateAction
              :gate
              :sign-in-href="signInHref"
              :workspace-name="session?.workspace.name"
              :switch-pending="personalSwitchPending"
              :switch-failed="personalSwitchError"
              :running="isRunning"
              :blocked-label="blockedRunLabel"
              :locale
              @buy-credits="requestWorkshopBuyCredits"
              @switch-personal="switchToPersonal"
              @show-api="scrollToSection('api')"
              @run="run"
              @cancel="cancelRun"
            />
          </div>
        </div>

        <div
          class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-26 lg:col-span-7 lg:self-start"
        >
          <PlaygroundOutput
            v-if="showsOutput"
            v-model:revealed="revealed"
            :state="runState"
            :earlier
            :attachments
            :now
            :modality="model.modality"
            compact
            :locale
            :policy-message
            :member-workspace
            @switch-personal="switchToPersonal"
            @buy-credits="requestWorkshopBuyCredits"
            @retry="retry"
            @use-in-code="useInCode"
            @download="captureOutputDownload"
            @delivery="delivery.settle"
            @playback-started="delivery.beginPlayback"
          />
          <RunRequestMeta
            v-if="showsRunMeta"
            :shows-expiry="showsExpiry"
            :request-id="requestId"
            :locale
          />

          <SavedAssetsStrip
            v-if="savedAssetsFor"
            :key="`${savedAssetsFor.key.uid}:${savedAssetsFor.key.workspace.id}`"
            :model-id="savedAssetsFor.modelId"
            :active-request-id="requestId"
            :token="historyToken"
            :locale
            @save-failed="saveFailed = $event"
          />
        </div>
      </div>

      <div v-if="examples.length" class="pt-6" data-testid="examples-section">
        <ExamplesTab
          :examples
          :gallery-label="model.name"
          :active-id="activeExampleId"
          :locale
          @open="openExample"
        />
      </div>
    </section>

    <ModelSamples
      v-else-if="examples.length"
      v-model:revealed="revealed"
      :class="sectionClass"
      :state="runState"
      :now
      :examples
      :model
      :active-id="activeExampleId"
      :locale
      @open="openExample"
      @download="captureOutputDownload"
    />

    <section
      id="api"
      ref="apiSection"
      aria-labelledby="api-heading"
      :class="apiSectionClass"
      data-testid="api-section"
    >
      <ModelApiHeading :docs-href :locale />
      <ApiTab
        :contract="model.execution"
        :values
        :workspace-id="session?.workspace.id"
        :locale
        :model-slug="model.slug"
        @get-key="captureApiKeyClick"
        @copy="captureSnippetCopy"
      />
    </section>

    <RunLeaveDialog
      :open="leavingTo !== undefined"
      :action="leaveAction"
      :assets-href="assetsHref"
      :locale
      @update:open="(value: boolean) => !value && (leavingTo = undefined)"
      @leave="leaveForLink"
      @keep="keepAndLeave"
    />

    <ExampleReplaceDialog
      :open="replacing !== undefined"
      :locale
      @update:open="(value: boolean) => !value && (replacing = undefined)"
      @replace="replaceWithExample"
    />
  </div>
</template>
