<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'
import { useMounted } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'

import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import {
  initialWorkshopPageState,
  workshopExampleState
} from '../../config/workshop-page-state'
import {
  restoreFormValues,
  urlUploadField
} from '../../config/workshop-playground'
import { WorkshopWorkflowError } from '../../config/workshop-workflow-api'
import {
  workflowErrorKey,
  workflowStatusKey
} from '../../config/workshop-workflow-presentation'
import { workflowRunFailure } from '../../lib/workshop/workflow-refusal'
import { useTablist } from '../../composables/useTablist'
import { useWorkflowFormDraft } from '../../composables/useWorkflowFormDraft'
import { useWorkflowRun } from '../../composables/useWorkflowRun'
import { t } from '../../i18n/translations'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import { workshopModelAnalytics } from '../../scripts/workshop-analytics'
import { sameFormValues } from '../../lib/workshop/form-values'
import ExampleReplaceDialog from './ExampleReplaceDialog.vue'
import PlaygroundForm from './PlaygroundForm.vue'
import WorkflowResults from './WorkflowResults.vue'
import WorkflowRunControls from './WorkflowRunControls.vue'
import WorkflowPreview from './WorkflowPreview.vue'
import WorkflowApi from './WorkflowApi.vue'
import WorkflowExamplePreview from './WorkflowExamplePreview.vue'

const { model, scope, cloudHref } = defineProps<{
  model: WorkflowWorkshopModelDetail
  scope: string
  cloudHref?: string
}>()
const emit = defineEmits<{ recovery: [active: boolean] }>()
const sections = ['playground', 'workflow', 'api'] as const
const section = ref<(typeof sections)[number]>('playground')
const { onKeydown } = useTablist(() => sections, section)
const sectionLabels = {
  playground: 'workshop.model.tabs.playground',
  workflow: 'workshop.workflow.graph',
  api: 'workshop.model.tabs.api'
} as const
const initial = initialWorkshopPageState(model)
const values = ref(initial.values)
const settledValues = ref(initial.values)
const selectedExample = ref(0)
const replacing = ref<number>()
const schema = computed(() => initial.schema)
const workflow = useWorkflowRun(model, scope, (inputs) => {
  values.value = {
    ...values.value,
    ...restoreFormValues(
      initial.schema.filter(
        (field) => field.kind !== 'file' && !urlUploadField(field)
      ),
      inputs
    )
  }
})
const { state, observation, signedIn, identitySettled } = workflow
watch(
  () => 'record' in state.value,
  (active) => emit('recovery', active)
)
onScopeDispose(() => emit('recovery', false))
const draft = useWorkflowFormDraft(
  model.slug,
  scope,
  schema,
  values,
  ref(false)
)
const enabled = useWorkshopEnabled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const mounted = useMounted()
const modelAnalytics = workshopModelAnalytics(model)
watch(
  () => mounted.value && enabled.value && workflowsEnabled.value,
  (visible) => {
    if (visible)
      captureWorkshopEvent({ name: 'model_viewed', properties: modelAnalytics })
  },
  { once: true }
)
watch([section, enabled, workflowsEnabled], ([active, enabled, workflows]) => {
  if (enabled && workflows && active === 'api')
    captureWorkshopEvent({ name: 'api_viewed', properties: modelAnalytics })
})
const busy = computed(() =>
  ['preparing', 'active', 'interrupted'].includes(state.value.phase)
)
const admissionPaused = computed(
  () => !enabled.value || !workflowsEnabled.value
)
const formDisabled = computed(
  () => !identitySettled.value || busy.value || draft.pending.value
)
const selectedRunId = computed(() => observation.value?.run.id)
const canStart = computed(
  () =>
    signedIn.value &&
    !admissionPaused.value &&
    model.type === 'CLOUD' &&
    !busy.value &&
    !draft.pending.value
)
const cancelRequested = computed(
  () => 'record' in state.value && state.value.record.cancelRequested
)
const error = computed(() =>
  'error' in state.value
    ? state.value.error
    : observation.value?.run.state === 'failed'
      ? new WorkshopWorkflowError('execution_failed')
      : undefined
)
const fieldErrors = computed(() => error.value?.fieldErrors ?? {})
// The output panel stands up the refusals it has words for, so saying those
// again beside the form hands the reader the same thing twice — and twice in
// different words wherever the two vocabularies disagree. What is left here is
// what only this page can say.
const refusalSaidHere = computed(() => {
  if (!error.value) return undefined
  const inThePanel =
    state.value.phase === 'failed' && workflowRunFailure(error.value)
  return inThePanel ? undefined : t(workflowErrorKey(error.value))
})
const statusLabel = computed(() => {
  if (cancelRequested.value && busy.value)
    return t('workshop.workflow.cancelling')
  if (state.value.phase === 'preparing') return t('workshop.workflow.preparing')
  if (state.value.phase === 'interrupted')
    return t('workshop.workflow.interrupted')
  return observation.value
    ? t(workflowStatusKey(observation.value.run))
    : t('workshop.workflow.submitting')
})

function tabIndex(item: (typeof sections)[number]): number {
  return section.value === item ? 0 : -1
}

function selectExample(index: number) {
  const example = initial.examples[index]
  if (!example || formDisabled.value) return
  if (
    !example.sampleOnly &&
    !sameFormValues(values.value, settledValues.value)
  ) {
    replacing.value = index
    return
  }
  applyExample(index)
}

function applyExample(index: number) {
  const example = initial.examples[index]
  if (!example || formDisabled.value) return
  if (!example.sampleOnly) {
    values.value = workshopExampleState(model, example).values
    settledValues.value = values.value
  }
  replacing.value = undefined
  selectedExample.value = index
  workflow.dismiss()
  section.value = 'playground'
}

