<template>
  <div
    data-component-id="MediaAssetInfoPanel"
    class="flex scrollbar-custom h-full flex-col"
  >
    <PropertiesAccordionItem
      v-if="!compact || isMulti"
      :class="firstAccordionClass"
    >
      <template #label>
        <span class="font-inter text-xs uppercase select-none">
          {{ t('sideToolbar.mediaAssets.infoPanel.preview') }}
        </span>
      </template>
      <div :class="cn('px-4', compact && 'mx-auto max-w-[60%]')">
        <!-- Multi-select: image stack -->
        <ImageStack
          v-if="isMulti"
          :images="previewUrls"
          :count="allAssets.length"
        />
        <!-- Single: asset card -->
        <div v-else class="overflow-hidden rounded-lg">
          <MediaAssetCard
            :asset="primaryAsset"
            @zoom="emit('zoom', primaryAsset)"
          />
        </div>
        <!-- Multi-select: compact summary below preview -->
        <div v-if="isMulti" class="mt-2 text-center text-sm">
          <span class="text-muted-foreground">
            {{
              t('mediaAsset.selection.selectedCount', {
                count: allAssets.length
              })
            }}
          </span>
          <span v-if="mediaTypeSummary" class="text-muted-foreground">
            — {{ mediaTypeSummary }}
          </span>
        </div>
      </div>
    </PropertiesAccordionItem>

    <!-- Single asset: basic info -->
    <PropertiesAccordionItem
      v-if="!isMulti"
      :collapse="true"
      :class="showPreview ? accordionClass : firstAccordionClass"
    >
      <template #label>
        <span class="font-inter text-xs uppercase select-none">
          {{ t('assetBrowser.modelInfo.basicInfo') }}
        </span>
      </template>
      <ModelInfoField :label="t('assetBrowser.modelInfo.displayName')">
        <div class="group flex justify-between">
          <EditableText
            :model-value="displayName"
            :is-editing="isEditingDisplayName"
            :class="cn('flex-auto break-all text-muted-foreground')"
            @dblclick="isEditingDisplayName = true"
            @edit="handleDisplayNameEdit"
            @cancel="isEditingDisplayName = false"
          />
          <Button
            v-if="!isEditingDisplayName"
            size="icon-sm"
            variant="muted-textonly"
            class="opacity-0 transition-opacity group-hover:opacity-100"
            :aria-label="t('assetBrowser.modelInfo.editDisplayName')"
            @click="isEditingDisplayName = true"
          >
            <i class="icon-[lucide--square-pen] size-4 self-center" />
          </Button>
        </div>
      </ModelInfoField>
      <ModelInfoField :label="t('assetBrowser.modelInfo.fileName')">
        <span class="break-all text-muted-foreground">
          {{ getAssetFilename(primaryAsset) }}
        </span>
      </ModelInfoField>
      <ModelInfoField
        v-if="mediaType"
        :label="t('sideToolbar.mediaAssets.infoPanel.mediaType')"
      >
        <span class="text-muted-foreground capitalize">{{ mediaType }}</span>
      </ModelInfoField>
      <ModelInfoField
        v-if="primaryAsset.size"
        :label="t('sideToolbar.mediaAssets.infoPanel.fileSize')"
      >
        <span class="text-muted-foreground">
          {{ formatFileSize(primaryAsset.size) }}
        </span>
      </ModelInfoField>
      <ModelInfoField
        v-if="executionTime"
        :label="t('sideToolbar.mediaAssets.infoPanel.generationTime')"
      >
        <span class="text-muted-foreground">
          {{ formatDuration(executionTime * 1000) }}
        </span>
      </ModelInfoField>
      <ModelInfoField v-if="jobId" :label="t('assetBrowser.jobId')">
        <div class="group flex items-center gap-1">
          <span class="break-all text-muted-foreground">
            {{ jobId.substring(0, 8) }}
          </span>
          <Button
            size="icon-sm"
            variant="muted-textonly"
            class="opacity-0 transition-opacity group-hover:opacity-100"
            :aria-label="t('g.copyToClipboard')"
            @click="copyToClipboard(jobId!)"
          >
            <i class="icon-[lucide--copy] size-4 opacity-60" />
          </Button>
        </div>
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem :class="accordionClass">
      <template #label>
        <span class="font-inter text-xs uppercase select-none">
          {{ t('sideToolbar.mediaAssets.infoPanel.tagging') }}
        </span>
      </template>
      <ModelInfoField :label="t('assetBrowser.modelInfo.additionalTags')">
        <TagsInputAutocomplete
          v-if="isMulti"
          v-model="multiTags"
          :suggestions="tagSuggestions"
          :tag-class="multiTagClass"
          :placeholder="t('assetBrowser.modelInfo.addTag')"
        >
          <template #tag="{ tag }">
            <TagsInputItemText />
            <span class="text-2xs text-muted-foreground">
              {{ multiTagCounts.get(tag) ?? 0 }}/{{ allAssets.length }}
            </span>
          </template>
        </TagsInputAutocomplete>
        <TagsInputAutocomplete
          v-else
          v-model="additionalTags"
          :suggestions="tagSuggestions"
          :placeholder="t('assetBrowser.modelInfo.addTag')"
        />
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem v-if="!isMulti" :class="accordionClass">
      <template #label>
        <span class="font-inter text-xs uppercase select-none">
          {{ t('sideToolbar.mediaAssets.infoPanel.description') }}
        </span>
      </template>
      <ModelInfoField :label="t('assetBrowser.modelInfo.description')">
        <textarea
          ref="descriptionTextarea"
          v-model="userDescription"
          :placeholder="t('assetBrowser.modelInfo.descriptionPlaceholder')"
          rows="3"
          :class="
            cn(
              'w-full resize-y rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-component-node-foreground transition-colors outline-none focus:bg-component-node-widget-background'
            )
          "
          @keydown.escape.stop="descriptionTextarea?.blur()"
        />
      </ModelInfoField>
    </PropertiesAccordionItem>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import Button from '@/components/ui/button/Button.vue'
