<script setup lang="ts">
import { unrefElement, whenever } from '@vueuse/core'
import Popover from '@/components/common/ImperativePopover.vue'
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Loader from '@/components/loader/Loader.vue'
import ToastPanel from '@/components/ui/toast/ToastPanel.vue'
import ProgressToastItem from '@/components/toast/ProgressToastItem.vue'
import Button from '@/components/ui/button/Button.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { reportError } from '@/platform/telemetry/reportError'
import type { TaskId } from '@/platform/tasks/services/taskService'
import {
  isDownloadCancelled,
  useAssetDownloadStore
} from '@/stores/assetDownloadStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const assetDownloadStore = useAssetDownloadStore()
const { toastErrorHandler } = useErrorHandling()

const visible = computed(() => assetDownloadStore.hasDownloads)

const isExpanded = ref(false)
const activeFilter = ref<'all' | 'completed' | 'failed'>('all')
const filterPopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const disclosureButtonRef = useTemplateRef<ComponentPublicInstance>(
  'disclosureButtonRef'
)

whenever(
  () => !isExpanded.value,
  () => filterPopoverRef.value?.hide()
)

const filterOptions = [
  { value: 'all', label: 'all' },
  { value: 'completed', label: 'completed' },
  { value: 'failed', label: 'failed' }
] as const

function onFilterClick(event: Event) {
  filterPopoverRef.value?.toggle(event)
}

function setFilter(filter: typeof activeFilter.value) {
  activeFilter.value = filter
  filterPopoverRef.value?.hide()
}

const downloadJobs = computed(() => assetDownloadStore.downloadList)
const completedJobs = computed(() =>
  assetDownloadStore.finishedDownloads.filter((d) => d.status === 'completed')
)
const failedJobs = computed(() =>
  assetDownloadStore.finishedDownloads.filter((d) => d.status === 'failed')
)
const cancelledJobs = computed(() =>
  assetDownloadStore.downloadList.filter((download) =>
    isDownloadCancelled(download.status)
  )
)

const isInProgress = computed(() => assetDownloadStore.hasActiveDownloads)
const currentJobName = computed(() => {
  const activeJob = downloadJobs.value.find((job) => job.status === 'running')
  return activeJob?.assetName || t('progressToast.downloadingModel')
})

const outcomeLabel = computed(() => {
  if (failedJobs.value.length > 0)
    return t('progressToast.downloadsFailed', {
      count: failedJobs.value.length
    })
  if (cancelledJobs.value.length > 0) return t('electronFileDownload.cancelled')
  return t('progressToast.allDownloadsCompleted')
})

const announcement = computed(() =>
  isInProgress.value ? t('progressToast.importingModels') : outcomeLabel.value
)

const completedCount = computed(
  () =>
    completedJobs.value.length +
    failedJobs.value.length +
    cancelledJobs.value.length
)
const totalCount = computed(() => downloadJobs.value.length)

const filteredJobs = computed(() => {
  switch (activeFilter.value) {
    case 'completed':
      return completedJobs.value
    case 'failed':
      return failedJobs.value
    default:
      return downloadJobs.value
  }
})

const activeFilterLabel = computed(() => {
  const option = filterOptions.find((f) => f.value === activeFilter.value)
  return option
    ? t(`progressToast.filter.${option.label}`)
    : t('progressToast.filter.all')
})

function closeDialog() {
  assetDownloadStore.clearDismissibleDownloads()
  isExpanded.value = false
}

async function cancelDownload(taskId: TaskId) {
  const result = await assetDownloadStore.cancelDownload(taskId)
  if (result.ok) {
    await nextTick()
    unrefElement(disclosureButtonRef)?.focus()
    return
  }

  reportError(result.error, {
    surface: 'assets',
    errorType: 'asset_download_cancellation_failure',
    logToConsole: false
  })
  toastErrorHandler(result.error)
}
</script>

