<template>
  <div class="flex items-center justify-between gap-2 px-3">
    <div class="min-w-0 flex-1 overflow-x-auto">
      <div class="inline-flex items-center gap-1 whitespace-nowrap">
        <Button
          v-for="tab in visibleJobTabs"
          :key="tab"
          :variant="selectedJobTab === tab ? 'secondary' : 'muted-textonly'"
          size="sm"
          class="px-3"
          @click="$emit('update:selectedJobTab', tab)"
        >
          {{ tabLabel(tab) }}
        </Button>
      </div>
    </div>
    <div class="ml-2 flex shrink-0 items-center gap-2">
      <Button
        v-if="showWorkflowFilter"
        v-tooltip.top="filterTooltipConfig"
        variant="secondary"
        size="icon"
        :aria-label="t('sideToolbar.queueProgressOverlay.filterJobs')"
        @click="onFilterClick"
      >
        <i class="icon-[lucide--list-filter] size-4" />
        <span
          v-if="selectedWorkflowFilter !== 'all'"
          class="pointer-events-none absolute -top-1 -right-1 inline-block size-2 rounded-full bg-base-foreground"
        />
      </Button>
      <Popover
        v-if="showWorkflowFilter"
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
      >
        <div
          class="flex min-w-[12rem] flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3"
        >
          <IconTextButton
            class="w-full justify-between gap-1 bg-transparent p-2 font-inter text-[12px] leading-none text-text-primary hover:bg-transparent hover:opacity-90"
            type="transparent"
            icon-position="right"
            :label="t('sideToolbar.queueProgressOverlay.filterAllWorkflows')"
            :aria-label="
              t('sideToolbar.queueProgressOverlay.filterAllWorkflows')
            "
            @click="selectWorkflowFilter('all')"
          >
            <template #icon>
              <i
                v-if="selectedWorkflowFilter === 'all'"
                class="icon-[lucide--check] block size-4 leading-none text-text-secondary"
              />
            </template>
          </IconTextButton>
          <div class="mx-2 mt-1 h-px" />
          <IconTextButton
            class="w-full justify-between gap-1 bg-transparent p-2 font-inter text-[12px] leading-none text-text-primary hover:bg-transparent hover:opacity-90"
            type="transparent"
            icon-position="right"
            :label="t('sideToolbar.queueProgressOverlay.filterCurrentWorkflow')"
            :aria-label="
              t('sideToolbar.queueProgressOverlay.filterCurrentWorkflow')
            "
            @click="selectWorkflowFilter('current')"
          >
            <template #icon>
              <i
                v-if="selectedWorkflowFilter === 'current'"
                class="icon-[lucide--check] block size-4 leading-none text-text-secondary"
              />
            </template>
          </IconTextButton>
        </div>
      </Popover>
      <Button
        v-tooltip.top="sortTooltipConfig"
        variant="secondary"
        size="icon"
        :aria-label="t('sideToolbar.queueProgressOverlay.sortJobs')"
        @click="onSortClick"
      >
        <i class="icon-[lucide--arrow-up-down] size-4" />
        <span
          v-if="selectedSortMode !== 'mostRecent'"
          class="pointer-events-none absolute -top-1 -right-1 inline-block size-2 rounded-full bg-base-foreground"
        />
      </Button>
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
      >
        <div
          class="flex min-w-[12rem] flex-col items-stretch rounded-lg border border-interface-stroke bg-interface-panel-surface px-2 py-3"
        >
          <template v-for="(mode, index) in jobSortModes" :key="mode">
            <IconTextButton
              class="w-full justify-between gap-1 bg-transparent p-2 font-inter text-[12px] leading-none text-text-primary hover:bg-transparent hover:opacity-90"
              type="transparent"
              icon-position="right"
              :label="sortLabel(mode)"
              :aria-label="sortLabel(mode)"
              @click="selectSortMode(mode)"
            >
              <template #icon>
                <i
                  v-if="selectedSortMode === mode"
                  class="icon-[lucide--check] block size-4 leading-none text-text-secondary"
                />
              </template>
            </IconTextButton>
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

import IconTextButton from '@/components/button/IconTextButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { jobSortModes, jobTabs } from '@/composables/queue/useJobList'
import type { JobSortMode, JobTab } from '@/composables/queue/useJobList'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { isCloud } from '@/platform/distribution/types'

const props = defineProps<{
  selectedJobTab: JobTab
  selectedWorkflowFilter: 'all' | 'current'
  selectedSortMode: JobSortMode
  hasFailedJobs: boolean
}>()

const emit = defineEmits<{
  (e: 'update:selectedJobTab', value: JobTab): void
  (e: 'update:selectedWorkflowFilter', value: 'all' | 'current'): void
  (e: 'update:selectedSortMode', value: JobSortMode): void
}>()

const { t } = useI18n()
const filterPopoverRef = ref<InstanceType<typeof Popover> | null>(null)
const sortPopoverRef = ref<InstanceType<typeof Popover> | null>(null)

const filterTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.filterBy'))
)
const sortTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.sortBy'))
)

// This can be removed when cloud implements /jobs and we switch to it.
const showWorkflowFilter = !isCloud

const visibleJobTabs = computed(() =>
  props.hasFailedJobs ? jobTabs : jobTabs.filter((tab) => tab !== 'Failed')
)

const onFilterClick = (event: Event) => {
  if (filterPopoverRef.value) {
    filterPopoverRef.value.toggle(event)
  }
}
const selectWorkflowFilter = (value: 'all' | 'current') => {
  ;(filterPopoverRef.value as any)?.hide?.()
  emit('update:selectedWorkflowFilter', value)
}

const onSortClick = (event: Event) => {
  if (sortPopoverRef.value) {
    sortPopoverRef.value.toggle(event)
  }
}

const selectSortMode = (value: JobSortMode) => {
  ;(sortPopoverRef.value as any)?.hide?.()
  emit('update:selectedSortMode', value)
}

const tabLabel = (tab: JobTab) => {
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
  return ''
}
</script>
