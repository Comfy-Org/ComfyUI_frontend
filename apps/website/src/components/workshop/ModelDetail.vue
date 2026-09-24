<script setup lang="ts">
import { Download, Play } from '@lucide/vue'
import { useEventListener, useMounted, useTimestamp } from '@vueuse/core'
import {
  computed,
  onScopeDispose,
  onUnmounted,
  ref,
  useSlots,
  watch
} from 'vue'

import Button from '@/components/ui/button/Button.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { useWorkshopFormDraft } from '../../composables/useWorkshopFormDraft'
import { useWorkshopDelivery } from '../../composables/useWorkshopDelivery'
import { sameFormValues } from '../../lib/workshop/form-values'
import { validateWorkshopMediaInputs } from '../../config/workshop-media-validation'
import { leaveForSignIn } from '../../config/workshop-return'
import { useSignInHref } from '../../composables/useSignInHref'
import type { WorkshopModelDetail } from '../../config/models-catalogue'
import type {
  FieldErrors,
  FormValues,
  PlaygroundExample
} from '../../config/workshop-playground'
import {
  isVideoUrl,
  schemaForModel,
  validateForm
} from '../../config/workshop-playground'
import {
  initialWorkshopPageState,
  workshopExampleState,
  workshopPageSchema
} from '../../config/workshop-page-state'
import type { RunOutput, RunRecord, RunState } from '../../config/workshop-run'
import { IDLE, transition } from '../../config/workshop-run'
import {
  refreshWorkshopCredits,
  useWorkshopCredits
} from '../../config/workshop-credits'
import { requestWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import type { RouterRenderResult } from '../../config/router-render'
import { router_render } from '../../config/router-render'
import { createWorkshopUrlUploader } from '../../config/workshop-url-upload'
import {
  WorkshopRouterError,
  workshopRunMayStillSettle
} from '../../config/workshop-router-errors'
import { releaseRouterOutputs } from '../../config/workshop-response'
import { retainRunHistory } from '../../config/workshop-run-history'
import { reportWorkshopRun } from '../../config/workshop-run-state'
import { modelDocsHref } from '../../lib/workshop/model-docs'
import { linkLeavingPage } from '../../lib/workshop/leaving-link'
import type { WorkshopSession } from '../../config/workshop-session-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { workshopIdempotencyKey } from '../../config/workshop-snippets'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopAuthFlag
} from '../../scripts/posthog'
import type { WorkshopRunAnalytics } from '../../scripts/workshop-analytics'
import {
  workshopFailureAnalytics,
  workshopFieldErrorCodes,
  workshopModelAnalytics
} from '../../scripts/workshop-analytics'
import ApiTab from './ApiTab.vue'
import ExamplesTab from './ExamplesTab.vue'
import { frameRatioRule } from '../../config/workshop-model-restrictions'
import PlaygroundForm from './PlaygroundForm.vue'
import PlaygroundOutput from './PlaygroundOutput.vue'
import ExampleReplaceDialog from './ExampleReplaceDialog.vue'
import RunLeaveDialog from './RunLeaveDialog.vue'
import ModelSupport from './ModelSupport.vue'
import ModelTabs from './ModelTabs.vue'
import type { ModelSection } from './model-section'

const {
  model,
  locale = 'en',
  clone
} = defineProps<{
  model: WorkshopModelDetail
  locale?: Locale
  clone?: { href: string }
  /** Names the form's groups as numbered steps and keeps the result in view
   * while they are filled in. The workflow pages ask for it; a model page has
   * a shorter form that reads fine as one list. */
}>()

const slots = useSlots()
const modelAnalytics = workshopModelAnalytics(model)
const frameRatio = frameRatioRule(model.slug)

const sections = computed<readonly ModelSection[]>(() =>
  slots.details ? ['playground', 'details', 'api'] : ['playground', 'api']
)
const activeSection = ref<ModelSection>('playground')

