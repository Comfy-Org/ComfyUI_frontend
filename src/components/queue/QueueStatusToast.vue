<template>
  <ProcessToast
    v-if="hasActiveJob"
    data-testid="queue-status-toast"
    class="pointer-events-auto"
    :verb="t('g.running')"
    :percent="totalPercent"
    status="progress"
    :failed-count="0"
    :expanded="expanded"
    @toggle-expand="expanded = !expanded"
  >
    <template #action>
      <div
        class="mx-0.5 h-5 w-px shrink-0 self-center bg-interface-stroke"
        aria-hidden="true"
      />
      <Button
        v-tooltip.bottom="stopTooltip"
        variant="textonly"
        size="sm"
        class="gap-1 text-text-secondary"
        :aria-label="t('processToast.stop')"
        data-testid="queue-status-stop"
        @click="interruptAll"
      >
        <i class="icon-[lucide--square] size-4 shrink-0" />
        {{ t('processToast.stop') }}
      </Button>
    </template>
  </ProcessToast>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ProcessToast from '@/components/common/ProcessToast.vue'
import Button from '@/components/ui/button/Button.vue'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

const { t } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { totalPercent } = useQueueProgress()

const expanded = ref(false)

const runningCount = computed(() => queueStore.runningTasks.length)
const isExecuting = computed(() => !executionStore.isIdle)
const hasActiveJob = computed(() => runningCount.value > 0 || isExecuting.value)

const stopTooltip = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.interruptAll'))
)

const interruptAll = wrapWithErrorHandlingAsync(async () => {
  const jobIds = queueStore.runningTasks
    .map((task) => task.jobId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (!jobIds.length) return

  // State-agnostic batch cancel (see api.ts cancelJobs for the runtime-parity caveat).
  await api.cancelJobs(jobIds)
  executionStore.clearInitializationByJobIds(jobIds)
  await queueStore.update()
})
</script>
