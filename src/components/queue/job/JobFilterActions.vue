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
      <Menu>
        <template #trigger>
          <Button
            v-tooltip.top="filterTooltipConfig"
            variant="secondary"
            size="icon"
            :aria-label="t('sideToolbar.queueProgressOverlay.filterJobs')"
            icon="icon-[lucide--list-filter]"
            :indicator="selectedWorkflowFilter !== 'all'"
          />
        </template>
        <MenuRadioGroup
          v-model="selectedWorkflowFilter"
          :options="workflowFilterOptions"
        />
      </Menu>
      <Menu>
        <template #trigger>
          <Button
            v-tooltip.top="sortTooltipConfig"
            variant="secondary"
            size="icon"
            :aria-label="t('sideToolbar.queueProgressOverlay.sortJobs')"
            icon="icon-[lucide--arrow-up-down]"
            :indicator="selectedSortMode !== 'mostRecent'"
          />
        </template>
        <MenuRadioGroup v-model="selectedSortMode" :options="sortOptions" />
      </Menu>
      <Button
        v-if="showAssetsAction"
        v-tooltip.top="showAssetsTooltipConfig"
        variant="secondary"
        size="icon"
        :aria-label="t('sideToolbar.queueProgressOverlay.showAssetsPanel')"
        icon="icon-[comfy--image-ai-edit]"
        @click="emit('showAssets')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import MenuRadioGroup from '@/components/ui/menu/MenuRadioGroup.vue'
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

const workflowFilterOptions = computed(() => [
  {
    value: 'all' as const,
    label: t('sideToolbar.queueProgressOverlay.filterAllWorkflows'),
    command: trackFeatureUsed
  },
  {
    value: 'current' as const,
    label: t('sideToolbar.queueProgressOverlay.filterCurrentWorkflow'),
    command: trackFeatureUsed
  }
])
const sortOptions = computed(() =>
  jobSortModes.map((value) => ({
    value,
    label: sortLabel(value),
    command: trackFeatureUsed
  }))
)

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