import TagsInputAutocomplete from '@/components/ui/tags-input/TagsInputAutocomplete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import ImageStack from '@/platform/assets/components/mediaInfo/ImageStack.vue'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type {
  AssetItem,
  AssetUserMetadata
} from '@/platform/assets/schemas/assetSchema'
import {
  getAssetAdditionalTags,
  getAssetDisplayName,
  getAssetFilename,
  getAssetUserDescription
} from '@/platform/assets/utils/assetMetadataUtils'
import { useAssetsStore } from '@/stores/assetsStore'
import { formatDuration, getMediaTypeFromFilename } from '@/utils/formatUtil'
import { cn } from '@/utils/tailwindUtil'

import ModelInfoField from '../modelInfo/ModelInfoField.vue'

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()

const descriptionTextarea = useTemplateRef<HTMLTextAreaElement>(
  'descriptionTextarea'
)

const {
  asset,
  assets,
  tagSuggestions = [],
  compact = false
} = defineProps<{
  /** Single asset (used when no multi-selection) */
  asset: AssetItem
  /** Multiple selected assets (when provided, shows multi-select UI) */
  assets?: AssetItem[]
  /** Tag suggestions for autocomplete */
  tagSuggestions?: string[]
  /** When true, uses transparent background for sidebar/popover context */
  compact?: boolean
}>()

const accordionClass = computed(() =>
  cn('border-t border-border-default', !compact && 'bg-modal-panel-background')
)

const firstAccordionClass = computed(() =>
  cn(!compact && 'bg-modal-panel-background')
)

const showPreview = computed(() => !compact || isMulti.value)

const emit = defineEmits<{
  zoom: [asset: AssetItem]
}>()

const isMulti = computed(() => (assets?.length ?? 0) > 1)
const allAssets = computed(() => (isMulti.value ? assets! : [asset]))
const primaryAsset = computed(() => asset)

// Preview URLs for ImageStack
const previewUrls = computed(() =>
  allAssets.value
    .map((a) => a.preview_url ?? '')
    .filter((url) => url.length > 0)
    .slice(0, 3)
)

// Media type summary for multi-select (e.g. "5 images, 2 videos")
const mediaTypeSummary = computed(() => {
  const counts = new Map<string, number>()
  for (const a of allAssets.value) {
    const type = getMediaTypeFromFilename(a.name)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => `${count} ${type}`)
    .join(', ')
})

const assetsStore = useAssetsStore()

// Pending updates keyed by asset ID — prevents cross-asset contamination
const pendingByAsset = ref<Record<string, AssetUserMetadata>>({})
const isEditingDisplayName = ref(false)

