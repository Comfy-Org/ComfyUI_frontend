<template>
  <div class="flex min-w-0 items-center gap-2">
    <SearchInput
      v-if="showSearch"
      :clear-label="$t('g.clear')"
      :accessible-label="searchPlaceholderText"
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
            :tooltip="t('sideToolbar.queueProgressOverlay.filterBy')"
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
            :tooltip="t('sideToolbar.queueProgressOverlay.sortBy')"
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
        :tooltip="t('sideToolbar.queueProgressOverlay.showAssets')"
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

import SearchInput from '@comfyorg/design-system/search-input/SearchInput'
import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuRadioGroup from '@comfyorg/design-system/menu/MenuRadioGroup'
import { jobSortModes } from '@/composables/queue/useJobList'
import type { JobSortMode } from '@/composables/queue/useJobList'
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
