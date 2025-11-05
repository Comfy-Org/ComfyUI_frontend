<template>
  <div
    class="flex h-12 items-center justify-between gap-[var(--spacing-spacing-xs)] border-b border-[var(--color-charcoal-400)] px-[var(--spacing-spacing-xs)]"
  >
    <div
      class="px-[var(--spacing-spacing-xs)] text-[14px] font-normal text-white"
    >
      <span>{{ headerTitle }}</span>
      <span
        v-if="showConcurrentIndicator"
        class="ml-[var(--spacing-spacing-md)] inline-flex items-center gap-[var(--spacing-spacing-xxs)] text-blue-100"
      >
        <span class="inline-block size-2 rounded-full bg-blue-100" />
        <span>
          <span class="font-bold">{{ concurrentWorkflowCount }}</span>
          <span class="ml-[var(--spacing-spacing-xxs)]">{{
            t('sideToolbar.queueProgressOverlay.running')
          }}</span>
        </span>
      </span>
    </div>
    <div class="flex items-center gap-[var(--spacing-spacing-xxs)]">
      <button
        v-tooltip.top="moreTooltipConfig"
        class="inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-100"
        :aria-label="t('sideToolbar.queueProgressOverlay.moreOptions')"
        @click="onMoreClick"
      >
        <i
          class="icon-[lucide--more-horizontal] block size-4 leading-none text-[var(--color-slate-100)]"
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
        @hide="isMoreOpen = false"
      >
        <div
          class="flex flex-col items-stretch rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-sm)] font-inter"
        >
          <button
            class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xs)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] font-inter text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
            :aria-label="t('sideToolbar.queueProgressOverlay.showAssetsPanel')"
            @click="onShowAssetsFromMenu"
          >
            <i-comfy:image-ai-edit
              class="pointer-events-none block size-4 shrink-0 leading-none text-white"
              aria-hidden="true"
            />
            <span>{{
              t('sideToolbar.queueProgressOverlay.showAssetsPanel')
            }}</span>
          </button>
          <div
            class="px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xxs)]"
          >
            <div class="h-px bg-[var(--color-charcoal-400)]" />
          </div>
          <button
            class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xs)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] font-inter text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
            :aria-label="t('sideToolbar.queueProgressOverlay.clearHistory')"
            @click="onClearHistoryFromMenu"
          >
            <i
              class="icon-[lucide--history] block size-4 leading-none text-white"
            />
            <span>{{
              t('sideToolbar.queueProgressOverlay.clearHistory')
            }}</span>
          </button>
        </div>
      </Popover>
      <button
        class="inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-100"
        :aria-label="t('g.close')"
        @click="$emit('close')"
      >
        <i
          class="icon-[lucide--x] block size-4 leading-none text-[var(--color-slate-100)]"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildTooltipConfig } from '@/composables/useTooltipConfig'

defineProps<{
  headerTitle: string
  showConcurrentIndicator: boolean
  concurrentWorkflowCount: number
}>()

const emit = defineEmits<{
  (e: 'showAssets'): void
  (e: 'clearHistory'): void
  (e: 'close'): void
}>()

const { t } = useI18n()

const morePopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const isMoreOpen = ref(false)
const moreTooltipConfig = computed(() => buildTooltipConfig(t('g.more')))

const onMoreClick = (event: Event) => {
  if (morePopoverRef.value) {
    morePopoverRef.value.toggle(event)
    isMoreOpen.value = !isMoreOpen.value
  }
}
const onShowAssetsFromMenu = () => {
  ;(morePopoverRef.value as any)?.hide?.()
  isMoreOpen.value = false
  emit('showAssets')
}
const onClearHistoryFromMenu = () => {
  ;(morePopoverRef.value as any)?.hide?.()
  isMoreOpen.value = false
  emit('clearHistory')
}
</script>
