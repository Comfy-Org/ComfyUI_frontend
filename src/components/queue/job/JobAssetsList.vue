<template>
  <div class="flex flex-col gap-4 px-3 pb-4">
    <div
      v-for="group in displayedJobGroups"
      :key="group.key"
      class="flex flex-col gap-2"
    >
      <div class="text-xs leading-none text-text-secondary">
        {{ group.label }}
      </div>
      <div
        v-for="job in group.items"
        :key="job.id"
        :data-job-id="job.id"
        @mouseenter="onJobEnter(job, $event)"
        @mouseleave="onJobLeave(job.id)"
      >
        <AssetsListItem
          class="w-full shrink-0 cursor-default text-text-primary transition-colors hover:bg-secondary-background-hover"
          :preview-url="getJobPreviewUrl(job)"
          :is-video-preview="isVideoPreviewJob(job)"
          :preview-alt="job.title"
          :icon-name="job.iconName ?? iconForJobState(job.state)"
          :icon-class="getJobIconClass(job)"
          :primary-text="job.title"
          :secondary-text="job.meta"
          :progress-total-percent="job.progressTotalPercent"
          :progress-current-percent="job.progressCurrentPercent"
          @contextmenu.prevent.stop="$emit('menu', job, $event)"
          @dblclick.stop="emitViewItem(job)"
          @preview-click="emitViewItem(job)"
          @click.stop
        >
          <template v-if="hoveredJobId === job.id" #actions>
            <Button
              v-if="isCancelable(job)"
              variant="destructive"
              size="icon"
              :aria-label="t('g.cancel')"
              @click.stop="emitCancelItem(job)"
            >
              <i class="icon-[lucide--x] size-4" />
            </Button>
            <Button
              v-else-if="isFailedDeletable(job)"
              variant="destructive"
              size="icon"
              :aria-label="t('g.delete')"
              @click.stop="emitDeleteItem(job)"
            >
              <i class="icon-[lucide--trash-2] size-4" />
            </Button>
            <Button
              v-else-if="job.state === 'completed'"
              variant="textonly"
              size="sm"
              @click.stop="emitCompletedViewItem(job)"
            >
              {{ t('menuLabels.View') }}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              :aria-label="t('g.more')"
              @click.stop="$emit('menu', job, $event)"
            >
              <i class="icon-[lucide--ellipsis] size-4" />
            </Button>
          </template>
        </AssetsListItem>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="activeDetails && popoverPosition"
      class="job-details-popover fixed z-50"
      :style="{
        top: `${popoverPosition.top}px`,
        left: `${popoverPosition.left}px`
      }"
      @mouseenter="onPopoverEnter"
      @mouseleave="onPopoverLeave"
    >
      <JobDetailsPopover
        :job-id="activeDetails.jobId"
        :workflow-id="activeDetails.workflowId"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import JobDetailsPopover from '@/components/queue/job/JobDetailsPopover.vue'
import { getHoverPopoverPosition } from '@/components/queue/job/getHoverPopoverPosition'
import Button from '@/components/ui/button/Button.vue'
import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import { iconForJobState } from '@/utils/queueDisplay'
import { isActiveJobState } from '@/utils/queueUtil'

const { displayedJobGroups } = defineProps<{ displayedJobGroups: JobGroup[] }>()

const emit = defineEmits<{
  (e: 'cancelItem', item: JobListItem): void
  (e: 'deleteItem', item: JobListItem): void
  (e: 'menu', item: JobListItem, ev: MouseEvent): void
  (e: 'viewItem', item: JobListItem): void
}>()

const { t } = useI18n()
const hoveredJobId = ref<string | null>(null)
const activeDetails = ref<{ jobId: string; workflowId?: string } | null>(null)
const activeRowElement = ref<HTMLElement | null>(null)
const popoverPosition = ref<{ top: number; left: number } | null>(null)
const {
  activeDetails,
  clearHoverTimers,
  resetActiveDetails,
  scheduleDetailsHide,
  scheduleDetailsShow
} = useJobDetailsHover<{ jobId: string; workflowId?: string }>({
  getActiveId: (details) => details.jobId,
  getDisplayedJobGroups: () => displayedJobGroups,
  onReset: clearPopoverAnchor
})

const clearHideTimer = () => {
  if (hideTimer.value !== null) {
    clearTimeout(hideTimer.value)
    hideTimer.value = null
  }
  hideTimerJobId.value = null
}

