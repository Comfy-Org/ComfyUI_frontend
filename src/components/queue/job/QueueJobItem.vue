<template>
  <div
    ref="rowRef"
    class="relative"
    @mouseenter="onRowEnter"
    @mouseleave="onRowLeave"
    @contextmenu.stop.prevent="onContextMenu"
  >
    <Teleport to="body">
      <div
        v-if="!isPreviewVisible && showDetails && popoverPosition"
        class="fixed z-50"
        :style="{
          top: `${popoverPosition.top}px`,
          right: `${popoverPosition.right}px`
        }"
        @mouseenter="onPopoverEnter"
        @mouseleave="onPopoverLeave"
      >
        <JobDetailsPopover
          :job-id="props.jobId"
          :workflow-id="props.workflowId"
        />
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="isPreviewVisible && canShowPreview && popoverPosition"
        class="fixed z-50"
        :style="{
          top: `${popoverPosition.top}px`,
          right: `${popoverPosition.right}px`
        }"
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
    </Teleport>
    <div
      class="relative flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-secondary-background bg-secondary-background p-1 text-[12px] text-text-primary transition-colors duration-150 ease-in-out hover:border-secondary-background-hover hover:bg-secondary-background-hover"
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
          class="pointer-events-none absolute inset-y-0 left-0 h-full bg-interface-panel-job-progress-primary transition-[width]"
          :style="{ width: `${props.progressTotalPercent}%` }"
        />
        <div
          v-if="props.progressCurrentPercent !== undefined"
          class="pointer-events-none absolute inset-y-0 left-0 h-full bg-interface-panel-job-progress-secondary transition-[width]"
          :style="{ width: `${props.progressCurrentPercent}%` }"
        />
      </div>

      <div class="relative z-1 flex items-center gap-1">
        <div class="relative inline-flex items-center justify-center">
          <div
            class="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2"
            @mouseenter.stop="onIconEnter"
            @mouseleave.stop="onIconLeave"
          />
          <div
            class="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-[6px]"
          >
            <img
              v-if="iconImageUrl"
              :src="iconImageUrl"
              class="h-full w-full object-cover"
            />
            <i
              v-else
              :class="cn(iconClass, 'size-4', shouldSpin && 'animate-spin')"
            />
          </div>
        </div>
      </div>

      <div class="relative z-1 min-w-0 flex-1">
        <div class="truncate opacity-90" :title="props.title">
          <slot name="primary">{{ props.title }}</slot>
        </div>
      </div>

      <!--
        TODO: Refactor action buttons to use a declarative config system.

        Instead of hardcoding button visibility logic in the template, define an array of
        action button configs with properties like:
        - icon, label, action, tooltip
        - visibleStates: JobState[] (which job states show this button)
        - alwaysVisible: boolean (show without hover)
        - destructive: boolean (use destructive styling)

        Then render buttons in two groups:
        1. Always-visible buttons (outside Transition)
        2. Hover-only buttons (inside Transition)

        This would eliminate the current duplication where the cancel button exists
        both outside (for running) and inside (for pending) the Transition.
      -->
      <div class="relative z-1 flex items-center gap-2 text-text-secondary">
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
            class="inline-flex items-center gap-2 pr-1"
          >
            <Button
              v-if="props.state === 'failed' && computedShowClear"
              v-tooltip.top="deleteTooltipConfig"
              variant="destructive"
              size="icon"
              :aria-label="t('g.delete')"
              @click.stop="onDeleteClick"
            >
              <i class="icon-[lucide--trash-2] size-4" />
            </Button>
            <Button
              v-else-if="
                props.state !== 'completed' &&
                props.state !== 'running' &&
                computedShowClear
              "
              v-tooltip.top="cancelTooltipConfig"
              variant="destructive"
              size="icon"
              :aria-label="t('g.cancel')"
              @click.stop="onCancelClick"
            >
              <i class="icon-[lucide--x] size-4" />
            </Button>
            <Button
              v-else-if="props.state === 'completed'"
              variant="textonly"
              size="sm"
              @click.stop="emit('view')"
              >{{ t('menuLabels.View') }}</Button
            >
            <Button
              v-if="props.showMenu !== undefined ? props.showMenu : true"
              v-tooltip.top="moreTooltipConfig"
              variant="textonly"
              size="icon-sm"
              :aria-label="t('g.more')"
              @click.stop="emit('menu', $event)"
            >
              <i class="icon-[lucide--more-horizontal] size-4" />
            </Button>
          </div>
          <div
            v-else-if="props.state !== 'running'"
            key="secondary"
            class="pr-2"
          >
            <slot name="secondary">{{ props.rightText }}</slot>
          </div>
        </Transition>
        <!-- Running job cancel button - always visible -->
        <Button
          v-if="props.state === 'running' && computedShowClear"
          v-tooltip.top="cancelTooltipConfig"
          variant="destructive"
          size="icon"
          :aria-label="t('g.cancel')"
          @click.stop="onCancelClick"
        >
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import JobDetailsPopover from '@/components/queue/job/JobDetailsPopover.vue'
import QueueAssetPreview from '@/components/queue/job/QueueAssetPreview.vue'
import Button from '@/components/ui/button/Button.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import type { JobState } from '@/types/queue'
import { iconForJobState } from '@/utils/queueDisplay'
import { cn } from '@/utils/tailwindUtil'

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
  (e: 'cancel'): void
  (e: 'delete'): void
  (e: 'menu', event: MouseEvent): void
  (e: 'view'): void
  (e: 'details-enter', jobId: string): void
  (e: 'details-leave', jobId: string): void
}>()