const pendingUpdates = computed(
  () => pendingByAsset.value[primaryAsset.value.id] ?? {}
)

const displayName = computed(
  () => pendingUpdates.value.name ?? getAssetDisplayName(primaryAsset.value)
)

const mediaType = computed(() =>
  getMediaTypeFromFilename(primaryAsset.value.name)
)

const outputMetadata = computed(() =>
  getOutputAssetMetadata(primaryAsset.value.user_metadata)
)

const executionTime = computed(
  () => outputMetadata.value?.executionTimeInSeconds
)

const jobId = computed(() => outputMetadata.value?.jobId)

// When the store confirms a write (user_metadata changes), clear pending for that asset
watch(
  () => primaryAsset.value.user_metadata,
  () => {
    delete pendingByAsset.value[primaryAsset.value.id]
  }
)

watch(
  () => primaryAsset.value.id,
  () => {
    isEditingDisplayName.value = false
  }
)

function flushMetadata(targetAsset: AssetItem) {
  const pending = pendingByAsset.value[targetAsset.id]
  if (!pending || Object.keys(pending).length === 0) return
  assetsStore.updateAssetMetadata(targetAsset, {
    ...(targetAsset.user_metadata ?? {}),
    ...pending
  })
}

const debouncedFlushMetadata = useDebounceFn(() => {
  flushMetadata(primaryAsset.value)
}, 500)

function queueMetadataUpdate(updates: AssetUserMetadata) {
  const id = primaryAsset.value.id
  pendingByAsset.value[id] = { ...(pendingByAsset.value[id] ?? {}), ...updates }
  debouncedFlushMetadata()
}

function handleDisplayNameEdit(newName: string) {
  isEditingDisplayName.value = false
  if (newName && newName !== displayName.value) {
    queueMetadataUpdate({ name: newName })
  }
}

const additionalTags = computed({
  get: () =>
    pendingUpdates.value.additional_tags ??
    getAssetAdditionalTags(primaryAsset.value),
  set: (value: string[]) => queueMetadataUpdate({ additional_tags: value })
})

// --- Multi-select tag logic ---

/** Tag counts across all selected assets */
const multiTagCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const a of allAssets.value) {
    const pending = pendingByAsset.value[a.id]
    const tags = pending?.additional_tags ?? getAssetAdditionalTags(a)
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return counts
})

/** Union of all tags across selected assets */
const multiTags = computed({
  get: () =>
    [...multiTagCounts.value.entries()]
      .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
      .map(([tag]) => tag),
  set: (newTags: string[]) => {
    const oldTags = [...multiTagCounts.value.keys()]
    const added = newTags.filter((t) => !oldTags.includes(t))
    const removed = oldTags.filter((t) => !newTags.includes(t))

    for (const a of allAssets.value) {
      const pending = pendingByAsset.value[a.id]
      const current = pending?.additional_tags ?? getAssetAdditionalTags(a)
      let updated = [...current]
      let changed = false

      // Add new tags to all assets
      for (const tag of added) {
        if (!updated.includes(tag)) {
          updated.push(tag)
          changed = true
        }
      }

      // Remove tags from assets that have them
      for (const tag of removed) {
        const idx = updated.indexOf(tag)
        if (idx !== -1) {
          updated.splice(idx, 1)
          changed = true
        }
      }

      if (changed) {
        pendingByAsset.value[a.id] = {
          ...(pendingByAsset.value[a.id] ?? {}),
          additional_tags: updated
        }
      }
    }

    debouncedFlushAllSelected()
  }
})

function multiTagClass(tag: string): string | undefined {
  const count = multiTagCounts.value.get(tag) ?? 0
  const total = allAssets.value.length
  if (count >= total) return 'font-semibold'
  const ratio = count / total
  if (ratio > 0.66) return 'opacity-75'
  if (ratio > 0.33) return 'opacity-55'
  return 'opacity-40'
}

const debouncedFlushAllSelected = useDebounceFn(() => {
  for (const a of allAssets.value) {
    flushMetadata(a)
  }
}, 500)

const userDescription = computed({
  get: () =>
    pendingUpdates.value.user_description ??
    getAssetUserDescription(primaryAsset.value),
  set: (value: string) => queueMetadataUpdate({ user_description: value })
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
