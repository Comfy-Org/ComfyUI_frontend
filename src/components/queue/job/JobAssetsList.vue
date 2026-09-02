<template>
  <div
    ref="scrollContainer"
    v-bind="$attrs"
    data-testid="job-assets-list"
    class="h-full overflow-y-auto pb-4"
    @scroll="onListScroll"
  >
    <div :style="virtualWrapperStyle">
      <template v-for="{ row, virtualItem } in virtualRows" :key="row.key">
        <div
          v-if="row.type === 'header'"
          class="box-border px-3 pb-2 text-xs leading-none text-text-secondary"
          :style="getVirtualRowStyle(virtualItem)"
        >
          {{ row.label }}
        </div>
        <div
          v-else-if="row.type === 'job'"
          class="box-border px-3"
          :style="getVirtualRowStyle(virtualItem)"
        >
          <div
            :data-job-id="row.job.id"
            class="h-12"
            @mouseenter="onJobEnter(row.job, $event)"
            @mouseleave="onJobLeave(row.job.id)"
          >
            <AssetsListItem
              :class="
                cn(
                  'size-full shrink-0 cursor-default text-text-primary transition-colors hover:bg-secondary-background-hover',
                  row.job.state === 'running' && 'bg-secondary-background'
                )
              "
              :preview-url="getJobPreviewUrl(row.job)"
              :is-video-preview="isVideoPreviewJob(row.job)"
              :preview-alt="row.job.title"
              :icon-name="row.job.iconName ?? iconForJobState(row.job.state)"
              :icon-class="getJobIconClass(row.job)"
              :primary-text="row.job.title"
              :secondary-text="row.job.meta"
              :progress-total-percent="row.job.progressTotalPercent"
              :progress-current-percent="row.job.progressCurrentPercent"
              @contextmenu.prevent.stop="$emit('menu', row.job, $event)"
              @dblclick.stop="emitViewItem(row.job)"
              @preview-click="emitViewItem(row.job)"
              @click.stop
            >
              <template v-if="hoveredJobId === row.job.id" #actions>
                <Button
                  v-if="isCancelable(row.job)"
                  variant="destructive"
                  size="icon"
                  :aria-label="t('g.cancel')"
                  @click.stop="emitCancelItem(row.job)"
                >
                  <i class="icon-[lucide--x] size-4" />
                </Button>
                <Button
                  v-else-if="isFailedDeletable(row.job)"
                  variant="destructive"
                  size="icon"
                  :aria-label="t('g.delete')"
                  @click.stop="emitDeleteItem(row.job)"
                >
                  <i class="icon-[lucide--trash-2] size-4" />
                </Button>
                <Button
                  v-else-if="row.job.state === 'completed'"
                  variant="textonly"
                  size="sm"
                  @click.stop="emitCompletedViewItem(row.job)"
                >
                  {{ t('menuLabels.View') }}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  :aria-label="t('g.more')"
                  @click.stop="$emit('menu', row.job, $event)"
                >
                  <i class="icon-[lucide--ellipsis] size-4" />
                </Button>
              </template>
            </AssetsListItem>
          </div>
        </div>
      </template>
    </div>
  </div>

  <JobDetailsHoverPopover
    :open="isDetailsOpen && !!activeDetails && !!activeRowElement"
    :job-id="activeDetails?.jobId"
    :workflow-id="activeDetails?.workflowId"
    :reference-element="activeRowElement"
    @content-enter="onPopoverEnter"
    @content-leave="onPopoverLeave"
    @update:open="onPopoverOpenChange"
  />
</template>

<script setup lang="ts">
import type { VirtualItem } from '@tanstack/vue-virtual'
import type { CSSProperties } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useI18n } from 'vue-i18n'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import JobDetailsHoverPopover from '@/components/queue/job/JobDetailsHoverPopover.vue'
import Button from '@/components/ui/button/Button.vue'
import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import { cn } from '@comfyorg/tailwind-utils'
import { iconForJobState } from '@/utils/queueDisplay'
import { isActiveJobState } from '@/utils/queueUtil'

import { buildVirtualJobRows } from './buildVirtualJobRows'
import type { VirtualJobRow } from './buildVirtualJobRows'

const HEADER_ROW_HEIGHT = 20
const GROUP_ROW_GAP = 16
const JOB_ROW_HEIGHT = 48
const DETAILS_SHOW_DELAY_MS = 200
const DETAILS_HIDE_DELAY_MS = 150

defineOptions({
  inheritAttrs: false
})

const { displayedJobGroups } = defineProps<{ displayedJobGroups: JobGroup[] }>()

const emit = defineEmits<{
  (e: 'cancelItem', item: JobListItem): void
  (e: 'deleteItem', item: JobListItem): void
  (e: 'menu', item: JobListItem, ev: MouseEvent): void
  (e: 'viewItem', item: JobListItem): void
}>()