<template>
  <ToastPanel v-model:expanded="isExpanded" :visible :announcement>
    <template #default>
      <div
        class="flex h-12 items-center justify-between border-b border-border-default px-4"
      >
        <h3 class="text-sm font-bold text-base-foreground">
          {{ t('progressToast.importingModels') }}
        </h3>
        <div class="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            class="gap-1.5 px-2"
            @click="onFilterClick"
          >
            <i class="icon-[lucide--list-filter] size-4" />
            <span>{{ activeFilterLabel }}</span>
            <i class="icon-[lucide--chevron-down] size-3" />
          </Button>
          <Popover
            ref="filterPopoverRef"
            align="end"
            content-class="border-none bg-transparent p-0 pt-2"
          >
            <div
              class="flex min-w-30 flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3"
            >
              <Button
                v-for="option in filterOptions"
                :key="option.value"
                variant="textonly"
                size="sm"
                :class="
                  cn(
                    'w-full justify-start bg-transparent',
                    activeFilter === option.value &&
                      'bg-secondary-background-selected'
                  )
                "
                @click="setFilter(option.value)"
              >
                {{ t(`progressToast.filter.${option.label}`) }}
              </Button>
            </div>
          </Popover>
        </div>
      </div>

      <div class="relative max-h-75 overflow-y-auto p-4">
        <div
          v-if="filteredJobs.length > 3"
          class="absolute top-4 right-1 h-12 w-1 rounded-full bg-muted-foreground"
        />

        <div class="flex flex-col gap-2">
          <ProgressToastItem
            v-for="job in filteredJobs"
            :key="job.taskId"
            :job="job"
            :is-cancelling="
              assetDownloadStore.cancellingTaskIds.has(job.taskId)
            "
            @cancel="cancelDownload"
          />
        </div>

        <div
          v-if="filteredJobs.length === 0"
          class="flex flex-col items-center justify-center py-6 text-center"
        >
          <span class="text-sm text-muted-foreground">
            {{
              t('progressToast.noImportsInQueue', {
                filter: activeFilterLabel
              })
            }}
          </span>
        </div>
      </div>
    </template>

    <template #footer="{ toggle }">
      <div
        class="flex h-12 items-center justify-between gap-2 border-t border-border-default px-4"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <template v-if="isInProgress">
            <Loader size="sm" class="shrink-0 text-muted-foreground" />
            <span
              class="min-w-0 flex-1 truncate font-bold text-base-foreground"
            >
              {{ currentJobName }}
            </span>
          </template>
          <template v-else-if="failedJobs.length > 0">
            <i
              class="icon-[lucide--circle-alert] size-4 shrink-0 text-destructive-background"
            />
            <span class="min-w-0 truncate font-bold text-base-foreground">
              {{ outcomeLabel }}
            </span>
          </template>
          <template v-else-if="cancelledJobs.length > 0">
            <i
              class="icon-[lucide--circle-x] size-4 shrink-0 text-muted-foreground"
            />
            <span class="min-w-0 truncate font-bold text-base-foreground">
              {{ outcomeLabel }}
            </span>
          </template>
          <template v-else>
            <i
              class="icon-[lucide--check-circle] size-4 shrink-0 text-jade-600"
            />
            <span class="min-w-0 truncate font-bold text-base-foreground">
              {{ outcomeLabel }}
            </span>
          </template>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span
            v-if="isInProgress"
            class="text-sm whitespace-nowrap text-muted-foreground"
          >
            {{
              t('progressToast.progressCount', {
                completed: completedCount,
                total: totalCount
              })
            }}
          </span>

          <div class="flex items-center">
            <Button
              ref="disclosureButtonRef"
              variant="muted-textonly"
              size="icon"
              :aria-label="
                isExpanded ? t('contextMenu.Collapse') : t('contextMenu.Expand')
              "
              @click.stop="toggle"
            >
              <i
                :class="
                  cn(
                    'size-4',
                    isExpanded
                      ? 'icon-[lucide--chevron-down]'
                      : 'icon-[lucide--chevron-up]'
                  )
                "
              />
            </Button>

            <Button
              v-if="!isInProgress"
              variant="muted-textonly"
              size="icon"
              :aria-label="t('g.close')"
              @click.stop="closeDialog"
            >
              <i class="icon-[lucide--x] size-4" />
            </Button>
          </div>
        </div>
      </div>
    </template>
  </ToastPanel>
</template>
