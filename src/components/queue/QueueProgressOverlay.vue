<template>
  <div
    v-show="isVisible"
    :class="['flex', 'justify-end', 'w-full', 'pointer-events-none']"
  >
    <div
      class="pointer-events-auto w-[310px] min-w-[310px] rounded-lg border font-inter transition-colors duration-200 ease-in-out"
      :class="containerClass"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- Expanded state -->
      <div
        v-if="isExpanded"
        class="flex w-full flex-col gap-[var(--spacing-spacing-md)]"
      >
        <div
          class="flex h-12 items-center justify-between gap-[var(--spacing-spacing-xs)] border-b border-[var(--color-charcoal-400)] px-[var(--spacing-spacing-xs)]"
        >
          <div
            class="px-[var(--spacing-spacing-xs)] text-[14px] font-normal text-white"
          >
            <span>{{ headerTitle }}</span>
            <span
              v-if="showConcurrentIndicator"
              class="ml-[var(--spacing-spacing-md)] inline-flex items-center gap-[var(--spacing-spacing-xss)] text-blue-100"
            >
              <span class="inline-block size-2 rounded-full bg-blue-100" />
              <span>
                <span class="font-bold">{{ concurrentWorkflowCount }}</span>
                <span class="ml-[var(--spacing-spacing-xss)]">{{
                  t('sideToolbar.queueProgressOverlay.running')
                }}</span>
              </span>
            </span>
          </div>
          <div class="flex items-center gap-[var(--spacing-spacing-xss)]">
            <button
              v-tooltip.top="moreTooltipConfig"
              class="inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-100"
              :aria-label="t('sideToolbar.queueProgressOverlay.moreOptions')"
              @click="onMoreClick"
            >
              <i
                class="icon-[lucide--more-horizontal] block size-4 leading-none text-[var(--color-text-secondary)]"
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
                  class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xs)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
                  :aria-label="
                    t('sideToolbar.queueProgressOverlay.showAssetsPanel')
                  "
                  @click="onShowAssetsFromMenu"
                >
                  <i-comfy:image-ai-edit
                    class="block size-4 shrink-0 leading-none text-white"
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
                  class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xs)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
                  :aria-label="
                    t('sideToolbar.queueProgressOverlay.clearHistory')
                  "
                  @click="onClearHistoryFromMenu"
                >
                  <i
                    class="icon-[lucide--history] block size-4 leading-none text-white"
                  />
                  <span>{{
                    t('sideToolbar.queueProgressOverlay.clearHistory')
                  }}</span>
                </button>
                <div
                  class="px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xxs)]"
                >
                  <div class="h-px bg-[var(--color-charcoal-400)]" />
                </div>
              </div>
            </Popover>
            <button
              class="inline-flex size-6 items-center justify-center rounded border-0 bg-transparent p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-100"
              :aria-label="t('g.close')"
              @click="closeExpanded"
            >
              <i
                class="icon-[lucide--x] block size-4 leading-none text-[var(--color-text-secondary)]"
              />
            </button>
          </div>
        </div>

        <div class="flex w-full flex-col gap-[var(--spacing-spacing-md)]">
          <div
            class="flex items-center justify-between px-[var(--spacing-spacing-sm)]"
          >
            <button
              class="inline-flex h-8 flex-1 items-center justify-center gap-[var(--spacing-spacing-xxs)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-[var(--color-charcoal-500)] px-[var(--spacing-spacing-xs)] py-0 text-[12px] leading-none text-white hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
              :aria-label="t('sideToolbar.queueProgressOverlay.showAssets')"
              @click="openQueueSidebar"
            >
              <i-comfy:image-ai-edit
                class="pointer-events-none block size-4 shrink-0 leading-none"
                aria-hidden="true"
              />
              <span>{{
                t('sideToolbar.queueProgressOverlay.showAssets')
              }}</span>
            </button>

            <div
              class="ml-[var(--spacing-spacing-md)] inline-flex items-center"
            >
              <div
                class="inline-flex h-6 items-center text-[12px] leading-none text-white opacity-90"
              >
                <span class="font-bold">{{ queuedCount }}</span>
                <span class="ml-[var(--spacing-spacing-xss)]">{{
                  t('sideToolbar.queueProgressOverlay.queuedSuffix')
                }}</span>
              </div>
              <button
                v-if="queuedCount > 0"
                class="ml-[var(--spacing-spacing-xs)] inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
                :aria-label="t('sideToolbar.queueProgressOverlay.clearQueued')"
                @click="cancelQueuedWorkflows"
              >
                <i
                  class="pointer-events-none icon-[lucide--list-x] block size-4 leading-none text-white"
                />
              </button>
            </div>
          </div>

          <div
            class="flex items-center justify-between gap-[var(--spacing-spacing-xs)] px-[var(--spacing-spacing-sm)]"
          >
            <div class="min-w-0 flex-1 overflow-x-auto">
              <div
                class="inline-flex items-center gap-[var(--spacing-spacing-xss)] whitespace-nowrap"
              >
                <button
                  v-for="tab in jobTabs"
                  :key="tab"
                  class="h-6 rounded border-0 px-[var(--spacing-spacing-sm)] py-[var(--spacing-spacing-xss)] text-[12px] leading-none hover:opacity-90"
                  :class="[
                    selectedJobTab === tab
                      ? 'bg-[var(--color-charcoal-500)] text-white'
                      : 'bg-transparent text-[var(--color-slate-100)]'
                  ]"
                  @click="selectedJobTab = tab"
                >
                  {{ tabLabel(tab) }}
                </button>
              </div>
            </div>
            <div
              class="ml-[var(--spacing-spacing-xs)] flex shrink-0 items-center gap-[var(--spacing-spacing-xs)]"
            >
              <button
                v-tooltip.top="filterTooltipConfig"
                class="relative inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
                :aria-label="t('sideToolbar.queueProgressOverlay.filterJobs')"
                @click="onFilterClick"
              >
                <i
                  class="icon-[lucide--list-filter] block size-4 leading-none text-white"
                />
                <span
                  v-if="selectedWorkflowFilter !== 'all'"
                  class="pointer-events-none absolute -top-1 -right-1 inline-block size-2 rounded-full bg-black dark-theme:bg-white"
                />
              </button>
              <Popover
                ref="filterPopoverRef"
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
                @hide="isFilterOpen = false"
              >
                <div
                  class="flex min-w-[12rem] flex-col items-stretch rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-sm)]"
                >
                  <button
                    class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
                    :aria-label="
                      t('sideToolbar.queueProgressOverlay.filterAllWorkflows')
                    "
                    @click="selectWorkflowFilter('all')"
                  >
                    <span>{{
                      t('sideToolbar.queueProgressOverlay.filterAllWorkflows')
                    }}</span>
                    <span class="ml-auto inline-flex items-center">
                      <i
                        v-if="selectedWorkflowFilter === 'all'"
                        class="icon-[lucide--check] block size-4 leading-none text-white"
                      />
                    </span>
                  </button>
                  <div
                    class="mx-[var(--spacing-spacing-xs)] mt-[var(--spacing-spacing-xxs)] h-px"
                  />
                  <button
                    class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xss)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
                    :aria-label="
                      t(
                        'sideToolbar.queueProgressOverlay.filterCurrentWorkflow'
                      )
                    "
                    @click="selectWorkflowFilter('current')"
                  >
                    <span>{{
                      t(
                        'sideToolbar.queueProgressOverlay.filterCurrentWorkflow'
                      )
                    }}</span>
                    <span class="ml-auto inline-flex items-center">
                      <i
                        v-if="selectedWorkflowFilter === 'current'"
                        class="icon-[lucide--check] block size-4 leading-none text-white"
                      />
                    </span>
                  </button>
                </div>
              </Popover>
              <button
                v-tooltip.top="sortTooltipConfig"
                class="inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
                :aria-label="t('sideToolbar.queueProgressOverlay.sortJobs')"
              >
                <i
                  class="icon-[lucide--arrow-up-down] block size-4 leading-none text-white"
                />
              </button>
            </div>
          </div>

          <div
            class="flex flex-col gap-[var(--spacing-spacing-md)] px-[var(--spacing-spacing-sm)] pb-[var(--spacing-spacing-md)]"
          >
            <div
              v-for="group in displayedJobGroups"
              :key="group.key"
              class="flex flex-col gap-[var(--spacing-spacing-xs)]"
            >
              <div
                class="text-[12px] leading-none text-[var(--color-slate-100)]"
              >
                {{ group.label }}
              </div>
              <QueueJobItem
                v-for="ji in group.items"
                :key="ji.id"
                :job-id="ji.id"
                :workflow-id="ji.taskRef?.workflow?.id"
                :state="ji.state"
                :title="ji.title"
                :right-text="ji.meta"
                :icon-name="ji.iconName"
                :icon-image-url="ji.iconImageUrl"
                :show-clear="ji.showClear"
                :show-menu="true"
                :progress-total-percent="ji.progressTotalPercent"
                :progress-current-percent="ji.progressCurrentPercent"
                :running-node-name="ji.runningNodeName"
                @clear="onClearItem(ji)"
                @menu="(ev) => onMenuItem(ji, ev)"
                @view="onViewItem(ji)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Passive/Active state -->
      <div
        v-else-if="hasActiveJob"
        class="flex flex-col gap-[var(--spacing-spacing-sm)] p-[var(--spacing-spacing-xs)]"
      >
        <div class="flex flex-col gap-[var(--spacing-spacing-xss)]">
          <div
            class="relative h-2 w-full overflow-hidden rounded-full border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)]"
          >
            <div
              class="absolute inset-0 h-full rounded-full transition-[width]"
              :style="totalProgressStyle"
            />
            <div
              class="absolute inset-0 h-full rounded-full transition-[width]"
              :style="currentNodeProgressStyle"
            />
          </div>
          <div
            class="flex items-start justify-end gap-[var(--spacing-spacing-md)] text-[12px] leading-none"
          >
            <div
              class="flex items-center gap-[var(--spacing-spacing-xss)] text-white opacity-90"
            >
              <i18n-t keypath="sideToolbar.queueProgressOverlay.total">
                <template #percent>
                  <span class="font-bold">{{ totalPercentFormatted }}</span>
                </template>
              </i18n-t>
            </div>
            <div
              class="flex items-center gap-[var(--spacing-spacing-xss)] text-[var(--color-slate-100)]"
            >
              <span>{{
                t('sideToolbar.queueProgressOverlay.currentNode')
              }}</span>
              <span class="inline-block max-w-[10rem] truncate">{{
                currentNodeName
              }}</span>
              <span class="flex items-center gap-[var(--spacing-spacing-xss)]">
                <span>{{ currentNodePercent }}</span>
                <span>%</span>
              </span>
            </div>
          </div>
        </div>

        <div :class="bottomRowClass">
          <div
            class="flex items-center gap-[var(--spacing-spacing-xs)] text-[12px] text-white"
          >
            <span class="opacity-90">
              <span class="font-bold">{{ runningCount }}</span>
              <span class="ml-[var(--spacing-spacing-xss)]">{{
                t('sideToolbar.queueProgressOverlay.running')
              }}</span>
            </span>
            <button
              v-if="runningCount > 0"
              class="inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
              :aria-label="t('sideToolbar.queueProgressOverlay.interruptAll')"
              @click="interruptAll"
            >
              <i
                class="icon-[lucide--x] block size-4 leading-none text-white"
              />
            </button>
          </div>

          <button
            class="w-full rounded border-0 bg-[var(--color-charcoal-500)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xss)] text-[12px] text-white hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
            @click="viewAllJobs"
          >
            {{ t('sideToolbar.queueProgressOverlay.viewAllJobs') }}
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="pointer-events-auto">
        <CompletionSummaryBanner
          v-if="completionSummary"
          :mode="completionSummary.mode"
          :completed-count="completionSummary.completedCount"
          :failed-count="completionSummary.failedCount"
          :thumbnail-urls="completionSummary.thumbnailUrls"
          :aria-label="
            t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')
          "
          @click="onSummaryClick"
        />
        <button
          v-else
          type="button"
          class="group flex h-10 w-full items-center justify-between gap-[calc(var(--spacing-spacing-xs)+var(--spacing-spacing-xss))] rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] py-[var(--spacing-spacing-xss)] pr-[var(--spacing-spacing-xs)] pl-[calc(var(--spacing-spacing-xs)*2)] text-left transition-colors duration-200 ease-in-out hover:cursor-pointer hover:border-[var(--color-charcoal-300)] hover:bg-[var(--color-charcoal-700)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-slate-200)]"
          :aria-label="
            t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')
          "
          @click="openExpandedFromEmpty"
        >
          <span class="text-[14px] leading-none font-normal text-white">
            {{ t('sideToolbar.queueProgressOverlay.noActiveJobs') }}
          </span>
          <span
            class="flex items-center justify-center rounded p-[var(--spacing-spacing-xss)] text-[var(--color-slate-100)] transition-colors duration-200 ease-in-out group-hover:bg-[var(--color-charcoal-600)] group-hover:text-white"
          >
            <i class="icon-[lucide--chevron-down] block size-4 leading-none" />
          </span>
        </button>
      </div>
    </div>
  </div>
  <Popover
    ref="jobItemPopoverRef"
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
    @hide="isJobMenuOpen = false"
  >
    <div
      class="flex min-w-[14rem] flex-col items-stretch rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-sm)] font-inter"
    >
      <template v-for="entry in jobMenuEntries" :key="entry.key">
        <div
          v-if="entry.kind === 'divider'"
          class="px-[var(--spacing-spacing-xs)] py-[var(--spacing-spacing-xxs)]"
        >
          <div class="h-px bg-[var(--color-charcoal-400)]" />
        </div>
        <button
          v-else
          class="inline-flex w-full items-center justify-start gap-[var(--spacing-spacing-xs)] rounded-[var(--corner-radius-corner-radius-md)] border-0 bg-transparent p-[var(--spacing-spacing-xs)] text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
          :aria-label="entry.label"
          @click="onJobMenuEntryClick(entry)"
        >
          <i
            v-if="entry.icon"
            :class="[
              entry.icon,
              'block size-4 shrink-0 leading-none text-white'
            ]"
          />
          <span>{{ entry.label }}</span>
        </button>
      </template>
    </div>
  </Popover>
  <ResultGallery
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import QueueJobItem from '@/components/queue/QueueJobItem.vue'
import CompletionSummaryBanner from '@/components/queue/overlay/CompletionSummaryBanner.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import { useCompletionSummary } from '@/composables/queue/useCompletionSummary'
import { jobTabs, useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobMenu } from '@/composables/queue/useJobMenu'
import type { MenuEntry } from '@/composables/queue/useJobMenu'
import { useQueueActions } from '@/composables/queue/useQueueActions'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