function updateExampleDialog(open: boolean) {
  if (!open) replacing.value = undefined
}

function confirmExample() {
  if (replacing.value !== undefined) applyExample(replacing.value)
}

function start() {
  if (!canStart.value) return
  void workflow.start(values.value)
}
</script>

<template>
  <div
    role="tablist"
    :aria-label="t('workshop.workflow.sections')"
    class="mb-6 flex gap-7 border-b border-transparency-white-t8"
    @keydown="onKeydown"
  >
    <button
      v-for="item in sections"
      :id="`workflow-tab-${item}`"
      :key="item"
      type="button"
      role="tab"
      :aria-selected="section === item"
      :aria-controls="`workflow-panel-${item}`"
      :tabindex="tabIndex(item)"
      class="min-h-12 cursor-pointer border-b-2 border-transparent px-1 text-sm font-medium text-primary-warm-gray transition-colors hover:text-primary-comfy-yellow aria-selected:border-primary-comfy-yellow aria-selected:text-primary-comfy-canvas aria-selected:hover:text-primary-comfy-yellow"
      @click="section = item"
    >
      {{ t(sectionLabels[item]) }}
    </button>
  </div>
  <div
    v-show="section === 'playground'"
    id="workflow-panel-playground"
    role="tabpanel"
    aria-labelledby="workflow-tab-playground"
    class="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
  >
    <section
      class="overflow-hidden rounded-2xl border border-transparency-white-t20"
      aria-labelledby="workflow-inputs-heading"
    >
      <form @submit.prevent="start">
        <div class="space-y-6 p-5 lg:p-6">
          <div>
            <h2
              id="workflow-inputs-heading"
              class="text-lg font-medium text-primary-comfy-canvas"
            >
              {{ t('workshop.workflow.makeYours') }}
            </h2>
            <p class="mt-1 text-sm text-primary-warm-gray">
              {{ t('workshop.workflow.inputHint') }}
            </p>
          </div>
          <PlaygroundForm
            v-model="values"
            :schema="initial.schema"
            :errors="fieldErrors"
            :disabled="formDisabled"
          />
          <p
            v-if="draft.restoreFailed.value"
            role="alert"
            class="text-sm text-primary-warm-gray"
          >
            {{ t('workshop.form.draftRestoreFailed') }}
          </p>
        </div>
        <div class="space-y-3 border-t border-transparency-white-t8 p-5 lg:p-6">
          <p class="text-xs/relaxed text-primary-warm-gray">
            {{ t('workshop.workflow.cloudBilling') }}
          </p>
          <p
            v-if="admissionPaused"
            role="status"
            class="text-sm text-primary-warm-gray"
          >
            {{ t('workshop.workflow.paused') }}
          </p>
          <p
            v-if="refusalSaidHere"
            role="alert"
            class="text-sm text-primary-comfy-red"
          >
            {{ refusalSaidHere }}
          </p>
          <WorkflowRunControls
            :state="state"
            :signed-in="signedIn"
            :can-start="canStart"
            :status-label="statusLabel"
            @resume="workflow.resume()"
            @cancel="workflow.cancel()"
            @dismiss="workflow.dismiss()"
          />
          <a
            v-if="cloudHref"
            :href="cloudHref"
            target="_blank"
            rel="noopener"
            class="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-transparency-white-t20 text-sm font-medium text-primary-comfy-canvas hover:bg-transparency-white-t8"
            >{{ t('workshop.workflow.tryCloud')
            }}<ArrowUpRight class="size-4" aria-hidden="true"
          /></a>
        </div>
      </form>
    </section>
    <div class="space-y-4 lg:sticky lg:top-24">
      <WorkflowResults
        :key="selectedRunId"
        :model="model"
        :state="state"
        :example-index="selectedExample"
        :busy="busy"
        :status-label="statusLabel"
        :can-start="canStart"
        :refresh-output="workflow.refreshOutput"
        :analytics="workflow.analytics.value"
        :visible="section === 'playground'"
        @retry="start"
        @retry-delivery="workflow.retryDelivery()"
      />
    </div>
  </div>
  <WorkflowPreview
    v-show="section === 'workflow'"
    :model="model"
    :cloud-href="cloudHref"
  />
  <div
    v-show="section === 'api'"
    id="workflow-panel-api"
    role="tabpanel"
    aria-labelledby="workflow-tab-api"
  >
    <WorkflowApi :model="model" :values="values" />
  </div>
  <section
    v-if="model.examples.length"
    class="mt-14"
    aria-labelledby="workflow-examples-heading"
  >
    <h2
      id="workflow-examples-heading"
      class="mb-5 text-2xl font-light text-primary-comfy-canvas"
    >
      {{ t('workshop.workflow.explore') }}
    </h2>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="(example, index) in model.examples"
        :key="example.name"
        type="button"
        :aria-pressed="selectedExample === index"
        class="cursor-pointer overflow-hidden rounded-2xl border border-transparency-white-t8 text-left hover:border-primary-comfy-yellow focus-visible:outline-primary-comfy-yellow disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="formDisabled"
        @click="selectExample(index)"
      >
        <WorkflowExamplePreview :example :poster="model.thumbnailUrl" />
        <span class="block p-4 text-sm text-primary-warm-gray">
          {{ example.title }}
        </span>
      </button>
    </div>
  </section>
  <ExampleReplaceDialog
    :open="replacing !== undefined"
    @update:open="updateExampleDialog"
    @replace="confirmExample"
  />
</template>
