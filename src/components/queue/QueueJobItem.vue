<template>
  <div class="relative" @mouseenter="onRowEnter" @mouseleave="onRowLeave">
    <div
      v-show="showDetails"
      class="absolute top-0 right-[calc(100%+var(--spacing-spacing-xs))] z-50"
      @mouseenter="onPopoverEnter"
      @mouseleave="onPopoverLeave"
    >
      <JobDetailsPopover
        :job-id="props.jobId"
        :workflow-id="props.workflowId"
      />
    </div>
    <BaseJobRow
      :variant="props.state"
      :primary-text="primaryText"
      :secondary-text="rightText"
      :show-actions-on-hover="true"
      :show-clear="computedShowClear"
      :show-menu="computedShowMenu"
      :progress-total-percent="progressTotalPercent"
      :progress-current-percent="progressCurrentPercent"
      @clear="emit('clear')"
      @menu="emit('menu')"
      @view="emit('view')"
    >
      <template #icon>
        <div
          class="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px]"
        >
          <img
            v-if="iconImageUrl"
            :src="iconImageUrl"
            class="h-full w-full object-cover"
          />
          <i v-else :class="[iconClass, 'size-4']" />
        </div>
      </template>
      <template #primary>
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
      </template>
      <template #secondary>
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
      </template>
    </BaseJobRow>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import JobDetailsPopover from '@/components/queue/overlay/JobDetailsPopover.vue'
import { useQueuePopoverStore } from '@/stores/queuePopoverStore'
import type { JobState } from '@/types/queue'
import { clampPercentInt, formatPercent0 } from '@/utils/numberUtil'
import { iconForJobState, shouldShowClear } from '@/utils/queueUtil'

import BaseJobRow from './BaseJobRow.vue'

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
    runningNodeName: undefined
  }
)

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'menu'): void
  (e: 'view'): void
}>()

const { t, locale } = useI18n()

const popoverStore = useQueuePopoverStore()
const showDetails = computed(
  () => popoverStore.activeJobDetailsId === props.jobId
)
const hideTimer = ref<number | null>(null)
const clearHideTimer = () => {
  if (hideTimer.value !== null) {
    clearTimeout(hideTimer.value)
    hideTimer.value = null
  }
}
const openDetails = () => {
  clearHideTimer()
  popoverStore.setActive(props.jobId)
}
const scheduleHideDetails = () => {
  clearHideTimer()
  hideTimer.value = window.setTimeout(() => {
    if (popoverStore.activeJobDetailsId === props.jobId) {
      popoverStore.clear()
    }
    hideTimer.value = null
  }, 150)
}
const onRowEnter = openDetails
const onRowLeave = scheduleHideDetails
const onPopoverEnter = openDetails
const onPopoverLeave = scheduleHideDetails

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
</script>
