<template>
  <div
    class="flex h-12 items-center justify-between gap-2 border-b border-interface-stroke px-2"
  >
    <div class="px-2 text-[14px] font-normal text-text-primary">
      <span>{{ headerTitle }}</span>
      <span
        v-if="showConcurrentIndicator"
        class="ml-4 inline-flex items-center gap-1 text-blue-100"
      >
        <span class="inline-block size-2 rounded-full bg-blue-100" />
        <span>
          <span class="font-bold">{{ concurrentWorkflowCount }}</span>
          <span class="ml-1">{{
            t('sideToolbar.queueProgressOverlay.running')
          }}</span>
        </span>
      </span>
    </div>
    <div class="flex items-center gap-1">
      <button
        v-tooltip.top="moreTooltipConfig"
        class="inline-flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 hover:bg-secondary-background hover:opacity-100"
        :aria-label="t('sideToolbar.queueProgressOverlay.moreOptions')"
        @click="onMoreClick"
      >
        <i
          class="icon-[lucide--more-horizontal] block size-4 leading-none text-text-secondary"
        />
      </button>
      <Popover
        ref="morePopoverRef"
        :dismissable="true"
        :close-on-escape="true"
        unstyled
        :pt="{
          root: { class: 'absolute z-50' },
          content: {
            class: [
              'bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg font-inter'
            ]
          }
        }"
      >
        <div
          class="flex flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3 font-inter"
        >
          <button
            class="inline-flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg border-0 bg-transparent p-2 font-inter text-[12px] leading-none text-text-primary hover:bg-transparent hover:opacity-90"
            :aria-label="t('sideToolbar.queueProgressOverlay.clearHistory')"
            @click="onClearHistoryFromMenu"
          >
            <i
              class="icon-[lucide--file-x-2] block size-4 leading-none text-text-secondary"
            />
            <span>{{
              t('sideToolbar.queueProgressOverlay.clearHistory')
            }}</span>
          </button>
        </div>
      </Popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import type { PopoverMethods } from 'primevue/popover'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildTooltipConfig } from '@/composables/useTooltipConfig'

defineProps<{
  headerTitle: string
  showConcurrentIndicator: boolean
  concurrentWorkflowCount: number
}>()

const emit = defineEmits<{
  (e: 'clearHistory'): void
}>()

const { t } = useI18n()

const morePopoverRef = ref<PopoverMethods | null>(null)
const moreTooltipConfig = computed(() => buildTooltipConfig(t('g.more')))

const onMoreClick = (event: MouseEvent) => {
  morePopoverRef.value?.toggle(event)
}
const onClearHistoryFromMenu = () => {
  morePopoverRef.value?.hide()
  emit('clearHistory')
}
</script>
