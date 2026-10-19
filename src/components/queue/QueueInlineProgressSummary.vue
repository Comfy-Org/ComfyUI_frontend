<template>
  <div v-if="shouldShow" class="flex justify-end">
    <div
      class="flex items-center text-[0.75rem] leading-[normal] whitespace-nowrap drop-shadow-md"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="flex items-center">
        <span class="font-normal">
          {{ t('sideToolbar.queueProgressOverlay.inlineTotalLabel') }}:
        </span>
        <span class="w-[5ch] shrink-0 text-right font-bold tabular-nums">
          {{ totalPercentFormatted }}
        </span>
      </div>

      <div class="flex items-center text-right text-muted-foreground">
        <span class="w-[16ch] shrink-0 truncate" :title="currentNodeName">
          {{ currentNodeName }}:
        </span>
        <span class="w-[5ch] shrink-0 tabular-nums">
          {{ currentNodePercentFormatted }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useExecutionStore } from '@/stores/executionStore'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'

const props = defineProps<{
  hidden?: boolean
}>()

const { t } = useI18n()

const executionStore = useExecutionStore()
const {
  totalPercent,
  totalPercentFormatted,
  currentNodePercent,
  currentNodePercentFormatted
} = useQueueProgress()

const currentNodeName = computed(() => {
  return resolveNodeDisplayName(executionStore.executingNode, {
    emptyLabel: t('g.emDash'),
    untitledLabel: t('g.untitled')
  })
})

const shouldShow = computed(
  () =>
    !props.hidden &&
    (!executionStore.isIdle ||
      totalPercent.value > 0 ||
      currentNodePercent.value > 0)
)
</script>