const clearShowTimer = () => {
  if (showTimer.value !== null) {
    clearTimeout(showTimer.value)
    showTimer.value = null
  }
}

const updatePopoverPosition = () => {
  const rowElement = activeRowElement.value
  if (!rowElement) return

  const rect = rowElement.getBoundingClientRect()
  popoverPosition.value = getHoverPopoverPosition(rect, window.innerWidth)
}

const resetActiveDetails = () => {
  clearHideTimer()
  clearShowTimer()
  activeDetails.value = null
  activeRowElement.value = null
  popoverPosition.value = null
}

const scheduleDetailsShow = (job: JobListItem, rowElement: HTMLElement) => {
  clearShowTimer()
  showTimer.value = window.setTimeout(() => {
    activeRowElement.value = rowElement
    activeDetails.value = {
      jobId: job.id,
      workflowId: job.taskRef?.workflowId
    }
    showTimer.value = null
    void nextTick(updatePopoverPosition)
  }, 200)
}

const scheduleDetailsHide = (jobId?: string) => {
  if (!jobId) return

  clearShowTimer()
  if (hideTimerJobId.value && hideTimerJobId.value !== jobId) {
    return
  }

  clearHideTimer()
  hideTimerJobId.value = jobId
  hideTimer.value = window.setTimeout(() => {
    if (activeDetails.value?.jobId === jobId) {
      activeDetails.value = null
      activeRowElement.value = null
      popoverPosition.value = null
    }
    hideTimer.value = null
    hideTimerJobId.value = null
  }, 150)
}

const onJobLeave = (jobId: string) => {
  if (hoveredJobId.value === jobId) {
    hoveredJobId.value = null
  }
  scheduleDetailsHide(jobId)
}

const onJobEnter = (job: JobListItem, event: MouseEvent) => {
  hoveredJobId.value = job.id

  const rowElement = event.currentTarget
  if (!(rowElement instanceof HTMLElement)) return

  activeRowElement.value = rowElement
  if (activeDetails.value?.jobId === job.id) {
    clearHideTimer()
    clearShowTimer()
    void nextTick(updatePopoverPosition)
    return
  }

  scheduleDetailsShow(job, rowElement)
}

const isCancelable = (job: JobListItem) =>
  job.showClear !== false && isActiveJobState(job.state)

const isFailedDeletable = (job: JobListItem) =>
  job.showClear !== false && job.state === 'failed'

const getPreviewOutput = (job: JobListItem) => job.taskRef?.previewOutput

const getJobPreviewUrl = (job: JobListItem) => {
  const preview = getPreviewOutput(job)
  if (preview?.isImage || preview?.isVideo) {
    return preview.url
  }
  return job.iconImageUrl
}

const isVideoPreviewJob = (job: JobListItem) =>
  job.state === 'completed' && !!getPreviewOutput(job)?.isVideo

const isPreviewableCompletedJob = (job: JobListItem) =>
  job.state === 'completed' && !!getPreviewOutput(job)

const emitViewItem = (job: JobListItem) => {
  if (isPreviewableCompletedJob(job)) {
    resetActiveDetails()
    emit('viewItem', job)
  }
}

const emitCompletedViewItem = (job: JobListItem) => {
  resetActiveDetails()
  emit('viewItem', job)
}

const emitCancelItem = (job: JobListItem) => {
  resetActiveDetails()
  emit('cancelItem', job)
}

const emitDeleteItem = (job: JobListItem) => {
  resetActiveDetails()
  emit('deleteItem', job)
}

const onPopoverEnter = () => {
  clearHideTimer()
  clearShowTimer()
}

const onPopoverLeave = () => {
  scheduleDetailsHide(activeDetails.value?.jobId)
}

const getJobIconClass = (job: JobListItem): string | undefined => {
  const iconName = job.iconName ?? iconForJobState(job.state)
  if (!job.iconImageUrl && iconName === iconForJobState('pending')) {
    return 'animate-spin'
  }
  return undefined
}

watch(
  () => displayedJobGroups,
  (groups) => {
    const activeJobId = activeDetails.value?.jobId
    if (!activeJobId) return

    const hasActiveJob = groups.some((group) =>
      group.items.some((item) => item.id === activeJobId)
    )

    if (!hasActiveJob) {
      resetActiveDetails()
    }
  }
)

onBeforeUnmount(resetActiveDetails)
</script>
