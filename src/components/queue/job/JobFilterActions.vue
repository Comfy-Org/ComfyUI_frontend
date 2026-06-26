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
      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
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
        </DropdownMenuTrigger>
        <DropdownMenuContent size="lg" align="end" :side-offset="4">
          <DropdownMenuItem @select="onSelectWorkflowFilter('all')">
            {{ t('sideToolbar.queueProgressOverlay.filterAllWorkflows') }}
            <i
              v-if="selectedWorkflowFilter === 'all'"
              class="ml-auto icon-[lucide--check] size-3.5"
            />
          </DropdownMenuItem>
          <DropdownMenuItem @select="onSelectWorkflowFilter('current')">
            {{ t('sideToolbar.queueProgressOverlay.filterCurrentWorkflow') }}
            <i
              v-if="selectedWorkflowFilter === 'current'"
              class="ml-auto icon-[lucide--check] size-3.5"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
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
        </DropdownMenuTrigger>
        <DropdownMenuContent size="lg" align="end" :side-offset="4">
          <DropdownMenuItem
            v-for="mode in jobSortModes"
            :key="mode"
            @select="onSelectSortMode(mode)"
          >
            {{ sortLabel(mode) }}
            <i
              v-if="selectedSortMode === mode"
              class="ml-auto icon-[lucide--check] size-3.5"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { jobSortModes } from '@/composables/queue/useJobList'
import type { JobSortMode } from '@/composables/queue/useJobList'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'

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

const onSelectWorkflowFilter = (value: 'all' | 'current') => {
  trackFeatureUsed()
  selectedWorkflowFilter.value = value
}

const onSelectSortMode = (value: JobSortMode) => {
  trackFeatureUsed()
  selectedSortMode.value = value
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
