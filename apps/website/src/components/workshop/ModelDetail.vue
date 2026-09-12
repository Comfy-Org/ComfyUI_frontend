<script setup lang="ts">
import { Download } from '@lucide/vue'
import { useMounted, useTimestamp } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, useSlots, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useSignInHref } from '../../composables/useSignInHref'
import { useTablist } from '../../composables/useTablist'
import type { WorkshopModelDetail } from '../../config/models-catalogue'
import type {
  FieldErrors,
  FormValues,
  PlaygroundExample
} from '../../config/workshop-playground'
import {
  isVideoUrl,
  restoreFormValues,
  schemaForModel,
  urlUploadField,
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
import { WORKSHOP_CREDITS_URL } from '../../config/workshop-env'
import { router_render } from '../../config/router-render'
import { createWorkshopUrlUploader } from '../../config/workshop-url-upload'
import { WorkshopRouterError } from '../../config/workshop-router-errors'
import { releaseRouterOutputs } from '../../config/workshop-response'
import { retainRunHistory } from '../../config/workshop-run-history'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { workshopIdempotencyKey } from '../../config/workshop-snippets'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  useWorkshopAuthFlag,
  useWorkshopAuthFlagSettled
} from '../../scripts/posthog'
import ApiTab from './ApiTab.vue'
import ExamplesTab from './ExamplesTab.vue'
import PlaygroundForm from './PlaygroundForm.vue'
import PlaygroundOutput from './PlaygroundOutput.vue'
import ModelSupport from './ModelSupport.vue'

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

type Section = 'playground' | 'details' | 'api'
const sections = computed<readonly Section[]>(() =>
  slots.details ? ['playground', 'details', 'api'] : ['playground', 'api']
)
const sectionLabel: Record<Section, TranslationKey> = {
  playground: 'workshop.model.tabs.playground',
  details: 'workshop.model.tabs.details',
  api: 'workshop.model.tabs.api'
}

const activeSection = ref<Section>('playground')
const { onKeydown: onTabKeydown } = useTablist(
  () => sections.value,
  activeSection
)

