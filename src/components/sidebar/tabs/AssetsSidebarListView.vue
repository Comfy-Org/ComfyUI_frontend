<template>
  <div class="flex h-full flex-col">
    <div v-if="activeJobItems.length" class="flex flex-col gap-2 px-2">
      <AssetsListCard
        v-for="job in activeJobItems"
        :key="job.id"
        :class="getJobCardClass()"
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
        <template
          v-if="hoveredJobId === job.id && getJobActions(job).length"
          #actions
        >
          <Button
            v-for="action in getJobActions(job)"
            :key="action.key"
            :variant="action.variant"
            size="icon"
            :aria-label="action.label"
            @click.stop="handleJobAction(action, job)"
          >
            <i :class="action.icon" class="size-4" />
          </Button>
        </template>
      </AssetsListCard>
    </div>

    <div
      v-if="assets.length"
      :class="cn('px-2', activeJobItems.length && 'mt-2')"
    >
      <div
        class="flex items-center py-2 text-sm font-normal leading-normal text-muted-foreground font-inter"
      >
        {{ t('sideToolbar.generatedAssetsHeader') }}
      </div>
    </div>

    <VirtualGrid
      class="flex-1"
      :items="assetItems"
      :grid-style="listGridStyle"
      @approach-end="emit('approach-end')"
    >
      <template #item="{ item }">
        <AssetsListCard
          role="button"
          tabindex="0"
          :aria-label="
            t('assetBrowser.ariaLabel.assetCard', {
              name: item.asset.name,
              type: getMediaTypeFromFilename(item.asset.name)
            })
          "
          :class="getAssetCardClass(isSelected(item.asset.id))"
          :preview-url="item.asset.preview_url"
          :preview-alt="item.asset.name"
          :icon-name="getAssetIconName(item.asset)"
          :primary-text="getAssetPrimaryText(item.asset)"
          :secondary-text="getAssetSecondaryText(item.asset)"
          @click.stop="emit('select-asset', item.asset)"
        />
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import Button from '@/components/ui/button/Button.vue'
import type { JobAction } from '@/composables/queue/useJobActions'
import { useJobActions } from '@/composables/queue/useJobActions'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobList } from '@/composables/queue/useJobList'
import AssetsListCard from '@/platform/assets/components/AssetsListCard.vue'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { JobState } from '@/types/queue'
import {
  formatDuration,
  formatSize,
  getMediaTypeFromFilename,
  truncateFilename
} from '@/utils/formatUtil'
import { iconForJobState } from '@/utils/queueDisplay'
import { cn } from '@/utils/tailwindUtil'

const { assets, isSelected } = defineProps<{
  assets: AssetItem[]
  isSelected: (assetId: string) => boolean
}>()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem): void
  (e: 'approach-end'): void
}>()

const { t } = useI18n()
const { jobItems } = useJobList()
const { getJobActions, runJobAction } = useJobActions()
const hoveredJobId = ref<string | null>(null)

type AssetListItem = { key: string; asset: AssetItem }

const activeJobItems = computed(() =>
  jobItems.value.filter((item) => isActiveJobState(item.state))
)

const assetItems = computed<AssetListItem[]>(() =>
  assets.map((asset) => ({
    key: `asset-${asset.id}`,
    asset
  }))
)

const listGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  padding: '0 0.5rem',
  gap: '0.5rem'
}

const listCardBaseClass =
  'w-full text-text-primary transition-colors hover:bg-secondary-background-hover'

function isActiveJobState(state: JobState): boolean {
  return (
    state === 'pending' || state === 'initialization' || state === 'running'
  )
}

function getAssetPrimaryText(asset: AssetItem): string {
  return truncateFilename(asset.name)
}

function getAssetSecondaryText(asset: AssetItem): string {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (typeof metadata?.executionTimeInSeconds === 'number') {
    return `${metadata.executionTimeInSeconds.toFixed(2)}s`
  }

  const duration = asset.user_metadata?.duration
  if (typeof duration === 'number') {
    return formatDuration(duration)
  }

  if (typeof asset.size === 'number') {
    return formatSize(asset.size)
  }

  return ''
}

function getAssetIconName(asset: AssetItem): string {
  const mediaType = getMediaTypeFromFilename(asset.name)
  if (mediaType === 'video') return 'icon-[lucide--video]'
  if (mediaType === 'audio') return 'icon-[lucide--music]'
  if (mediaType === '3D') return 'icon-[lucide--box]'
  return 'icon-[lucide--image]'
}

function getAssetCardClass(selected: boolean): string {
  return cn(
    listCardBaseClass,
    'cursor-pointer',
    selected &&
      'bg-secondary-background-hover ring-1 ring-inset ring-modal-card-border-highlighted'
  )
}

function getJobCardClass(): string {
  return cn(listCardBaseClass, 'cursor-default')
}

function onJobEnter(jobId: string) {
  hoveredJobId.value = jobId
}

function onJobLeave(jobId: string) {
  if (hoveredJobId.value === jobId) {
    hoveredJobId.value = null
  }
}

function getJobIconClass(job: JobListItem): string | undefined {
  const classes = []
  const iconName = job.iconName ?? iconForJobState(job.state)
  if (!job.iconImageUrl && iconName === iconForJobState('pending')) {
    classes.push('animate-spin')
  }
  return classes.length ? classes.join(' ') : undefined
}

function handleJobAction(action: JobAction, job: JobListItem) {
  void runJobAction(action, job)
}
</script>