const initialPageState = initialWorkshopPageState(model)
const examples = initialPageState.examples
// A workflow page describes one workflow, so the model's other examples would
// be beside the point there.
const showsExamples = computed(
  () => !slots.details && !slots.playground && examples.length > 0
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
    fileName: `${model.slug}-${example.id}.${extension}`
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
const runs = ref<RunRecord[]>([])
const earlier = computed(() => runs.value.slice(1))
const attachments = computed(() =>
  runState.value.status === 'succeeded'
    ? (runs.value[0]?.attachments ?? [])
    : []
)
const revealed = ref(false)

const { user, session, sessionFailure, settled, ensureFresh, remint } =
  useWorkshopSession()
const { balance } = useWorkshopCredits()
const workshopEnabled = useWorkshopEnabled()
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
watch([activeSection, workshopEnabled], ([section, enabled]) => {
  if (enabled && section === 'api') {
    captureWorkshopEvent({ name: 'api_viewed', properties: modelAnalytics })
  }
})
const canRunModel = computed(
  () =>
    !model.incompleteReason &&
    import.meta.env.PUBLIC_WORKSHOP_ROUTER_RUN === '1' &&
    !!model.execution &&
    !activeExample.value?.fields &&
    !clone
)
const gate = computed(() => {
  if (!workshopEnabled.value || !canRunModel.value) return 'unavailable'
  if (!mounted.value || draftPending.value) return 'pending'
  if (!authEnabled.value || sessionFailure.value) return 'unavailable'
  if (!settled.value || (user.value && !session.value)) return 'pending'
  if (!session.value) return 'signedOut'
  if (
    runState.value.status !== 'running' &&
    balance.value.status === 'ok' &&
    balance.value.credits <= 0
  )
    return session.value.role === 'member' ? 'memberNoCredits' : 'noCredits'
  return 'ready'
})
const errors = computed<FieldErrors>(() =>
  runState.value.status === 'failed' ? runState.value.fieldErrors : {}
)
const isRunning = computed(() => runState.value.status === 'running')
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
    if (globalThis.window.confirm(t('workshop.run.leavePage', locale))) {
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
watch(activeSection, (section) => {
  if (section !== 'playground') delivery.cancel()
})
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
  }
  runState.value = transition(runState.value, { type: 'cancel' })
}

const personalSwitchPending = ref(false)
const personalSwitchError = ref(false)

async function switchToPersonal() {
  if (personalSwitchPending.value) return
  personalSwitchPending.value = true
  personalSwitchError.value = false
  try {
    const result = await remint(undefined, {
      preserveCredentialOnTransientFailure: true
    })
    if (result?.status === 'ok') await refreshWorkshopCredits({ force: true })
    else if (result?.status === 'error') personalSwitchError.value = true
  } catch {
    personalSwitchError.value = true
  } finally {
    personalSwitchPending.value = false
  }
}

