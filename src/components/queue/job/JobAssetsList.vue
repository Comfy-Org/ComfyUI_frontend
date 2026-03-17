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
import { nextTick, ref } from 'vue'

import JobDetailsPopover from '@/components/queue/job/JobDetailsPopover.vue'
import { getHoverPopoverPosition } from '@/components/queue/job/getHoverPopoverPosition'
import Button from '@/components/ui/button/Button.vue'
import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'
import { useJobDetailsHover } from '@/composables/queue/useJobDetailsHover'
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
const activeRowElement = ref<HTMLElement | null>(null)
const popoverPosition = ref<{ top: number; right: number } | null>(null)
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

function clearPopoverAnchor() {
  activeRowElement.value = null
  popoverPosition.value = null
}

function updatePopoverPosition() {
  const rowElement = activeRowElement.value
  if (!rowElement) return

  const rect = rowElement.getBoundingClientRect()
  popoverPosition.value = getHoverPopoverPosition(rect, window.innerWidth)
}

function onJobLeave(jobId: string) {
  if (hoveredJobId.value === jobId) {
    hoveredJobId.value = null
  }
  scheduleDetailsHide(jobId, clearPopoverAnchor)
}

function onJobEnter(job: JobListItem, event: MouseEvent) {
  hoveredJobId.value = job.id

  const rowElement = event.currentTarget
  if (!(rowElement instanceof HTMLElement)) return

  activeRowElement.value = rowElement
  if (activeDetails.value?.jobId === job.id) {
    clearHoverTimers()
    void nextTick(updatePopoverPosition)
    return
  }

  scheduleDetailsShow(
    {
      jobId: job.id,
      workflowId: job.taskRef?.workflowId
    },
    () => {
      activeRowElement.value = rowElement
      void nextTick(updatePopoverPosition)
    }
  )
}

function isCancelable(job: JobListItem) {
  return job.showClear !== false && isActiveJobState(job.state)
}

function isFailedDeletable(job: JobListItem) {
  return job.showClear !== false && job.state === 'failed'
}

function getPreviewOutput(job: JobListItem) {
  return job.taskRef?.previewOutput
}

function getJobPreviewUrl(job: JobListItem) {
  const preview = getPreviewOutput(job)
  if (preview?.isImage || preview?.isVideo) {
    return preview.url
  }
  return job.iconImageUrl
}

function isVideoPreviewJob(job: JobListItem) {
  return job.state === 'completed' && !!getPreviewOutput(job)?.isVideo
}

function isPreviewableCompletedJob(job: JobListItem) {
  return job.state === 'completed' && !!getPreviewOutput(job)
}

function emitViewItem(job: JobListItem) {
  if (isPreviewableCompletedJob(job)) {
    resetActiveDetails()
    emit('viewItem', job)
  }
}

function emitCompletedViewItem(job: JobListItem) {
  resetActiveDetails()
  emit('viewItem', job)
}

function emitCancelItem(job: JobListItem) {
  resetActiveDetails()
  emit('cancelItem', job)
}

function emitDeleteItem(job: JobListItem) {
  resetActiveDetails()
  emit('deleteItem', job)
}

function onPopoverEnter() {
  clearHoverTimers()
}

function onPopoverLeave() {
  scheduleDetailsHide(activeDetails.value?.jobId, clearPopoverAnchor)
}

function getJobIconClass(job: JobListItem): string | undefined {
  const iconName = job.iconName ?? iconForJobState(job.state)
  if (!job.iconImageUrl && iconName === iconForJobState('pending')) {
    return 'animate-spin'
  }
  return undefined
}
</script>
