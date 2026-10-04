<template>
  <div class="flex min-w-0 items-center gap-2">
    <SearchInput
      v-if="showSearch"
      :model-value="searchQuery"
      class="min-w-0 flex-1"
      :placeholder="searchPlaceholderText"
      @update:model-value="onSearchQueryUpdate"
    />
    <div
      class="flex shrink-0 items-center gap-2"
      :class="{ 'ml-2': !showSearch }"
    >
      <Popover :show-arrow="false" :class="menuContentClass">
        <template #button>
          <Button
            v-tooltip.top="filterTooltipConfig"
            variant="secondary"
            size="icon"
            :aria-label="t('sideToolbar.queueProgressOverlay.filterJobs')"
          >
            <i class="icon-[lucide--list-filter] size-4" />
            <span
              v-if="selectedWorkflowFilter !== 'all'"
              class="pointer-events-none absolute -top-1 -right-1 inline-block size-2 rounded-full bg-base-foreground"
            />
          </Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col">
            <button
              type="button"
              :class="cn(menuButtonClass, 'justify-between')"
              @click="onSelectWorkflowFilter('all', close)"
            >
              <span>{{
                t('sideToolbar.queueProgressOverlay.filterAllWorkflows')
              }}</span>
              <i
                v-if="selectedWorkflowFilter === 'all'"
                class="icon-[lucide--check] size-4"
              />
            </button>
            <div class="mx-2 mt-1 h-px" />
            <button
              type="button"
              :class="cn(menuButtonClass, 'justify-between')"
              @click="onSelectWorkflowFilter('current', close)"
            >
              <span>{{
                t('sideToolbar.queueProgressOverlay.filterCurrentWorkflow')
              }}</span>
              <i
                v-if="selectedWorkflowFilter === 'current'"
                class="icon-[lucide--check] block size-4 leading-none text-text-secondary"
              />
            </button>
          </div>
        </template>
      </Popover>
      <Popover :show-arrow="false" :class="menuContentClass">
        <template #button>
          <Button
            v-tooltip.top="sortTooltipConfig"
            variant="secondary"
            size="icon"
            :aria-label="t('sideToolbar.queueProgressOverlay.sortJobs')"
          >
            <i class="icon-[lucide--arrow-up-down] size-4" />
            <span
              v-if="selectedSortMode !== 'mostRecent'"
              class="pointer-events-none absolute -top-1 -right-1 inline-block size-2 rounded-full bg-base-foreground"
            />
          </Button>
        </template>
        <template #default="{ close }">
          <div class="flex flex-col">
            <template v-for="(mode, index) in jobSortModes" :key="mode">
              <button
                type="button"
                :class="cn(menuButtonClass, 'justify-between')"
                @click="onSelectSortMode(mode, close)"
              >
                <span>{{ sortLabel(mode) }}</span>
                <i
                  v-if="selectedSortMode === mode"
                  class="icon-[lucide--check] size-4 text-text-secondary"
                />
              </button>
              <div
                v-if="index < jobSortModes.length - 1"
                class="mx-2 mt-1 h-px"
              />
            </template>
          </div>
        </template>
      </Popover>
      <Button
        v-if="showAssetsAction"
        v-tooltip.top="showAssetsTooltipConfig"
        variant="secondary"
        size="icon"
        :aria-label="t('sideToolbar.queueProgressOverlay.showAssetsPanel')"
        @click="emit('showAssets')"
      >
        <i class="icon-[comfy--image-ai-edit] size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import {
  menuButtonClass,
  menuContentClass
} from '@/components/ui/menu/menuStyles'
import { jobSortModes } from '@/composables/queue/useJobList'
import type { JobSortMode } from '@/composables/queue/useJobList'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'
import { cn } from '@comfyorg/tailwind-utils'

const {
  hideShowAssetsAction = false,
  showSearch = false,
  searchPlaceholder
} = defineProps<{
  hideShowAssetsAction?: boolean
  showSearch?: boolean
  searchPlaceholder?: string
}>()

const selectedWorkflowFilter = defineModel<'all' | 'current'>(
  'selectedWorkflowFilter',
  { required: true }
)
const selectedSortMode = defineModel<JobSortMode>('selectedSortMode', {
  required: true
})
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const emit = defineEmits<{
  (e: 'showAssets'): void
}>()

const { t } = useI18n()
const { trackFeatureUsed } = useSurveyFeatureTracking('queue-progress-overlay')

const filterTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.filterBy'))
)
const sortTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.sortBy'))
)
const showAssetsTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.showAssets'))
)
const showAssetsAction = computed(() => !hideShowAssetsAction)
const searchPlaceholderText = computed(
  () => searchPlaceholder ?? t('sideToolbar.queueProgressOverlay.searchJobs')
)

const selectWorkflowFilter = (value: 'all' | 'current') => {
  selectedWorkflowFilter.value = value
}

const onSelectWorkflowFilter = (
  value: 'all' | 'current',
  close: () => void
) => {
  trackFeatureUsed()
  selectWorkflowFilter(value)
  close()
}

const selectSortMode = (value: JobSortMode) => {
  selectedSortMode.value = value
}

const onSelectSortMode = (value: JobSortMode, close: () => void) => {
  trackFeatureUsed()
  selectSortMode(value)
  close()
}

const onSearchQueryUpdate = (value: string | undefined) => {
  searchQuery.value = value ?? ''
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