const { t } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()

const {
  totalPercentFormatted,
  currentNodePercent,
  totalProgressStyle,
  currentNodeProgressStyle
} = useQueueProgress()
const isHovered = ref(false)
const isExpanded = ref(false)
const isMoreOpen = ref(false)
const containerClass = computed(() =>
  showBackground.value
    ? 'border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] shadow-md'
    : 'border-transparent bg-transparent shadow-none'
)
const bottomRowClass = computed(
  () =>
    `flex items-center justify-end gap-[var(--spacing-spacing-md)] transition-opacity duration-200 ease-in-out ${
      isActiveState.value
        ? 'opacity-100 pointer-events-auto'
        : 'opacity-0 pointer-events-none'
    }`
)

const runningCount = computed(() => queueStore.runningTasks.length)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const hasHistory = computed(() => queueStore.historyTasks.length > 0)
const isExecuting = computed(() => !executionStore.isIdle)
const hasActiveJob = computed(() => runningCount.value > 0 || isExecuting.value)
const activeJobsCount = computed(
  () => runningCount.value + queueStore.pendingTasks.length
)

const isFullyInvisible = computed(
  () => !hasActiveJob.value && !hasHistory.value
)
const isEmptyState = computed(() => !hasActiveJob.value && hasHistory.value)
const isActiveState = computed(() => hasActiveJob.value && isHovered.value)

