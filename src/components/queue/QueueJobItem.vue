<template>
  <div
    class="relative"
    @mouseenter="onRowEnter"
    @mouseleave="onRowLeave"
    @contextmenu.stop.prevent="onContextMenu"
  >
    <div
      v-if="!isPreviewVisible && showDetails"
      class="absolute top-0 right-[calc(100%+var(--spacing-spacing-xs))] z-50"
      @mouseenter="onPopoverEnter"
      @mouseleave="onPopoverLeave"
    >
      <JobDetailsPopover
        :job-id="props.jobId"
        :workflow-id="props.workflowId"
      />
    </div>
    <div
      v-if="isPreviewVisible && canShowPreview"
      class="absolute top-0 right-[calc(100%+var(--spacing-spacing-xs))] z-50"
      @mouseenter="onPreviewEnter"
      @mouseleave="onPreviewLeave"
    >
      <QueueAssetPreview
        :image-url="iconImageUrl!"
        :name="props.title"
        :time-label="rightText || undefined"
        @image-click="emit('view')"
      />
    </div>
    <div
      class="relative flex items-center justify-between gap-[var(--spacing-spacing-xs)] overflow-hidden rounded-[var(--corner-radius-corner-radius-md)] border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-600)] p-[var(--spacing-spacing-xxs)] text-[12px] text-white transition-colors duration-150 ease-in-out hover:border-[var(--color-charcoal-300)] hover:bg-[var(--color-charcoal-500)]"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <div
        v-if="
          props.state === 'running' &&
          (props.progressTotalPercent !== undefined ||
            props.progressCurrentPercent !== undefined)
        "
        class="absolute inset-0"
      >
        <div
          v-if="props.progressTotalPercent !== undefined"
          class="pointer-events-none absolute inset-y-0 left-0 h-full bg-[var(--color-interface-panel-job-progress-primary)] transition-[width]"
          :style="{ width: `${props.progressTotalPercent}%` }"
        />
        <div
          v-if="props.progressCurrentPercent !== undefined"
          class="pointer-events-none absolute inset-y-0 left-0 h-full bg-[var(--color-interface-panel-job-progress-secondary)] transition-[width]"
          :style="{ width: `${props.progressCurrentPercent}%` }"
        />
      </div>

      <div
        class="relative z-[1] flex items-center gap-[var(--spacing-spacing-xxs)]"
      >
        <div
          class="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px]"
          @mouseenter.stop="onIconEnter"
          @mouseleave.stop="onIconLeave"
        >
          <img
            v-if="iconImageUrl"
            :src="iconImageUrl"
            class="h-full w-full object-cover"
          />
          <i v-else :class="[iconClass, 'size-4']" />
        </div>
      </div>

      <div class="relative z-[1] min-w-0 flex-1">
        <div class="truncate opacity-90" :title="primaryText">
          <slot name="primary">
            <template v-if="props.state === 'running'">
              <i18n-t keypath="sideToolbar.queueProgressOverlay.total">
                <template #percent>
                  <span class="font-bold">{{ formattedTotalPercent }}</span>
                </template>
              </i18n-t>
            </template>
            <template v-else>{{ primaryText }}</template>
          </slot>
        </div>
      </div>

      <div
        class="relative z-[1] flex items-center gap-[var(--spacing-spacing-xs)] text-[var(--color-slate-100)]"
      >
        <Transition
          mode="out-in"
          enter-active-class="transition-opacity transition-transform duration-150 ease-out"
          leave-active-class="transition-opacity transition-transform duration-150 ease-in"
          enter-from-class="opacity-0 translate-y-0.5"
          enter-to-class="opacity-100 translate-y-0"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-0.5"
        >
          <div
            v-if="isHovered"
            key="actions"
            class="inline-flex items-center gap-[var(--spacing-spacing-xs)] pr-[calc(var(--spacing-spacing-xs)-var(--spacing-spacing-xxs))]"
          >
            <button
              v-if="props.state !== 'completed' && computedShowClear"
              type="button"
              class="inline-flex h-6 transform items-center gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-sm,4px)] border-0 bg-[var(--color-charcoal-300)] px-[var(--spacing-spacing-xxs)] py-0 text-white transition duration-150 ease-in-out hover:-translate-y-px hover:opacity-95"
              :aria-label="t('g.clear')"
              @click.stop="emit('clear')"
            >
              <i class="icon-[lucide--x] size-4" />
            </button>
            <button
              v-else-if="props.state === 'completed'"
              type="button"
              class="inline-flex h-6 transform items-center gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-sm,4px)] border-0 bg-[var(--color-charcoal-300)] px-[var(--spacing-spacing-xs)] py-0 text-white transition duration-150 ease-in-out hover:-translate-y-px hover:opacity-95"
              :aria-label="t('menuLabels.View')"
              @click.stop="emit('view')"
            >
              <span>{{ t('menuLabels.View') }}</span>
            </button>
            <button
              v-if="computedShowMenu"
              type="button"
              class="inline-flex h-6 transform items-center gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-sm,4px)] border-0 bg-[var(--color-charcoal-300)] px-[var(--spacing-spacing-xxs)] py-0 text-white transition duration-150 ease-in-out hover:-translate-y-px hover:opacity-95"
              :aria-label="t('g.moreOptions')"
              @click.stop="emit('menu', $event)"
            >
              <i class="icon-[lucide--more-horizontal] size-4" />
            </button>
          </div>
          <div v-else key="secondary" class="pr-[var(--spacing-spacing-xs)]">
            <slot name="secondary">
              <template
                v-if="
                  props.state === 'running' &&
                  props.runningNodeName &&
                  props.progressCurrentPercent !== undefined
                "
              >
                <span
                  class="inline-flex items-center gap-[var(--spacing-spacing-xss)]"
                >
                  <span class="inline-block max-w-[10rem] truncate">{{
                    props.runningNodeName
                  }}</span>
                  <span>{{
                    t('sideToolbar.queueProgressOverlay.colonPercent', {
                      percent: formattedCurrentPercent
                    })
                  }}</span>
                </span>
              </template>
              <template v-else>{{ rightText }}</template>
            </slot>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import JobDetailsPopover from '@/components/queue/overlay/JobDetailsPopover.vue'
