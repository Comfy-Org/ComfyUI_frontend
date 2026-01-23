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
        <AssetsListItem
          role="button"
          tabindex="0"
          :aria-label="
            t('assetBrowser.ariaLabel.assetCard', {
              name: item.asset.name,
              type: getMediaTypeFromFilename(item.asset.name)
            })
          "
          :class="
            cn(
              getAssetCardClass(isSelected(item.asset.id)),
              item.isChild && 'pl-6'
            )
          "
          :preview-url="item.asset.preview_url"
          :preview-alt="item.asset.name"
          :icon-name="
            iconForMediaType(getMediaTypeFromFilename(item.asset.name))
          "
          :primary-text="getAssetPrimaryText(item.asset)"
          :secondary-text="getAssetSecondaryText(item.asset)"
          :stack-count="getStackCount(item.asset)"
          :stack-indicator-label="t('mediaAsset.actions.seeMoreOutputs')"
          :stack-expanded="isStackExpanded(item.asset)"
          @mouseenter="onAssetEnter(item.asset.id)"
          @mouseleave="onAssetLeave(item.asset.id)"
          @contextmenu.prevent.stop="emit('context-menu', $event, item.asset)"
          @click.stop="emit('select-asset', item.asset, selectableAssets)"
          @stack-toggle="toggleStack(item.asset)"
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
      </template>
    </VirtualGrid>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import VirtualGrid from '@/components/common/VirtualGrid.vue'
import Button from '@/components/ui/button/Button.vue'
import { useJobActions } from '@/composables/queue/useJobActions'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobList } from '@/composables/queue/useJobList'
import AssetsListItem from '@/platform/assets/components/AssetsListItem.vue'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema';
import type { OutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema';
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  mapOutputsToAssetItems,
  shouldLoadFullOutputs
} from '@/platform/assets/utils/outputAssetUtil'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import {
  getJobDetail,
  getPreviewableOutputsFromJobDetail
} from '@/services/jobOutputCache'
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

const emit = defineEmits<{
  (e: 'select-asset', asset: AssetItem, assets?: AssetItem[]): void
  (e: 'context-menu', event: MouseEvent, asset: AssetItem): void
  (e: 'approach-end'): void
  (e: 'assets-change', assets: AssetItem[]): void
}>()

const { t } = useI18n()
const { jobItems } = useJobList()
const hoveredJobId = ref<string | null>(null)
const hoveredAssetId = ref<string | null>(null)
const expandedStackPromptIds = ref<Set<string>>(new Set())
const stackChildrenByPromptId = ref<Record<string, AssetItem[]>>({})
const loadingStackPromptIds = ref<Set<string>>(new Set())

type AssetListItem = {
  key: string
  asset: AssetItem
  isChild?: boolean
}

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

const assetItems = computed<AssetListItem[]>(() => {
  const items: AssetListItem[] = []

  for (const asset of assets) {
    const promptId = getStackPromptId(asset)
    items.push({
      key: `asset-${asset.id}`,
      asset
    })

    if (!promptId || !expandedStackPromptIds.value.has(promptId)) {
      continue
    }

    const children = stackChildrenByPromptId.value[promptId] ?? []
    for (const child of children) {
      items.push({
        key: `asset-${child.id}`,
        asset: child,
        isChild: true
      })
    }
  }

  return items
})

const selectableAssets = computed(() =>
  assetItems.value.map((item) => item.asset)
)

watch(
  selectableAssets,
  (nextAssets) => {
    emit('assets-change', nextAssets)
  },
  { immediate: true }
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

function getStackPromptId(asset: AssetItem): string | null {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  return metadata?.promptId ?? null
}

function getStackCount(asset: AssetItem): number | undefined {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (typeof metadata?.outputCount === 'number') {
    return metadata.outputCount
  }

  if (Array.isArray(metadata?.allOutputs)) {
    return metadata.allOutputs.length
  }

  return undefined
}

function isStackExpanded(asset: AssetItem): boolean {
  const promptId = getStackPromptId(asset)
  if (!promptId) return false
  return expandedStackPromptIds.value.has(promptId)
}

async function toggleStack(asset: AssetItem) {
  const promptId = getStackPromptId(asset)
  if (!promptId) return

  if (expandedStackPromptIds.value.has(promptId)) {
    const next = new Set(expandedStackPromptIds.value)
    next.delete(promptId)
    expandedStackPromptIds.value = next
    return
  }

  if (!stackChildrenByPromptId.value[promptId]?.length) {
    if (loadingStackPromptIds.value.has(promptId)) {
      return
    }
    const nextLoading = new Set(loadingStackPromptIds.value)
    nextLoading.add(promptId)
    loadingStackPromptIds.value = nextLoading

    const children = await resolveStackChildren(asset)

    const afterLoading = new Set(loadingStackPromptIds.value)
    afterLoading.delete(promptId)
    loadingStackPromptIds.value = afterLoading

    if (!children.length) {
      return
    }

    stackChildrenByPromptId.value = {
      ...stackChildrenByPromptId.value,
      [promptId]: children
    }
  }

  const nextExpanded = new Set(expandedStackPromptIds.value)
  nextExpanded.add(promptId)
  expandedStackPromptIds.value = nextExpanded
}

async function resolveStackOutputs(metadata: OutputAssetMetadata) {
  const outputsToDisplay = metadata.allOutputs ?? []
  if (!shouldLoadFullOutputs(metadata.outputCount, outputsToDisplay.length)) {
    return outputsToDisplay
  }

  try {
    const jobDetail = await getJobDetail(metadata.promptId)
    const previewableOutputs = getPreviewableOutputsFromJobDetail(jobDetail)
    return previewableOutputs.length ? previewableOutputs : outputsToDisplay
  } catch (error) {
    console.error('Failed to fetch job detail for stack children:', error)
    return outputsToDisplay
  }
}

async function resolveStackChildren(asset: AssetItem): Promise<AssetItem[]> {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  if (!metadata) {
    return []
  }

  const outputsToDisplay = await resolveStackOutputs(metadata)
  if (!outputsToDisplay.length) {
    return []
  }

  return mapOutputsToAssetItems({
    promptId: metadata.promptId,
    outputs: outputsToDisplay,
    createdAt: asset.created_at,
    executionTimeInSeconds: metadata.executionTimeInSeconds,
    workflow: metadata.workflow,
    excludeFilename: asset.name
  })
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
