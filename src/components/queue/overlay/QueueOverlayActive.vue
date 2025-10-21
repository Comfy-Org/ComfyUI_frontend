<template>
  <div
    class="flex flex-col gap-[var(--spacing-spacing-sm)] p-[var(--spacing-spacing-xs)]"
  >
    <div class="flex flex-col gap-[var(--spacing-spacing-xss)]">
      <div
        class="relative h-2 w-full overflow-hidden rounded-full border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)]"
      >
        <div
          class="absolute inset-0 h-full rounded-full transition-[width]"
          :style="totalProgressStyle"
        />
        <div
          class="absolute inset-0 h-full rounded-full transition-[width]"
          :style="currentNodeProgressStyle"
        />
      </div>
      <div
        class="flex items-start justify-end gap-[var(--spacing-spacing-md)] text-[12px] leading-none"
      >
        <div
          class="flex items-center gap-[var(--spacing-spacing-xss)] text-white opacity-90"
        >
          <i18n-t keypath="sideToolbar.queueProgressOverlay.total">
            <template #percent>
              <span class="font-bold">{{ totalPercentFormatted }}</span>
            </template>
          </i18n-t>
        </div>
        <div
          class="flex items-center gap-[var(--spacing-spacing-xss)] text-[var(--color-slate-100)]"
        >
          <span>{{ t('sideToolbar.queueProgressOverlay.currentNode') }}</span>
          <span class="inline-block max-w-[10rem] truncate">{{
            currentNodeName
          }}</span>
          <span class="flex items-center gap-[var(--spacing-spacing-xss)]">
            <span>{{ currentNodePercent }}</span>
            <span>%</span>
          </span>
        </div>
      </div>
    </div>

    <div :class="bottomRowClass">
      <div
        class="flex items-center gap-[var(--spacing-spacing-xs)] text-[12px] text-white"
      >
        <span class="opacity-90">
          <span class="font-bold">{{ runningCount }}</span>
          <span class="ml-[var(--spacing-spacing-xss)]">{{
            t('sideToolbar.queueProgressOverlay.running')
          }}</span>
        </span>
        <button
          v-if="runningCount > 0"
          class="inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
          :aria-label="t('sideToolbar.queueProgressOverlay.interruptAll')"
          @click="$emit('interruptAll')"
        >
          <i class="icon-[lucide--x] block size-4 leading-none text-white" />
        </button>
      </div>

      <button
        class="w-full rounded border-0 bg-[var(--color-charcoal-500)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xss)] text-[12px] text-white hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
        @click="$emit('viewAllJobs')"
      >
        {{ t('sideToolbar.queueProgressOverlay.viewAllJobs') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  totalProgressStyle: Record<string, string>
  currentNodeProgressStyle: Record<string, string>
  totalPercentFormatted: string
  currentNodePercent: number
  currentNodeName: string
  runningCount: number
  bottomRowClass: string
}>()

defineEmits<{
  (e: 'interruptAll'): void
  (e: 'viewAllJobs'): void
}>()

const { t } = useI18n()
</script>