import QueueAssetPreview from '@/components/queue/overlay/QueueAssetPreview.vue'
import type { JobState } from '@/types/queue'
import { clampPercentInt, formatPercent0 } from '@/utils/numberUtil'
import { iconForJobState, shouldShowClear } from '@/utils/queueUtil'

const props = withDefaults(
  defineProps<{
    jobId: string
    workflowId?: string
    state: JobState
    title: string
    rightText?: string
    iconName?: string
    iconImageUrl?: string
    showClear?: boolean
    showMenu?: boolean
    progressTotalPercent?: number
    progressCurrentPercent?: number
    runningNodeName?: string
    activeDetailsId?: string | null
  }>(),
  {
    workflowId: undefined,
    rightText: '',
    iconName: undefined,
    iconImageUrl: undefined,
    showClear: undefined,
    showMenu: undefined,
    progressTotalPercent: undefined,
    progressCurrentPercent: undefined,
    runningNodeName: undefined,
    activeDetailsId: null
  }
)

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'menu', event: Event): void
  (e: 'view'): void
  (e: 'details-enter', jobId: string): void
  (e: 'details-leave', jobId: string): void
}>()

const { t, locale } = useI18n()

const showDetails = computed(() => props.activeDetailsId === props.jobId)

const onRowEnter = () => {
  if (!isPreviewVisible.value) emit('details-enter', props.jobId)
}
const onRowLeave = () => emit('details-leave', props.jobId)
const onPopoverEnter = () => emit('details-enter', props.jobId)
const onPopoverLeave = () => emit('details-leave', props.jobId)

const isPreviewVisible = ref(false)
const previewHideTimer = ref<number | null>(null)
const clearPreviewHideTimer = () => {
  if (previewHideTimer.value !== null) {
    clearTimeout(previewHideTimer.value)
    previewHideTimer.value = null
  }
}
const canShowPreview = computed(
  () => props.state === 'completed' && !!props.iconImageUrl
)
const showPreview = () => {
  if (!canShowPreview.value) return
  clearPreviewHideTimer()
  isPreviewVisible.value = true
}
const scheduleHidePreview = () => {
  clearPreviewHideTimer()
  previewHideTimer.value = window.setTimeout(() => {
    isPreviewVisible.value = false
    previewHideTimer.value = null
  }, 150)
}
const onIconEnter = () => showPreview()
const onIconLeave = () => scheduleHidePreview()
const onPreviewEnter = () => showPreview()
const onPreviewLeave = () => scheduleHidePreview()

const isHovered = ref(false)

const iconClass = computed(() => {
  if (props.iconName) return props.iconName
  return iconForJobState(props.state)
})

const rightText = computed(() => props.rightText)
const runningTotalPercent = computed(() =>
  clampPercentInt(props.progressTotalPercent)
)

const formattedTotalPercent = computed(() =>
  formatPercent0(locale.value, runningTotalPercent.value)
)

const runningCurrentPercent = computed(() =>
  clampPercentInt(props.progressCurrentPercent)
)

const formattedCurrentPercent = computed(() =>
  formatPercent0(locale.value, runningCurrentPercent.value)
)

const primaryText = computed(() => {
  if (props.state === 'initialization')
    return t('queue.initializingAlmostReady')
  if (props.state === 'queued') return t('queue.inQueue')
  return props.title
})

const computedShowClear = computed(() =>
  shouldShowClear(props.state, props.showClear)
)

const computedShowMenu = computed(() => {
  if (props.showMenu !== undefined) return props.showMenu
  return true
})

const onContextMenu = (event: MouseEvent) => {
  if (computedShowMenu.value) emit('menu', event)
}
</script>
