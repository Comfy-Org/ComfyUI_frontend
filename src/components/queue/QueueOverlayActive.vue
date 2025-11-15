<template>
  <div class="flex flex-col gap-3 p-2">
    <div class="flex flex-col gap-1">
      <div
        class="relative h-2 w-full overflow-hidden rounded-full border border-interface-stroke bg-interface-panel-surface"
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
      <div class="flex items-start justify-end gap-4 text-[12px] leading-none">
        <div class="flex items-center gap-1 text-text-primary opacity-90">
          <i18n-t keypath="sideToolbar.queueProgressOverlay.total">
            <template #percent>
              <span class="font-bold">{{ totalPercentFormatted }}</span>
            </template>
          </i18n-t>
        </div>
        <div class="flex items-center gap-1 text-text-secondary">
          <span>{{ t('sideToolbar.queueProgressOverlay.currentNode') }}</span>
          <span class="inline-block max-w-[10rem] truncate">{{
            currentNodeName
          }}</span>
          <span class="flex items-center gap-1">
            <span>{{ currentNodePercentFormatted }}</span>
          </span>
        </div>
      </div>
    </div>

    <div :class="bottomRowClass">
      <div class="flex items-center gap-2 text-[12px] text-text-primary">
        <span class="opacity-90">
          <span class="font-bold">{{ runningCount }}</span>
          <span class="ml-1">{{
            t('sideToolbar.queueProgressOverlay.running')
          }}</span>
        </span>
        <button
          v-if="runningCount > 0"
          class="group inline-flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-secondary-background p-0 transition-colors hover:bg-destructive-background"
          :aria-label="t('sideToolbar.queueProgressOverlay.interruptAll')"
          @click="$emit('interruptAll')"
        >
          <i
            class="icon-[lucide--x] block size-4 leading-none text-text-primary transition-colors group-hover:text-base-background"
          />
        </button>
      </div>

      <button
        class="inline-flex h-6 w-full cursor-pointer items-center justify-center rounded border-0 bg-secondary-background px-2 py-0 text-[12px] text-text-primary hover:bg-secondary-background-hover hover:opacity-90"
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
  currentNodePercentFormatted: string
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