const { t } = useI18n()

const cancelTooltipConfig = computed(() => buildTooltipConfig(t('g.cancel')))
const deleteTooltipConfig = computed(() => buildTooltipConfig(t('g.delete')))
const moreTooltipConfig = computed(() => buildTooltipConfig(t('g.more')))

const rowRef = ref<HTMLDivElement | null>(null)
const showDetails = computed(() => props.activeDetailsId === props.jobId)

const onRowEnter = () => {
  if (!isPreviewVisible.value) emit('details-enter', props.jobId)
}
const onRowLeave = () => emit('details-leave', props.jobId)
const onPopoverEnter = () => emit('details-enter', props.jobId)
const onPopoverLeave = () => emit('details-leave', props.jobId)

const isPreviewVisible = ref(false)
const previewHideTimer = ref<number | null>(null)
const previewShowTimer = ref<number | null>(null)
const clearPreviewHideTimer = () => {
  if (previewHideTimer.value !== null) {
    clearTimeout(previewHideTimer.value)
    previewHideTimer.value = null
  }
}
const clearPreviewShowTimer = () => {
  if (previewShowTimer.value !== null) {
    clearTimeout(previewShowTimer.value)
    previewShowTimer.value = null
  }
}
const canShowPreview = computed(
  () => props.state === 'completed' && !!props.iconImageUrl
)
const scheduleShowPreview = () => {
  if (!canShowPreview.value) return
  clearPreviewHideTimer()
  clearPreviewShowTimer()
  previewShowTimer.value = window.setTimeout(() => {
    isPreviewVisible.value = true
    previewShowTimer.value = null
  }, 200)
}
const scheduleHidePreview = () => {
  clearPreviewHideTimer()
  clearPreviewShowTimer()
  previewHideTimer.value = window.setTimeout(() => {
    isPreviewVisible.value = false
    previewHideTimer.value = null
  }, 150)
}
const onIconEnter = () => scheduleShowPreview()
const onIconLeave = () => scheduleHidePreview()
const onPreviewEnter = () => scheduleShowPreview()
const onPreviewLeave = () => scheduleHidePreview()

const popoverPosition = ref<{ top: number; right: number } | null>(null)

const updatePopoverPosition = () => {
  const el = rowRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const gap = 8
  popoverPosition.value = {
    top: rect.top,
    right: window.innerWidth - rect.left + gap
  }
}

const isAnyPopoverVisible = computed(
  () => showDetails.value || (isPreviewVisible.value && canShowPreview.value)
)

watch(
  isAnyPopoverVisible,
  (visible) => {
    if (visible) {
      nextTick(updatePopoverPosition)
    } else {
      popoverPosition.value = null
    }
  },
  { immediate: false }
)

const isHovered = ref(false)

const iconClass = computed(() => {
  if (props.iconName) return props.iconName
  return iconForJobState(props.state)
})

const shouldSpin = computed(
  () =>
    props.state === 'pending' &&
    iconClass.value === iconForJobState('pending') &&
    !props.iconImageUrl
)

const computedShowClear = computed(() => {
  if (props.showClear !== undefined) return props.showClear
  return props.state !== 'completed'
})

const emitDetailsLeave = () => emit('details-leave', props.jobId)

const onCancelClick = () => {
  emitDetailsLeave()
  emit('cancel')
}

const onDeleteClick = () => {
  emitDetailsLeave()
  emit('delete')
}

const onContextMenu = (event: MouseEvent) => {
  const shouldShowMenu = props.showMenu !== undefined ? props.showMenu : true
  if (shouldShowMenu) emit('menu', event)
}
</script>