const showBackground = computed(
  () => isExpanded.value || isActiveState.value || isEmptyState.value
)

const isVisible = computed(() => !isFullyInvisible.value)
const { summary: completionSummary, clearSummary } = useCompletionSummary()

const headerTitle = computed(() =>
  hasActiveJob.value
    ? `${activeJobsCount.value} ${t('sideToolbar.queueProgressOverlay.activeJobsSuffix')}`
    : t('sideToolbar.queueProgressOverlay.jobQueue')
)

const concurrentWorkflowCount = computed(
  () => executionStore.runningWorkflowCount
)
const showConcurrentIndicator = computed(
  () => concurrentWorkflowCount.value > 1
)

const tabLabel = (tab: (typeof jobTabs)[number]) => {
  if (tab === 'All') return t('g.all')
  if (tab === 'Completed') return t('g.completed')
  return t('g.failed')
}
const {
  selectedJobTab,
  selectedWorkflowFilter,
  filteredTasks,
  groupedJobItems,
  currentNodeName
} = useJobList()

const displayedJobGroups = computed(() => groupedJobItems.value)

const onClearItem = async (item: JobListItem) => {
  if (!item.taskRef) return
  await queueStore.delete(item.taskRef)
}

const jobItemPopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const isJobMenuOpen = ref(false)
const currentMenuItem = ref<JobListItem | null>(null)
const onMenuItem = (item: JobListItem, event: Event) => {
  currentMenuItem.value = item
  if (jobItemPopoverRef.value) {
    jobItemPopoverRef.value.toggle(event)
    isJobMenuOpen.value = !isJobMenuOpen.value
  }
}

