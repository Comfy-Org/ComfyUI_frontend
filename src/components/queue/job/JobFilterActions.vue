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
      <BaseTooltip
        :text="t('sideToolbar.queueProgressOverlay.filterBy')"
        side="top"
      >
        <div>
          <Popover :show-arrow="false">
            <template #button>
              <Button
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
              <div class="flex min-w-48 flex-col items-stretch">
                <Button
                  class="w-full justify-between"
                  variant="textonly"
                  size="md"
                  @click="onSelectWorkflowFilter('all', close)"
                >
                  <span>{{
                    t('sideToolbar.queueProgressOverlay.filterAllWorkflows')
                  }}</span>
                  <i
                    v-if="selectedWorkflowFilter === 'all'"
                    class="icon-[lucide--check] size-4"
                  />
                </Button>
                <div class="mx-2 mt-1 h-px" />
                <Button
                  class="w-full justify-between"
                  variant="textonly"
                  size="md"
                  @click="onSelectWorkflowFilter('current', close)"
                >
                  <span>{{
                    t('sideToolbar.queueProgressOverlay.filterCurrentWorkflow')
                  }}</span>
                  <i
                    v-if="selectedWorkflowFilter === 'current'"
                    class="icon-[lucide--check] block size-4 leading-none text-text-secondary"
                  />
                </Button>
              </div>
            </template>
          </Popover>
        </div>
      </BaseTooltip>
      <BaseTooltip
        :text="t('sideToolbar.queueProgressOverlay.sortBy')"
        side="top"
      >
        <div>
          <Popover :show-arrow="false">
            <template #button>
              <Button
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
              <div class="flex min-w-48 flex-col items-stretch">
                <template v-for="(mode, index) in jobSortModes" :key="mode">
                  <Button
                    class="w-full justify-between"
                    variant="textonly"
                    size="md"
                    @click="onSelectSortMode(mode, close)"
                  >
                    <span>{{ sortLabel(mode) }}</span>
                    <i
                      v-if="selectedSortMode === mode"
                      class="icon-[lucide--check] size-4 text-text-secondary"
                    />
                  </Button>
                  <div
                    v-if="index < jobSortModes.length - 1"
                    class="mx-2 mt-1 h-px"
                  />
                </template>
              </div>
            </template>
          </Popover>
        </div>
      </BaseTooltip>
      <BaseTooltip
        v-if="showAssetsAction"
        :text="t('sideToolbar.queueProgressOverlay.showAssets')"
        side="top"
      >
        <Button
          variant="secondary"
          size="icon"
          :aria-label="t('sideToolbar.queueProgressOverlay.showAssetsPanel')"
          @click="emit('showAssets')"
        >
          <i class="icon-[comfy--image-ai-edit] size-4" />
        </Button>
      </BaseTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import { jobSortModes } from '@/composables/queue/useJobList'
import type { JobSortMode } from '@/composables/queue/useJobList'
import BaseTooltip from '@/components/ui/tooltip/BaseTooltip.vue'

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
  selectWorkflowFilter(value)
  close()
}

const selectSortMode = (value: JobSortMode) => {
  selectedSortMode.value = value
}

const onSelectSortMode = (value: JobSortMode, close: () => void) => {
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
