<template>
  <div class="flex flex-col gap-3 p-2">
    <div class="flex flex-col gap-1">
      <div
        class="relative h-2 w-full overflow-hidden rounded-full border bg-background"
      >
        <div
          ref="totalFillRef"
          class="absolute inset-0 h-full origin-left scale-x-0 rounded-full bg-primary"
        />
        <div
          ref="currentNodeFillRef"
          data-testid="queue-progress-node-fill"
          class="absolute inset-0 h-full origin-left scale-x-0 rounded-full bg-primary/30"
        />
      </div>
      <div class="flex items-start justify-end gap-4 text-[12px] leading-none">
        <div class="flex items-center gap-1 opacity-90">
          <i18n-t keypath="sideToolbar.queueProgressOverlay.total">
            <template #percent>
              <span class="font-bold tabular-nums">{{
                totalPercentFormatted
              }}</span>
            </template>
          </i18n-t>
        </div>
        <div class="flex items-center gap-1 text-muted-foreground">
          <span>{{ t('sideToolbar.queueProgressOverlay.currentNode') }}</span>
          <span class="inline-block max-w-40 truncate">{{
            currentNodeName
          }}</span>
          <span class="flex items-center gap-1 tabular-nums">
            <span>{{ currentNodePercentFormatted }}</span>
          </span>
        </div>
      </div>
    </div>

    <div :class="bottomRowClass">
      <div class="flex items-center gap-4 text-[12px] text-foreground">
        <div class="flex items-center gap-2">
          <span class="opacity-90">
            <span class="font-bold">{{ runningCount }}</span>
            <span class="ml-1">{{
              t('sideToolbar.queueProgressOverlay.running')
            }}</span>
          </span>
          <Button
            v-if="runningCount > 0"
            :tooltip="t('sideToolbar.queueProgressOverlay.cancelJobTooltip')"
            variant="destructive"
            size="icon"
            :aria-label="t('sideToolbar.queueProgressOverlay.interruptAll')"
            @click="$emit('interruptAll')"
          >
            <i class="icon-[lucide--x] block leading-none text-foreground" />
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <span class="opacity-90">
            <span class="font-bold">{{ queuedCount }}</span>
            <span class="ml-1">{{
              t('sideToolbar.queueProgressOverlay.queuedSuffix')
            }}</span>
          </span>
          <Button
            v-if="queuedCount > 0"
            :tooltip="t('sideToolbar.queueProgressOverlay.clearQueueTooltip')"
            variant="destructive"
            size="icon"
            :aria-label="t('sideToolbar.queueProgressOverlay.clearQueued')"
            @click="$emit('clearQueued')"
          >
            <i
              class="icon-[lucide--list-x] block leading-none text-foreground"
            />
          </Button>
        </div>
      </div>

      <Button
        class="min-w-30 flex-1 px-2 py-0"
        variant="secondary"
        size="md"
        @click="$emit('viewAllJobs')"
      >
        {{ t('sideToolbar.queueProgressOverlay.viewAllJobs') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import { useCompositedProgress } from '@/renderer/core/layout/transform/useCompositedProgress'

const { totalPercent, currentNodePercent } = defineProps<{
  totalPercent: number
  currentNodePercent: number
  totalPercentFormatted: string
  currentNodePercentFormatted: string
  currentNodeName: string
  runningCount: number
  queuedCount: number
  bottomRowClass: string
}>()

defineEmits<{
  (e: 'interruptAll'): void
  (e: 'clearQueued'): void
  (e: 'viewAllJobs'): void
}>()

const { t } = useI18n()

const SCALE_X_KEYFRAMES = [{ scale: '0 1' }, { scale: '1 1' }]
useCompositedProgress(
  useTemplateRef('totalFillRef'),
  () => totalPercent / 100,
  SCALE_X_KEYFRAMES
)
useCompositedProgress(
  useTemplateRef('currentNodeFillRef'),
  () => currentNodePercent / 100,
  SCALE_X_KEYFRAMES
)
</script>
