<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import type { RunOutput, RunState } from '../../config/workshop-run'
import { useWorkshopDelivery } from '../../composables/useWorkshopDelivery'
import type { WorkflowState } from '../../config/workshop-workflow-state'
import { workflowOutputs } from '../../config/workshop-workflow-response'
import { outputLabels } from '../../lib/workshop/output-labels'
import { requestWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import { workflowRunFailure } from '../../lib/workshop/workflow-refusal'
import { t } from '../../i18n/translations'
import { captureWorkshopEvent } from '../../scripts/posthog'
import type { WorkshopRunAnalytics } from '../../scripts/workshop-analytics'
import { workshopModelAnalytics } from '../../scripts/workshop-analytics'
import PlaygroundOutput from './PlaygroundOutput.vue'

const {
  model,
  state,
  exampleIndex,
  busy,
  statusLabel,
  canStart,
  refreshOutput,
  analytics,
  visible = true
} = defineProps<{
  model: WorkflowWorkshopModelDetail
  state: WorkflowState
  exampleIndex: number
  busy: boolean
  statusLabel: string
  canStart: boolean
  refreshOutput: (id: string) => Promise<void> | undefined
  analytics?: WorkshopRunAnalytics
  visible?: boolean
}>()
const emit = defineEmits<{ retry: []; retryDelivery: [] }>()
const now = useNow({ interval: 1000 })
const observation = computed(() =>
  'observation' in state ? state.observation : undefined
)
const runningState = computed<RunState>(() => ({
  status: 'running',
  startedAt: Date.parse(
    observation.value?.run.startedAt ??
      observation.value?.run.createdAt ??
      now.value.toISOString()
  ),
  label: statusLabel
}))
const outputs = computed(() =>
  observation.value ? workflowOutputs(observation.value) : []
)
const outputState = computed<RunState>(() => {
  const result = observation.value
  if (result?.run.state === 'succeeded' && outputs.value[0]) {
    return {
      status: 'succeeded',
      output: outputs.value[0],
      nsfw: false,
      completedAt: Date.parse(result.run.completedAt ?? result.run.updatedAt)
    }
  }
  // A run the reader stopped used to leave an empty panel, so the one state
  // they caused was the one the page said nothing about.
  if (result?.run.state === 'cancelled') return { status: 'cancelled' }
  if (result?.run.state === 'failed')
    return { status: 'failed', reason: 'provider', fieldErrors: {} }
  // A request Cloud turned down used to fall through to the example, so the
  // panel showed what the workflow makes while the run had just been refused.
  if (state.phase === 'failed') {
    const reason = workflowRunFailure(state.error)
    if (reason)
      return { status: 'failed', reason, fieldErrors: state.error.fieldErrors }
  }
  if (busy) return runningState.value
  if (state.phase === 'settled') return { status: 'idle' }
  return exampleState.value
})
const exampleState = computed<RunState>(() => {
  const example = model.examples[exampleIndex]
  return example
    ? {
        status: 'example',
        output: {
          kind: example.mediaKind ?? 'image',
          url: example.thumbnailUrl,
          fileName: example.name
        }
      }
    : { status: 'idle' }
})
const retryableDelivery = computed(
  () =>
    observation.value?.run.state === 'succeeded' &&
    ['partial', 'failed'].includes(observation.value.run.outputState)
)
const refreshing = ref<ReadonlySet<string>>(new Set())
const failedMedia = ref<ReadonlySet<string>>(new Set())
const automaticRefreshes = new Set<string>()
const delivery = useWorkshopDelivery()
let deliveryRunId: string | undefined
watch(
  () => [state, analytics, visible] as const,
  () => {
    if (!visible || state.phase !== 'settled') {
      delivery.cancel()
      return
    }
    const result = observation.value
    if (
      !analytics ||
      result?.run.state !== 'succeeded' ||
      deliveryRunId === result.run.id
    )
      return
    deliveryRunId = result.run.id
    const output = outputs.value[0]
    if (output) delivery.start(analytics, result.run.id, output)
    else
      captureWorkshopEvent({
        name: 'delivery_finished',
        properties: {
          ...analytics,
          request_id: result.run.id,
          duration_ms: 0,
          output_kind: model.modality ?? 'other',
          status: 'failed',
          reason: 'media_error',
          failure_stage: 'delivery'
        }
      })
  },
  { immediate: true }
)
const unavailableOutputs = computed(() => {
  const items = observation.value?.outputs ?? []
  const labels = outputLabels(items)
  return items.flatMap((output, index) =>
    failedMedia.value.has(output.id) || output.delivery.state === 'failed'
      ? [{ output, label: labels[index] }]
      : []
  )
})

async function refreshAccess(id: string) {
  if (refreshing.value.has(id)) return
  refreshing.value = new Set([...refreshing.value, id])
  try {
    await refreshOutput(id)
  } finally {
    refreshing.value = new Set(
      [...refreshing.value].filter((value) => value !== id)
    )
  }
}

function refreshUrl(url: string) {
  const output = outputs.value.find((item) => item.url === url)
  if (output?.id) void refreshAccess(output.id)
}

function onDelivery(url: string, status: 'succeeded' | 'failed' | 'cancelled') {
  delivery.settle(url, status)
  const id = outputs.value.find((item) => item.url === url)?.id
  if (!id || status === 'cancelled') return
  failedMedia.value =
    status === 'failed'
      ? new Set([...failedMedia.value, id])
      : new Set([...failedMedia.value].filter((value) => value !== id))
  if (status === 'failed' && !automaticRefreshes.has(id)) {
    automaticRefreshes.add(id)
    void refreshAccess(id)
  }
}

function captureDownload(kind: RunOutput['kind']) {
  captureWorkshopEvent({
    name: 'output_download_clicked',
    properties: { ...workshopModelAnalytics(model), output_kind: kind }
  })
}
</script>

<template>
  <PlaygroundOutput
    :state="outputState"
    :attachments="outputs.slice(1)"
    :now="now.getTime()"
    :model-name="model.name"
    :modality="model.modality"
    :retry-disabled="!canStart"
    :cancelled-message="t('workshop.workflow.cancelled')"
    refreshable
    @retry="emit('retry')"
    @buy-credits="requestWorkshopBuyCredits"
    @refresh="refreshUrl"
    @delivery="onDelivery"
    @playback-started="delivery.beginPlayback"
    @download="captureDownload"
  >
    <template #example-hint>{{ t('workshop.workflow.exampleHint') }}</template>
  </PlaygroundOutput>
  <div
    v-if="retryableDelivery || failedMedia.size"
    class="space-y-3 rounded-xl border border-transparency-white-t20 p-4"
  >
    <p role="status" class="text-sm text-primary-warm-gray">
      {{ t('workshop.workflow.deliveryFailed') }}
    </p>
    <Button
      v-if="retryableDelivery"
      variant="outline"
      class="min-h-11"
      @click="emit('retryDelivery')"
      >{{ t('workshop.workflow.retryDelivery') }}</Button
    >
    <ul class="space-y-2">
      <li
        v-for="{ output, label } in unavailableOutputs"
        :key="output.id"
        class="flex flex-wrap items-center justify-between gap-2 text-sm text-primary-warm-gray"
      >
        <span>{{ t(label.key) }} {{ label.ordinal }}</span>
        <Button
          variant="outline"
          class="min-h-11"
          :disabled="refreshing.has(output.id)"
          @click="refreshAccess(output.id)"
          >{{ t('workshop.output.refreshLink') }}</Button
        >
      </li>
    </ul>
  </div>
</template>
