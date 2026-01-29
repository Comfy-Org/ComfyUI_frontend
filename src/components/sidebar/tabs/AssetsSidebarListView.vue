<template>
  <div class="flex h-full flex-col">
    <div
      v-if="activeJobItems.length"
      class="flex max-h-[50%] scrollbar-custom flex-col gap-2 overflow-y-auto px-2"
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

    <div
      v-if="assets.length"
      :class="cn('px-2', activeJobItems.length && 'mt-2')"
    >
      <div
        class="flex items-center p-2 text-sm font-normal leading-normal text-muted-foreground font-inter"
      >
        {{
          t(
            assetType === 'input'
              ? 'sideToolbar.importedAssetsHeader'
              : 'sideToolbar.generatedAssetsHeader'
          )
        }}
      </div>
    </div>

    <VirtualGrid
      class="flex-1"
      :items="assetItems"
      :grid-style="listGridStyle"
      @approach-end="emit('approach-end')"
    >
      <template #item="{ item }">
        <div class="relative">
          <LoadingOverlay
            :loading="assetsStore.isAssetDeleting(item.asset.id)"
            size="sm"
          >
            <i class="pi pi-trash text-xs" />
          </LoadingOverlay>
          <AssetsListItem
            role="button"
            tabindex="0"
            :aria-label="
              t('assetBrowser.ariaLabel.assetCard', {
                name: item.asset.name,
                type: getMediaTypeFromFilename(item.asset.name)
              })
            "
            :class="getAssetCardClass(isSelected(item.asset.id))"
            :preview-url="item.asset.preview_url ?? undefined"
            :preview-alt="item.asset.name"
            :icon-name="
              iconForMediaType(getMediaTypeFromFilename(item.asset.name))
            "
            :primary-text="getAssetPrimaryText(item.asset)"
            :secondary-text="getAssetSecondaryText(item.asset)"
            @mouseenter="onAssetEnter(item.asset.id)"
            @mouseleave="onAssetLeave(item.asset.id)"
            @contextmenu.prevent.stop="emit('context-menu', $event, item.asset)"
            @click.stop="emit('select-asset', item.asset)"
          >
            <template v-if="hoveredAssetId === item.asset.id" #actions>
              <Button
                variant="secondary"
                size="icon"
                :aria-label="t('mediaAsset.actions.moreOptions')"
                @click.stop="emit('context-menu', $event, item.asset)"
              >
                <i class="icon-[lucide--ellipsis] size-4" />
              </Button>
            </template>
          </AssetsListItem>
        </div>
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import Button from '@/components/ui/button/Button.vue'
import { useJobActions } from '@/composables/queue/useJobActions'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobList } from '@/composables/queue/useJobList'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { useAssetsStore } from '@/stores/assetsStore'
import { isActiveJobState } from '@/utils/queueUtil'
import {
  formatDuration,
  formatSize,
  getMediaTypeFromFilename,
  truncateFilename
} from '@/utils/formatUtil'
import { iconForJobState } from '@/utils/queueDisplay'
import { cn } from '@/utils/tailwindUtil'

const {
  assets,
  isSelected,
  assetType = 'output'
} = defineProps<{
  assets: AssetItem[]
  isSelected: (assetId: string) => boolean
  assetType?: 'input' | 'output'
}>()

const assetsStore = useAssetsStore()

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'approach-end'): void
}>()

const { t } = useI18n()
const { jobItems } = useJobList()
const hoveredJobId = ref<string | null>(null)
const hoveredAssetId = ref<string | null>(null)

type AssetListItem = { key: string; asset: AssetItem }

const activeJobItems = computed(() =>
  jobItems.value.filter((item) => isActiveJobState(item.state))
)
const hoveredJob = computed(() =>
  hoveredJobId.value
    ? (activeJobItems.value.find((job) => job.id === hoveredJobId.value) ??
      null)
    : null
)
const { cancelAction, canCancelJob, runCancelJob } = useJobActions(hoveredJob)

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

function getAssetCardClass(selected: boolean): string {
  return cn(
    'w-full text-text-primary transition-colors hover:bg-secondary-background-hover',
    'cursor-pointer',
    selected &&
      'bg-secondary-background-hover ring-1 ring-inset ring-modal-card-border-highlighted'
  )
}

function onJobEnter(jobId: string) {
  hoveredJobId.value = jobId
}

function onJobLeave(jobId: string) {
  if (hoveredJobId.value === jobId) {
    hoveredJobId.value = null
  }
}

function onAssetEnter(assetId: string) {
  hoveredAssetId.value = assetId
}

function onAssetLeave(assetId: string) {
  if (hoveredAssetId.value === assetId) {
    hoveredAssetId.value = null
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
</script>