const { jobMenuEntries } = useJobMenu(() => currentMenuItem.value)

const onJobMenuEntryClick = async (entry: MenuEntry) => {
  if (entry.kind === 'divider') return
  if (entry.onClick) await entry.onClick()
  if (jobItemPopoverRef.value) jobItemPopoverRef.value.hide()
  isJobMenuOpen.value = false
}

const { galleryActiveIndex, galleryItems, onViewItem } = useResultGallery(
  () => filteredTasks.value
)

const openExpandedFromEmpty = () => {
  isExpanded.value = true
}

const closeExpanded = () => {
  isExpanded.value = false
}

const viewAllJobs = async () => {
  isExpanded.value = true
}

const onSummaryClick = () => {
  openExpandedFromEmpty()
  clearSummary()
}

const { openQueueSidebar, cancelQueuedWorkflows, interruptAll } =
  useQueueActions()

const morePopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const moreTooltipConfig = computed(() => buildTooltipConfig(t('g.more')))
const filterTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.filterBy'))
)
const sortTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.sortBy'))
)
const filterPopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const isFilterOpen = ref(false)
const onFilterClick = (event: Event) => {
  if (filterPopoverRef.value) {
    filterPopoverRef.value.toggle(event)
    isFilterOpen.value = !isFilterOpen.value
  }
}
const selectWorkflowFilter = (value: 'all' | 'current') => {
  selectedWorkflowFilter.value = value
  filterPopoverRef.value?.hide()
  isFilterOpen.value = false
}
const onMoreClick = (event: Event) => {
  if (morePopoverRef.value) {
    morePopoverRef.value.toggle(event)
    isMoreOpen.value = !isMoreOpen.value
  }
}
const onShowAssetsFromMenu = () => {
  openQueueSidebar()
  morePopoverRef.value?.hide()
  isMoreOpen.value = false
}
const onClearHistoryFromMenu = async () => {
  await queueStore.clear(['history'])
  morePopoverRef.value?.hide()
  isMoreOpen.value = false
}
</script>
