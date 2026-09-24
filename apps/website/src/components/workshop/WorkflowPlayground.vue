<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'
import { computed, onScopeDispose, ref, watch } from 'vue'

import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import {
  restoreFormValues,
  urlUploadField
} from '../../config/workshop-playground'
import { WorkshopWorkflowError } from '../../config/workshop-workflow-api'
import type { WorkflowRunSummary } from '../../config/workshop-workflow-response'
import {
  workflowErrorKey,
  workflowStatusKey
} from '../../config/workshop-workflow-presentation'
import { useTablist } from '../../composables/useTablist'
import { useWorkflowFormDraft } from '../../composables/useWorkflowFormDraft'
import { useWorkflowRun } from '../../composables/useWorkflowRun'
import { t } from '../../i18n/translations'
import {
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import PlaygroundForm from './PlaygroundForm.vue'
import WorkflowResults from './WorkflowResults.vue'
import WorkflowRunControls from './WorkflowRunControls.vue'
import WorkflowHistory from './WorkflowHistory.vue'
import WorkflowPreview from './WorkflowPreview.vue'
import WorkflowApi from './WorkflowApi.vue'

const { model, scope, exampleIndex, cloudHref } = defineProps<{
  model: WorkflowWorkshopModelDetail
  scope: string
  exampleIndex: number
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
const { state, observation, history, signedIn, identitySettled } = workflow
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
  () =>
    ('record' in state.value && state.value.record.cancelRequested) ||
    Boolean(observation.value?.run.cancelRequestedAt)
)
const error = computed(() =>
  'error' in state.value
    ? state.value.error
    : observation.value?.run.error
      ? new WorkshopWorkflowError(observation.value.run.error.code)
      : undefined
)
const fieldErrors = computed(() => error.value?.fieldErrors ?? {})
const statusLabel = computed(() => {
  if (cancelRequested.value && busy.value)
    return t('workshop.workflow.cancelling')
  if (state.value.phase === 'preparing') return t('workshop.workflow.preparing')
  if (state.value.phase === 'interrupted')
    return t('workshop.workflow.interrupted')
  return observation.value
    ? t(workflowStatusKey(observation.value.run, observation.value.runtime))
    : t('workshop.workflow.submitting')
})

function start() {
  if (!canStart.value) return
  void workflow.start(values.value)
}

function openRun(run: WorkflowRunSummary) {
  if (busy.value) return
  void workflow.open(run)
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
      :tabindex="section === item ? 0 : -1"
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
          <p v-if="error" role="alert" class="text-sm text-primary-comfy-red">
            {{ t(workflowErrorKey(error)) }}
          </p>
          <WorkflowRunControls
            :state="state"
            :signed-in="signedIn"
            :can-start="canStart"
            :status-label="statusLabel"
            @resume="workflow.resume()"
            @cancel="workflow.cancel()"
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
        :example-index="exampleIndex"
        :busy="busy"
        :status-label="statusLabel"
        :can-start="canStart"
        :refresh-output="workflow.refreshOutput"
        @retry="start"
        @retry-delivery="workflow.retryDelivery()"
      />
      <WorkflowHistory
        v-if="signedIn"
        :history="history"
        :busy="busy"
        :selected-run-id="selectedRunId"
        @open="openRun"
        @refresh="workflow.loadHistory()"
        @more="workflow.loadHistory(true)"
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
</template>
