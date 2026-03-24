<template>
  <div
    class="flex h-12 items-center gap-2 border-b border-interface-stroke px-2"
  >
    <div class="min-w-0 flex-1 px-2 text-[14px] font-normal text-text-primary">
      <span>{{ headerTitle }}</span>
    </div>
    <div
      class="inline-flex h-6 items-center gap-2 text-[12px] leading-none text-text-primary"
    >
      <span :class="{ 'opacity-50': queuedCount === 0 }">{{
        t('sideToolbar.queueProgressOverlay.clearQueueTooltip')
      }}</span>
      <BaseTooltip
        :text="t('sideToolbar.queueProgressOverlay.clearAllJobsTooltip')"
        side="top"
      >
        <Button
          variant="destructive"
          size="icon"
          :aria-label="t('sideToolbar.queueProgressOverlay.clearQueued')"
          :disabled="queuedCount === 0"
          @click="$emit('clearQueued')"
        >
          <i class="icon-[lucide--list-x] size-4" />
        </Button>
      </BaseTooltip>
    </div>
    <JobHistoryActionsMenu @clear-history="$emit('clearHistory')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import JobHistoryActionsMenu from '@/components/queue/JobHistoryActionsMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import BaseTooltip from '@/components/ui/tooltip/BaseTooltip.vue'

defineProps<{
  headerTitle: string
  queuedCount: number
}>()

defineEmits<{
  (e: 'clearHistory'): void
  (e: 'clearQueued'): void
}>()

const { t } = useI18n()
</script>