const initialPageState = initialWorkshopPageState(model)
const examples = initialPageState.examples
// A workflow page describes one workflow, so the model's other examples would
// be beside the point there.
const showsExamples = computed(() => !slots.details && examples.length > 0)
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
const authEnabled = useWorkshopAuthFlag()
const authFlagSettled = useWorkshopAuthFlagSettled()
const mounted = useMounted()
const signInHref = useSignInHref(locale)
const gate = computed(() => {
  if (
    model.incompleteReason ||
    import.meta.env.PUBLIC_WORKSHOP_ROUTER_RUN !== '1' ||
    !model.execution ||
    activeExample.value?.fields ||
    clone
  )
    return 'unavailable'
  if (!mounted.value || !authFlagSettled.value) return 'pending'
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
const hasFileInputs = computed(() =>
  schema.value.some((field) => field.kind === 'file' || urlUploadField(field))
)
const requestId = ref<string | null>(null)
let controller: AbortController | undefined
let pendingRequest: { fingerprint: string; key: string } | undefined
const uploadUrl = createWorkshopUrlUploader()

const now = useTimestamp({ interval: 1000 })

function cancelRun() {
  controller?.abort()
  controller = undefined
  runState.value = transition(runState.value, { type: 'cancel' })
}

async function switchToPersonal() {
  const result = await remint()
  if (result?.status === 'ok') await refreshWorkshopCredits({ force: true })
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

async function run() {
  if (
    isRunning.value ||
    gate.value !== 'ready' ||
    !session.value ||
    !model.execution
  )
    return
  const fieldErrors = validateForm(schema.value, values.value)
  if (Object.keys(fieldErrors).length) {
    runState.value = transition(runState.value, {
      type: 'fail',
      reason: 'validation',
      fieldErrors
    })
    return
  }
  const startedFor = session.value
  const active = new AbortController()
  controller = active
  requestId.value = null
  runState.value = transition(runState.value, { type: 'start', at: Date.now() })
  async function freshCredential() {
    const credential = await ensureFresh(undefined, { signal: active.signal })
    active.signal.throwIfAborted()
    if (
      credential?.status !== 'ok' ||
      credential.session.uid !== startedFor.uid ||
      credential.session.workspace.id !== startedFor.workspace.id
    )
      throw new WorkshopRouterError('unavailable')
    return credential.session
  }
  try {
    const result = await router_render(
      model.slug,
      {},
      {
        model,
        form: { schema: schema.value, values: values.value },
        signal: active.signal,
        token: async () => (await freshCredential()).token,
        uploadFile: async (file, signal) => {
          const credential = await freshCredential()
          return uploadUrl(
            file,
            credential.token,
            JSON.stringify([startedFor.uid, startedFor.workspace.id]),
            signal
          )
        },
        idempotencyKey: (body) => {
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
      }
    )
    if (controller !== active || active.signal.aborted) {
      releaseRouterOutputs(result.outputs)
      return
    }
    pendingRequest = undefined
    requestId.value = result.requestId
    const [output, ...attachments] = result.outputs
    if (!output) throw new WorkshopRouterError('provider', result.requestId)
    const { retained, discarded } = retainRunHistory([
      { output, attachments },
      ...runs.value
    ])
    runs.value = retained
    releaseRouterOutputs(
      discarded.flatMap((run) => [run.output, ...run.attachments])
    )
    runState.value = transition(runState.value, {
      type: 'complete',
      at: Date.now(),
      output,
      nsfw: output.nsfw === true
    })
  } catch (error) {
    if (controller !== active || active.signal.aborted) return
    const failure =
      error instanceof WorkshopRouterError
        ? error
        : new WorkshopRouterError('provider')
    requestId.value = failure.requestId
    runState.value = transition(runState.value, {
      type: 'fail',
      reason: failure.reason,
      fieldErrors: failure.fieldErrors
    })
  } finally {
    if (controller === active) controller = undefined
    void refreshWorkshopCredits({ force: true })
  }
}

// Keeps the form intact across a sign-in or a top-up round trip.
const storageKey = `comfy-workshop-form:${model.slug}`
onMounted(() => {
  try {
    nativeJson.value =
      !!model.execution &&
      model.execution.inputs === undefined &&
      sessionStorage.getItem(`${storageKey}:mode`) === 'json'
    const stored = sessionStorage.getItem(storageKey)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      values.value = {
        ...values.value,
        ...restoreFormValues(schema.value, parsed)
      }
    }
  } catch {
    /* storage unavailable */
  }
})
watch(
  values,
  (next) => {
    try {
      const persistable = Object.fromEntries(
        Object.entries(next)
          .filter(([, value]) => typeof value !== 'object')
          .map(([name, value]) => [name, value === undefined ? null : value])
      )
      sessionStorage.setItem(storageKey, JSON.stringify(persistable))
      sessionStorage.setItem(
        `${storageKey}:mode`,
        nativeJson.value ? 'json' : 'form'
      )
    } catch {
      /* storage unavailable */
    }
  },
  { deep: true }
)

function reset() {
  cancelRun()
  runState.value = IDLE
}

function openExample(example: PlaygroundExample) {
  if (isRunning.value) return
  if (!example.sampleOnly) {
    nativeJson.value = false
    activeExample.value = example.fields ? example : undefined
    values.value = workshopExampleState(model, example).values
  }
  activeExampleId.value = example.id
  runState.value = { status: 'example', output: exampleOutput(example) }
  activeSection.value = 'playground'
}

function useInCode() {
  activeSection.value = 'api'
}
</script>

<template>
  <div class="flex flex-col gap-10" data-testid="model-detail">
    <div
      role="tablist"
      :aria-label="t('workshop.title', locale)"
      class="flex scrollbar-hide gap-8 overflow-x-auto border-b border-transparency-white-t8 max-sm:gap-5"
      data-testid="model-tabs"
      @keydown="onTabKeydown"
    >
      <button
        v-for="section in sections"
        :id="`tab-${section}`"
        :key="section"
        type="button"
        role="tab"
        :aria-selected="section === activeSection"
        :aria-controls="`panel-${section}`"
        :tabindex="section === activeSection ? 0 : -1"
        :data-testid="`tab-${section}`"
        :class="
          cn(
            'cursor-pointer border-b-2 pb-3 text-sm font-bold tracking-wider uppercase transition-colors',
            section === activeSection
              ? 'border-primary-comfy-yellow text-primary-warm-white'
              : 'border-transparent text-primary-warm-gray hover:text-primary-warm-white'
          )
        "
        @click="activeSection = section"
      >
        {{ t(sectionLabel[section], locale) }}
      </button>
    </div>

    <section
      v-if="activeSection === 'playground'"
      id="panel-playground"
      role="tabpanel"
      aria-labelledby="tab-playground"
      class="grid gap-8 lg:grid-cols-12"
      data-testid="playground-tab"
    >
      <div
        class="bg-transparency-white-t4 flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 lg:col-span-5"
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
            :disabled="isRunning"
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
          class="animate-soft-in flex flex-col gap-6 p-5"
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
            :locale
            :disabled="isRunning"
            :file-uploads-disabled="!mounted || !session"
          />
          <p
            v-if="hasFileInputs && gate === 'signedOut'"
            class="text-sm text-primary-warm-gray"
          >
            {{ t('workshop.form.signInBeforeUpload', locale) }}
          </p>
        </div>

        <!-- Run follows the form down the page, so a long list of inputs never
          pushes it past the bottom of a laptop screen. -->
        <div
          class="bg-page/85 sticky bottom-0 z-10 mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 p-3 backdrop-blur-sm"
        >
          <Button
            v-if="gate === 'signedOut'"
            as="a"
            :href="signInHref"
            size="lg"
            class="w-full px-5"
            data-testid="run-button"
            data-gate="signedOut"
          >
            {{ t('workshop.run.signIn', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'noCredits'"
            as="a"
            :href="WORKSHOP_CREDITS_URL"
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            class="w-full px-5"
            data-testid="run-button"
            data-gate="noCredits"
          >
            {{ t('nav.buyCredits', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'memberNoCredits'"
            size="lg"
            class="w-full px-5"
            @click="switchToPersonal"
          >
            {{ t('workshop.run.switchPersonal', locale) }}
          </Button>
          <Button
            v-else-if="gate === 'ready'"
            size="lg"
            class="w-full px-5"
            data-testid="run-button"
            data-gate="ready"
            @click="isRunning ? cancelRun() : run()"
          >
            {{
              t(isRunning ? 'workshop.run.cancel' : 'workshop.run.run', locale)
            }}
          </Button>
          <Button
            v-else
            size="lg"
            class="w-full px-5"
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
          <p
            v-if="gate === 'noCredits' || gate === 'memberNoCredits'"
            role="status"
            class="text-center text-sm text-primary-warm-gray"
          >
            {{
              gate === 'memberNoCredits'
                ? t('workshop.error.memberNoCredits', locale).replace(
                    '{workspace}',
                    session?.workspace.name ?? ''
                  )
                : t('workshop.error.noCredits', locale)
            }}
          </p>
        </div>
      </div>

      <div
        class="flex min-w-0 flex-col gap-4 lg:sticky lg:top-26 lg:col-span-7 lg:self-start"
      >
        <PlaygroundOutput
          v-model:revealed="revealed"
          :state="runState"
          :earlier
          :attachments
          :now
          :modality="model.modality"
          :locale
          :member-workspace="
            session?.role === 'member' ? session.workspace.name : undefined
          "
          @switch-personal="switchToPersonal"
          @retry="gate === 'ready' ? run() : reset()"
          @use-in-code="useInCode"
        />
        <p
          v-if="requestId"
          class="text-xs break-all text-primary-warm-gray"
          data-testid="router-request-id"
        >
          {{ t('workshop.run.requestId', locale) }} {{ requestId }}
        </p>

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
      <ApiTab :contract="model.execution" :values :locale />
    </section>
  </div>
</template>
