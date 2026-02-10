<template>
  <div class="flex h-full flex-col">
    <!-- Grid View -->
    <VirtualGrid
      v-if="viewMode === 'grid'"
      class="flex-1"
      :items="gridItems"
      :grid-style="gridStyle"
    >
      <template #item="{ item }">
        <ActiveMediaAssetCard :job="item.job" />
      </template>
    </VirtualGrid>

    <!-- List View -->
    <div
      v-else
      class="flex flex-1 scrollbar-custom flex-col gap-2 overflow-y-auto px-2"
    >
      <AssetsListItem
        v-for="job in activeJobItems"
        :key="job.id"
        :class="
          cn(
            'w-full shrink-0 text-text-primary transition-colors hover:bg-secondary-background-hover',
            'cursor-default'
          )
        "
        :preview-url="job.iconImageUrl"
        :preview-alt="job.title"
        :icon-name="job.iconName"
        :icon-class="getJobIconClass(job)"
        :primary-text="job.title"
        :secondary-text="job.meta"
        :progress-total-percent="job.progressTotalPercent"
        :progress-current-percent="job.progressCurrentPercent"
        @mouseenter="onJobEnter(job.id)"
        @mouseleave="onJobLeave(job.id)"
        @click.stop
      >
        <template v-if="hoveredJobId === job.id" #actions>
          <Button
            v-if="canCancelJob"
            :variant="cancelAction.variant"
            size="icon"
            :aria-label="cancelAction.label"
            @click.stop="runCancelJob()"
          >
            <i :class="cancelAction.icon" class="size-4" />
          </Button>
        </template>
      </AssetsListItem>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import Button from '@/components/ui/button/Button.vue'
import { useJobActions } from '@/composables/queue/useJobActions'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobList } from '@/composables/queue/useJobList'
import ActiveMediaAssetCard from '@/platform/assets/components/ActiveMediaAssetCard.vue'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import { isActiveJobState } from '@/utils/queueUtil'
import { iconForJobState } from '@/utils/queueDisplay'
import { cn } from '@/utils/tailwindUtil'

const { viewMode = 'grid' } = defineProps<{
  viewMode?: 'list' | 'grid'
}>()

const { jobItems } = useJobList()

const activeJobItems = computed(() =>
  jobItems.value
    .filter((item) => isActiveJobState(item.state))
    .slice()
    .reverse()
)

const gridItems = computed(() =>
  activeJobItems.value.map((job) => ({
    key: `queue-${job.id}`,
    job
  }))
)

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  padding: '0 0.5rem',
  gap: '0.5rem'
}

const hoveredJobId = ref<string | null>(null)
const hoveredJob = computed(() =>
  hoveredJobId.value
    ? (activeJobItems.value.find((job) => job.id === hoveredJobId.value) ??
      null)
    : null
)
const { cancelAction, canCancelJob, runCancelJob } = useJobActions(hoveredJob)

function onJobEnter(jobId: string) {
  hoveredJobId.value = jobId
}

function onJobLeave(jobId: string) {
  if (hoveredJobId.value === jobId) {
    hoveredJobId.value = null
  }
}

function getJobIconClass(job: JobListItem): string | undefined {
  const iconName = job.iconName ?? iconForJobState(job.state)
  if (!job.iconImageUrl && iconName === iconForJobState('pending')) {
    return 'animate-spin'
  }
  return undefined
}
</script>
