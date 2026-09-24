<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { WorkflowWorkshopModelDetail } from '../../config/models-catalogue'
import type { RunState } from '../../config/workshop-run'
import type { WorkflowState } from '../../config/workshop-workflow-state'
import { workflowOutputs } from '../../config/workshop-workflow-response'
import { outputLabels } from '../../lib/workshop/output-labels'
import { t } from '../../i18n/translations'
import PlaygroundOutput from './PlaygroundOutput.vue'

const {
  model,
  state,
  exampleIndex,
  busy,
  statusLabel,
  canStart,
  refreshOutput
} = defineProps<{
  model: WorkflowWorkshopModelDetail
  state: WorkflowState
  exampleIndex: number
  busy: boolean
  statusLabel: string
  canStart: boolean
  refreshOutput: (id: string) => Promise<void> | undefined
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
  if (result?.run.state === 'cancelled') return { status: 'idle' }
  if (result?.run.state === 'failed')
    return { status: 'failed', reason: 'provider', fieldErrors: {} }
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
</script>

<template>
  <PlaygroundOutput
    :state="outputState"
    :attachments="outputs.slice(1)"
    :now="now.getTime()"
    :model-name="model.name"
    :modality="model.modality"
    :retry-disabled="!canStart"
    refreshable
    @retry="emit('retry')"
    @refresh="refreshUrl"
    @delivery="onDelivery"
  >
    <template #example-hint>{{ t('workshop.workflow.exampleHint') }}</template>
  </PlaygroundOutput>
  <p
    v-if="observation?.run.state === 'cancelled'"
    role="status"
    class="text-sm text-primary-warm-gray"
  >
    {{ t('workshop.workflow.cancelRequested') }}
  </p>
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
