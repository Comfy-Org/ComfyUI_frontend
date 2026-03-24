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
        <ContextMenu :modal="false">
          <ContextMenuTrigger as-child>
            <AssetsListItem
              :class="
                cn(
                  'w-full shrink-0 cursor-default text-text-primary transition-colors hover:bg-secondary-background-hover',
                  job.state === 'running' && 'bg-secondary-background'
                )
              "
              :preview-url="getJobPreviewUrl(job)"
              :is-video-preview="isVideoPreviewJob(job)"
              :preview-alt="job.title"
              :icon-name="job.iconName ?? iconForJobState(job.state)"
              :icon-class="getJobIconClass(job)"
              :primary-text="job.title"
              :secondary-text="job.meta"
              :progress-total-percent="job.progressTotalPercent"
              :progress-current-percent="job.progressCurrentPercent"
              @dblclick.stop="emitViewItem(job)"
              @preview-click="emitViewItem(job)"
              @click.stop
            >
              <template v-if="shouldShowActionsMenu(job.id)" #actions>
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
                <DropdownMenu
                  :open="openActionsJobId === job.id"
                  @update:open="onActionsMenuOpenChange(job.id, $event)"
                >
                  <DropdownMenuTrigger as-child>
                    <Button
                      class="job-actions-menu-trigger"
                      variant="secondary"
                      size="icon"
                      :aria-label="t('g.more')"
                      @click.stop
                    >
                      <i class="icon-[lucide--ellipsis] size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    close-on-scroll
                    class="z-1700 bg-transparent p-0 shadow-lg"
                    :side-offset="4"
                    :collision-padding="8"
                  >
                    <JobMenuItems
                      :entries="getMenuEntries(job)"
                      surface="dropdown"
                      @action="onMenuAction($event)"
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </template>
            </AssetsListItem>
          </ContextMenuTrigger>
          <ContextMenuContent
            close-on-scroll
            class="z-1700 bg-transparent p-0 font-inter shadow-lg"
          >
            <JobMenuItems
              :entries="getMenuEntries(job)"
              surface="context"
              @action="onMenuAction($event)"
            />
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="activeDetails && popoverPosition"
      class="job-details-popover fixed z-1700"
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
import ContextMenu from '@/components/ui/context-menu/ContextMenu.vue'
import ContextMenuContent from '@/components/ui/context-menu/ContextMenuContent.vue'
import ContextMenuTrigger from '@/components/ui/context-menu/ContextMenuTrigger.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import type { MenuActionEntry, MenuEntry } from '@/types/menuTypes'
import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'
import { useJobDetailsHover } from '@/composables/queue/useJobDetailsHover'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import { cn } from '@/utils/tailwindUtil'
import { iconForJobState } from '@/utils/queueDisplay'
import { isActiveJobState } from '@/utils/queueUtil'
import JobMenuItems from './JobMenuItems.vue'

const { displayedJobGroups, getMenuEntries } = defineProps<{
  displayedJobGroups: JobGroup[]
  getMenuEntries: (item: JobListItem) => MenuEntry[]
}>()

const emit = defineEmits<{
  (e: 'cancelItem', item: JobListItem): void
  (e: 'deleteItem', item: JobListItem): void
  (e: 'menu-action', entry: MenuActionEntry): void
  (e: 'viewItem', item: JobListItem): void
}>()

const { t } = useI18n()
const hoveredJobId = ref<string | null>(null)
const openActionsJobId = ref<string | null>(null)
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
  scheduleDetailsHide(jobId)
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

function shouldShowActionsMenu(jobId: string) {
  return hoveredJobId.value === jobId || openActionsJobId.value === jobId
}

function onActionsMenuOpenChange(jobId: string, isOpen: boolean) {
  if (isOpen) {
    openActionsJobId.value = jobId
    return
  }

  if (openActionsJobId.value === jobId) {
    openActionsJobId.value = null
  }
}

function onMenuAction(entry: MenuActionEntry) {
  resetActiveDetails()
  emit('menu-action', entry)
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
  scheduleDetailsHide(activeDetails.value?.jobId)
}

function getJobIconClass(job: JobListItem): string | undefined {
  const iconName = job.iconName ?? iconForJobState(job.state)
  if (!job.iconImageUrl && iconName === iconForJobState('pending')) {
    return 'animate-spin'
  }
  return undefined
}
</script>