const { t } = useI18n()
const scrollContainer = ref<HTMLElement | null>(null)
const hoveredJobId = ref<string | null>(null)
const activeRowElement = ref<HTMLElement | null>(null)
const activeDetails = ref<{ jobId: string; workflowId?: string } | null>(null)
const isDetailsOpen = ref(false)
const hideTimer = ref<number | null>(null)
const hideTimerJobId = ref<string | null>(null)
const showTimer = ref<number | null>(null)
const flatRows = computed(() => buildVirtualJobRows(displayedJobGroups))
const virtualizer = useVirtualizer({
  get count(): number {
    return flatRows.value.length
  },
  getItemKey(index: number) {
    return flatRows.value[index]?.key ?? index
  },
  estimateSize(index: number) {
    const row = flatRows.value[index]
    return row ? getRowHeight(row, index, flatRows.value) : JOB_ROW_HEIGHT
  },
  getScrollElement() {
    return scrollContainer.value
  },
  overscan: 12
})
const virtualRows = computed(() => {
  const rows = flatRows.value
  return virtualizer.value
    .getVirtualItems()
    .flatMap((virtualItem: VirtualItem) => {
      const row = rows[virtualItem.index]
      return row ? [{ row, virtualItem }] : []
    })
})
const virtualWrapperStyle = computed<CSSProperties>(() => ({
  position: 'relative',
  width: '100%',
  ...(flatRows.value.length > 0 && {
    height: `${virtualizer.value.getTotalSize()}px`
  })
}))
function getVirtualRowStyle(virtualItem: VirtualItem): CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: `${virtualItem.size}px`,
    transform: `translateY(${virtualItem.start}px)`,
    overflowAnchor: 'none'
  }
}

function getRowHeight(
  row: VirtualJobRow,
  index: number,
  rows: VirtualJobRow[]
): number {
  if (row.type === 'header') {
    return HEADER_ROW_HEIGHT
  }

  return (
    JOB_ROW_HEIGHT + (rows[index + 1]?.type === 'header' ? GROUP_ROW_GAP : 0)
  )
}

function onListScroll() {
  hoveredJobId.value = null
  resetActiveDetails()
}

function clearPopoverAnchor() {
  activeRowElement.value = null
}

function clearHideTimer() {
  if (hideTimer.value !== null) {
    clearTimeout(hideTimer.value)
    hideTimer.value = null
  }
  hideTimerJobId.value = null
}

function clearShowTimer() {
  if (showTimer.value !== null) {
    clearTimeout(showTimer.value)
    showTimer.value = null
  }
}

function clearHoverTimers() {
  clearHideTimer()
  clearShowTimer()
}

function resetActiveDetails() {
  clearHoverTimers()
  isDetailsOpen.value = false
  activeDetails.value = null
  clearPopoverAnchor()
}

function hasDisplayedJob(jobId: string) {
  return displayedJobGroups.some((group) =>
    group.items.some((item) => item.id === jobId)
  )
}

function scheduleDetailsShow(nextActive: {
  jobId: string
  workflowId?: string
}) {
  clearShowTimer()
  showTimer.value = window.setTimeout(() => {
    showTimer.value = null
    if (!hasDisplayedJob(nextActive.jobId)) return

    activeDetails.value = nextActive
    isDetailsOpen.value = true
  }, DETAILS_SHOW_DELAY_MS)
}

function showDetailsNow(nextActive: { jobId: string; workflowId?: string }) {
  clearHoverTimers()
  if (!hasDisplayedJob(nextActive.jobId)) return

  activeDetails.value = nextActive
  isDetailsOpen.value = true
}

function scheduleDetailsHide(jobId?: string) {
  if (!jobId) return

  clearShowTimer()
  if (hideTimerJobId.value && hideTimerJobId.value !== jobId) {
    return
  }

  clearHideTimer()
  hideTimerJobId.value = jobId
  hideTimer.value = window.setTimeout(() => {
    const currentActive = activeDetails.value
    if (currentActive?.jobId === jobId) {
      isDetailsOpen.value = false
    }
    hideTimer.value = null
    hideTimerJobId.value = null
  }, DETAILS_HIDE_DELAY_MS)
}

function onJobLeave(jobId: string) {
  if (hoveredJobId.value === jobId) {
    hoveredJobId.value = null
  }
  scheduleDetailsHide(jobId)
}

function onJobEnter(job: JobListItem, event: MouseEvent) {
  hoveredJobId.value = job.id

  const rowElement = event.currentTarget
  if (!(rowElement instanceof HTMLElement)) return

  activeRowElement.value = rowElement
  const nextActive = {
    jobId: job.id,
    workflowId: job.taskRef?.workflowId
  }

  if (isDetailsOpen.value && activeDetails.value?.jobId === job.id) {
    clearHoverTimers()
    return
  }

  const isSwitchingVisibleDetails = isDetailsOpen.value
  const showDetails = isSwitchingVisibleDetails
    ? showDetailsNow
    : scheduleDetailsShow

  showDetails(nextActive)
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
    return preview.previewUrl
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
  scheduleDetailsHide(activeDetails.value?.jobId)
}

function onPopoverOpenChange(open: boolean) {
  if (!open) {
    resetActiveDetails()
  }
}

function getJobIconClass(job: JobListItem): string | undefined {
  const iconName = job.iconName ?? iconForJobState(job.state)
  if (!job.iconImageUrl && iconName === iconForJobState('pending')) {
    return 'animate-spin'
  }
  return undefined
}

watch(
  () => displayedJobGroups,
  () => {
    const currentActive = activeDetails.value
    if (!currentActive) return

    if (!hasDisplayedJob(currentActive.jobId)) {
      resetActiveDetails()
    }
  }
)

onBeforeUnmount(resetActiveDetails)
</script>
