<template>
  <div class="flex items-center justify-between gap-2 px-3">
    <div class="min-w-0 flex-1 overflow-x-auto">
      <div class="inline-flex items-center gap-1 whitespace-nowrap">
        <button
          v-for="tab in jobTabs"
          :key="tab"
          class="h-6 rounded border-0 px-3 py-1 text-[12px] leading-none hover:opacity-90"
          :class="[
            selectedJobTab === tab
              ? 'bg-[var(--color-charcoal-500)] text-white'
              : 'bg-transparent text-[var(--color-slate-100)]'
          ]"
          @click="$emit('update:selectedJobTab', tab)"
        >
          {{ tabLabel(tab) }}
        </button>
      </div>
    </div>
    <div class="ml-2 flex shrink-0 items-center gap-2">
      <button
        v-tooltip.top="filterTooltipConfig"
        class="relative inline-flex size-6 items-center justify-center rounded border-0 bg-secondary-background p-0 hover:bg-secondary-background-hover hover:opacity-90"
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
          class="flex min-w-[12rem] flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3"
        >
          <button
            class="inline-flex w-full items-center justify-start gap-1 rounded-lg border-0 bg-transparent p-2 font-inter text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
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
          <div class="mx-2 mt-1 h-px" />
          <button
            class="inline-flex w-full items-center justify-start gap-1 rounded-lg border-0 bg-transparent p-2 font-inter text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
            :aria-label="
              t('sideToolbar.queueProgressOverlay.filterCurrentWorkflow')
            "
            @click="selectWorkflowFilter('current')"
          >
            <span>{{
              t('sideToolbar.queueProgressOverlay.filterCurrentWorkflow')
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
        class="relative inline-flex size-6 items-center justify-center rounded border-0 bg-secondary-background p-0 hover:bg-secondary-background-hover hover:opacity-90"
        :aria-label="t('sideToolbar.queueProgressOverlay.sortJobs')"
        @click="onSortClick"
      >
        <i
          class="icon-[lucide--arrow-up-down] block size-4 leading-none text-white"
        />
      </button>
      <Popover
        ref="sortPopoverRef"
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
        @hide="isSortOpen = false"
      >
        <div
          class="flex min-w-[12rem] flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3"
        >
          <template v-for="(mode, index) in jobSortModes" :key="mode">
            <button
              class="inline-flex w-full items-center justify-start gap-1 rounded-lg border-0 bg-transparent p-2 font-inter text-[12px] leading-none text-white hover:bg-transparent hover:opacity-90"
              :aria-label="sortLabel(mode)"
              @click="selectSortMode(mode)"
            >
              <span>{{ sortLabel(mode) }}</span>
              <span class="ml-auto inline-flex items-center">
                <i
                  v-if="selectedSortMode === mode"
                  class="icon-[lucide--check] block size-4 leading-none text-white"
                />
              </span>
            </button>
            <div
              v-if="index < jobSortModes.length - 1"
              class="mx-2 mt-1 h-px"
            />
          </template>
        </div>
      </Popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { jobSortModes, jobTabs } from '@/composables/queue/useJobList'
import type { JobSortMode } from '@/composables/queue/useJobList'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

defineProps<{
  selectedJobTab: (typeof jobTabs)[number]
  selectedWorkflowFilter: 'all' | 'current'
  selectedSortMode: JobSortMode
}>()

const emit = defineEmits<{
  (e: 'update:selectedJobTab', value: (typeof jobTabs)[number]): void
  (e: 'update:selectedWorkflowFilter', value: 'all' | 'current'): void
  (e: 'update:selectedSortMode', value: JobSortMode): void
}>()

const { t } = useI18n()
const filterPopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const isFilterOpen = ref(false)
const sortPopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const isSortOpen = ref(false)

const filterTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.filterBy'))
)
const sortTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.sortBy'))
)

const onFilterClick = (event: Event) => {
  if (filterPopoverRef.value) {
    filterPopoverRef.value.toggle(event)
    isFilterOpen.value = !isFilterOpen.value
  }
}
const selectWorkflowFilter = (value: 'all' | 'current') => {
  ;(filterPopoverRef.value as any)?.hide?.()
  isFilterOpen.value = false
  emit('update:selectedWorkflowFilter', value)
}

const onSortClick = (event: Event) => {
  if (sortPopoverRef.value) {
    sortPopoverRef.value.toggle(event)
    isSortOpen.value = !isSortOpen.value
  }
}

const selectSortMode = (value: JobSortMode) => {
  ;(sortPopoverRef.value as any)?.hide?.()
  isSortOpen.value = false
  emit('update:selectedSortMode', value)
}

const tabLabel = (tab: (typeof jobTabs)[number]) => {
  if (tab === 'All') return t('g.all')
  if (tab === 'Completed') return t('g.completed')
  return t('g.failed')
}

const sortLabel = (mode: JobSortMode) => {
  if (mode === 'mostRecent') {
    return t('queue.jobList.sortMostRecent')
  }
  if (mode === 'totalGenerationTime') {
    return t('queue.jobList.sortTotalGenerationTime')
  }
  return t('queue.jobList.sortComputeHoursUsed')
}
</script>