onUnmounted(() => {
  cancelRun()
  releaseRouterOutputs(
    runs.value.flatMap((run) => [run.output, ...run.attachments])
  )
})
watch(
  () => session.value?.uid,
  (uid, previous) => {
    if (uid !== previous) cancelRun()
  }
)
watch(
  () => session.value?.workspace.id,
  (workspace, previous) => {
    if (workspace !== previous) cancelRun()
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
  const credential = await ensureFresh(undefined, {
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
        if (runIsActive(attempt)) requestId.value = id
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
  requestId.value = result.requestId
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
  if (activeSection.value !== 'playground') delivery.cancel()
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
  requestId.value = failure.requestId
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
  requestId.value = null
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
  activeSection.value = 'playground'
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
  activeSection.value = 'api'
}
</script>

<template>
  <div class="flex flex-col gap-10" data-testid="model-detail">
    <ModelTabs
      v-model="activeSection"
      :sections
      :docs-href="docsHref"
      :locale
    />

    <section
      v-if="slots.playground"
      v-show="activeSection === 'playground'"
      id="panel-playground"
      role="tabpanel"
      aria-labelledby="tab-playground"
      data-testid="playground-tab"
    >
      <slot name="playground" />
    </section>
    <section
      v-else-if="activeSection === 'playground'"
      id="panel-playground"
      role="tabpanel"
      aria-labelledby="tab-playground"
      class="grid gap-8 lg:grid-cols-12"
      data-testid="playground-tab"
    >
      <div
        class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-5"
        data-testid="playground-input"
      >
        <header
          class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
        >
          <span>{{ t('workshop.input.title', locale) }}</span>
          <button
            v-if="
              model.execution &&
              model.execution.inputs === undefined &&
              !activeExample?.fields
            "
            type="button"
            :aria-pressed="nativeJson"
            :disabled="isRunning || draftPending"
            class="cursor-pointer rounded-sm px-2 py-1 hover:bg-transparency-white-t8 disabled:cursor-not-allowed"
            @click="nativeJson = !nativeJson"
          >
            {{ t('workshop.form.nativeJson', locale) }}
          </button>
        </header>

        <!-- Loading an example rewrites every field at once, so the form
          settles in instead of snapping. -->
        <div
          :key="activeExampleId"
          class="flex animate-soft-in flex-col gap-6 p-5"
        >
          <ModelSupport
            v-if="model.incompleteReason"
            :reason="model.incompleteReason"
            variant="notice"
            :locale
          />
          <PlaygroundForm
            v-model="values"
            :schema
            :errors
            :frame-ratio
            :locale
            :disabled="isRunning || draftPending"
            :file-uploads-disabled="!mounted"
          />
          <p
            v-if="restoreFailed"
            role="status"
            class="text-sm text-primary-warm-gray"
          >
            {{ t('workshop.form.draftRestoreFailed', locale) }}
          </p>
        </div>

        <!-- Run follows the form down the page, so a long list of inputs never
          pushes it past the bottom of a laptop screen. -->
        <div
          class="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 bg-page/85 p-3 backdrop-blur-sm"
        >
          <Button
            v-if="gate === 'signedOut'"
            as="a"
            :href="signInHref"
            size="lg"
            class="w-full px-5"
            data-testid="run-button"
            data-gate="signedOut"
            @click="leaveForSignIn($event, signInHref)"
          >
            {{ t('workshop.run.signIn', locale) }}
          </Button>
          <!-- The MVP rail (DES-1015): buying happens on platform, in a new
               tab, so this page and its inputs stay alive and the return is a
               balance re-read. Naming the workspace is what makes topping up
               the wrong wallet visible before it happens. -->
          <template v-else-if="gate === 'noCredits'">
            <p
              class="mb-2 text-sm font-bold text-content-secondary"
              data-testid="gate-note"
            >
              {{
                t('workshop.error.noCreditsCloud', locale).replace(
                  '{workspace}',
                  () => session?.workspace.name ?? ''
                )
              }}
            </p>
            <Button
              size="lg"
              class="w-full px-5"
              data-testid="run-button"
              data-gate="noCredits"
              @click="requestWorkshopBuyCredits"
            >
              {{ t('workshop.run.buyCredits', locale) }}
            </Button>
          </template>
          <template v-else-if="gate === 'memberNoCredits'">
            <div class="mb-2 flex flex-col gap-1" data-testid="gate-note">
              <p class="text-sm font-bold text-content-secondary">
                {{ t('workshop.error.creditsTitle', locale) }}
              </p>
              <p class="text-xs text-content-secondary">
                {{
                  t('workshop.error.memberNoCredits', locale).replace(
                    '{workspace}',
                    () => session?.workspace.name ?? ''
                  )
                }}
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              class="w-full px-5"
              :disabled="personalSwitchPending"
              data-testid="run-button"
              data-gate="memberNoCredits"
              @click="switchToPersonal"
            >
              {{
                t(
                  personalSwitchPending
                    ? 'workshop.run.preparingSession'
                    : 'workshop.run.switchPersonal',
                  locale
                )
              }}
            </Button>
            <p
              v-if="personalSwitchError"
              class="text-xs text-red-400"
              role="alert"
            >
              {{ t('nav.workspaceSwitchError', locale) }}
            </p>
          </template>
          <Button
            v-else-if="gate === 'ready'"
            size="lg"
            class="w-full px-5"
            data-testid="run-button"
            data-gate="ready"
            @click="isRunning ? cancelRun() : run()"
          >
            <template v-if="!isRunning" #prepend>
              <Play class="size-5 fill-current" aria-hidden="true" />
            </template>
            {{
              t(isRunning ? 'workshop.run.cancel' : 'workshop.run.run', locale)
            }}
          </Button>
          <Button
            v-else
            size="lg"
            class="h-auto min-h-14 w-full px-5 py-3 text-center whitespace-normal"
            disabled
            data-testid="run-button"
            :data-gate="gate"
          >
            {{
              t(
                gate === 'pending'
                  ? 'workshop.run.preparingSession'
                  : model.incompleteReason
                    ? 'workshop.model.notSupported'
                    : 'workshop.run.mappingUnavailable',
                locale
              )
            }}
          </Button>
        </div>
      </div>

      <div
        class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-26 lg:col-span-7 lg:self-start"
      >
        <PlaygroundOutput
          v-if="workshopEnabled || isRunning"
          v-model:revealed="revealed"
          :state="runState"
          :earlier
          :attachments
          :now
          :model-name="model.name"
          :modality="model.modality"
          :locale
          :member-workspace="
            session?.role === 'member' ? session.workspace.name : undefined
          "
          @switch-personal="switchToPersonal"
          @buy-credits="requestWorkshopBuyCredits"
          @retry="gate === 'ready' ? run() : reset()"
          @use-in-code="useInCode"
          @download="captureOutputDownload"
          @delivery="delivery.settle"
          @playback-started="delivery.beginPlayback"
        />
        <div
          v-if="runState.status === 'succeeded' || requestId"
          class="flex flex-col gap-1"
        >
          <p
            v-if="runState.status === 'succeeded'"
            class="text-xs text-primary-warm-gray"
            data-testid="output-expires"
          >
            {{ t('workshop.output.expires', locale) }}
          </p>
          <!-- The id is for the rare conversation with support, so it keeps
            to itself and the copy comes to hand when the reader reaches for
            it. A screen that cannot hover keeps the button in view. -->
          <div v-if="requestId" class="group/request flex items-center gap-1">
            <p
              class="text-2xs break-all text-primary-warm-gray/70"
              data-testid="router-request-id"
            >
              {{ t('workshop.run.requestId', locale) }} {{ requestId }}
            </p>
            <CopyTextButton
              :value="requestId"
              :label="t('workshop.run.copyRequestId', locale)"
              :copied-label="t('workshop.api.copied', locale)"
              icon-class="size-3.5"
              class="h-7 min-w-7 rounded-lg px-1.5 transition-opacity can-hover:opacity-0 can-hover:group-focus-within/request:opacity-100 can-hover:group-hover/request:opacity-100"
            />
          </div>
        </div>

        <!-- Once the result is in view, taking the workflow home is the other
          thing to do with it, and it should not shout over the run's own
          buttons. -->
        <a
          v-if="clone"
          :href="clone.href"
          download
          class="inline-flex w-fit items-center gap-2 self-end text-xs text-primary-warm-gray transition-colors hover:text-primary-warm-white"
          data-testid="clone-button"
        >
          <Download class="size-3.5" aria-hidden="true" />
          {{ t('workshop.workflow.cloneCta', locale) }}
        </a>
      </div>
    </section>

    <section
      v-if="showsExamples && activeSection === 'playground'"
      class="pt-6"
      data-testid="examples-section"
    >
      <ExamplesTab
        :examples
        :active-id="activeExampleId"
        :locale
        @open="openExample"
      />
    </section>

    <section
      v-if="activeSection === 'details'"
      id="panel-details"
      role="tabpanel"
      aria-labelledby="tab-details"
      data-testid="details-tab"
    >
      <slot name="details" />
    </section>

    <section
      v-if="activeSection === 'api'"
      id="panel-api"
      role="tabpanel"
      aria-labelledby="tab-api"
    >
      <ApiTab
        :contract="model.execution"
        :values
        :workspace-id="session?.workspace.id"
        :locale
        :model-slug="model.slug"
      />
    </section>

    <RunLeaveDialog
      :open="leavingTo !== undefined"
      :locale
      @update:open="(value: boolean) => !value && (leavingTo = undefined)"
      @leave="leaveForLink"
    />

    <ExampleReplaceDialog
      :open="replacing !== undefined"
      :locale
      @update:open="(value: boolean) => !value && (replacing = undefined)"
      @replace="replaceWithExample"
    />
  </div>
</template>
