<template>
  <div v-if="shouldShow" class="flex justify-end">
    <div
      class="flex items-center whitespace-nowrap text-[0.75rem] leading-[normal] drop-shadow-[1px_1px_8px_rgba(0,0,0,0.4)]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="flex items-center text-base-foreground">
        <span class="font-normal">
          {{ t('sideToolbar.queueProgressOverlay.inlineTotalLabel') }}:
        </span>
        <span class="w-[5ch] shrink-0 text-right font-bold tabular-nums">
          {{ totalPercentFormatted }}
        </span>
      </div>

      <div class="flex items-center text-muted-foreground">
        <span
          class="w-[16ch] shrink-0 truncate text-right"
          :title="currentNodeName"
        >
          {{ currentNodeName }}:
        </span>
        <span class="w-[5ch] shrink-0 text-right tabular-nums">
          {{ currentNodePercentFormatted }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { st } from '@/i18n'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useExecutionStore } from '@/stores/executionStore'
import { normalizeI18nKey } from '@/utils/formatUtil'

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
  const node = executionStore.executingNode
  if (!node) return t('g.emDash')
  const title = (node.title ?? '').toString().trim()
  if (title) return title
  const nodeType = (node.type ?? '').toString().trim() || t('g.untitled')
  const key = `nodeDefs.${normalizeI18nKey(nodeType)}.display_name`
  return st(key, nodeType)
})

const shouldShow = computed(
  () =>
    !props.hidden &&
    (!executionStore.isIdle ||
      totalPercent.value > 0 ||
      currentNodePercent.value > 0)
)
</script>
