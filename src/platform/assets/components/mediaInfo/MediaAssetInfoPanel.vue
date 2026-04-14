<template>
  <div
    data-component-id="MediaAssetInfoPanel"
    class="flex scrollbar-custom h-full flex-col"
  >
    <PropertiesAccordionItem :class="accordionClass">
      <template #label>
        <span class="font-inter text-xs uppercase select-none">
          {{ t('sideToolbar.mediaAssets.infoPanel.preview') }}
        </span>
      </template>
      <div class="px-4">
        <div class="overflow-hidden rounded-lg">
          <MediaAssetCard :asset @zoom="emit('zoom', asset)" />
        </div>
      </div>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem :collapse="true" :class="accordionClass">
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
          {{ getAssetFilename(asset) }}
        </span>
      </ModelInfoField>
      <ModelInfoField
        v-if="mediaType"
        :label="t('sideToolbar.mediaAssets.infoPanel.mediaType')"
      >
        <span class="text-muted-foreground capitalize">{{ mediaType }}</span>
      </ModelInfoField>
      <ModelInfoField
        v-if="asset.size"
        :label="t('sideToolbar.mediaAssets.infoPanel.fileSize')"
      >
        <span class="text-muted-foreground">
          {{ formatFileSize(asset.size) }}
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
        <TagsInput v-slot="{ isEmpty }" v-model="additionalTags">
          <TagsInputItem v-for="tag in additionalTags" :key="tag" :value="tag">
            <TagsInputItemText />
            <TagsInputItemDelete />
          </TagsInputItem>
          <TagsInputInput
            :is-empty="isEmpty"
            :placeholder="t('assetBrowser.modelInfo.addTag')"
          />
        </TagsInput>
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem :class="accordionClass">
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
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
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

const accordionClass = cn(
  'border-t border-border-default bg-modal-panel-background'
)

const { asset } = defineProps<{
  asset: AssetItem
}>()

const emit = defineEmits<{
  zoom: [asset: AssetItem]
}>()

const assetsStore = useAssetsStore()

const pendingUpdates = ref<AssetUserMetadata>({})
const isEditingDisplayName = ref(false)

const displayName = computed(
  () => pendingUpdates.value.name ?? getAssetDisplayName(asset)
)

const mediaType = computed(() => getMediaTypeFromFilename(asset.name))

const outputMetadata = computed(() =>
  getOutputAssetMetadata(asset.user_metadata)
)

const executionTime = computed(
  () => outputMetadata.value?.executionTimeInSeconds
)

const jobId = computed(() => outputMetadata.value?.jobId)

watch(
  () => asset.user_metadata,
  () => {
    pendingUpdates.value = {}
  }
)

const debouncedFlushMetadata = useDebounceFn(() => {
  assetsStore.updateAssetMetadata(asset, {
    ...(asset.user_metadata ?? {}),
    ...pendingUpdates.value
  })
}, 500)

function queueMetadataUpdate(updates: AssetUserMetadata) {
  pendingUpdates.value = { ...pendingUpdates.value, ...updates }
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
    pendingUpdates.value.additional_tags ?? getAssetAdditionalTags(asset),
  set: (value: string[]) => queueMetadataUpdate({ additional_tags: value })
})

const userDescription = computed({
  get: () =>
    pendingUpdates.value.user_description ?? getAssetUserDescription(asset),
  set: (value: string) => queueMetadataUpdate({ user_description: value })
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
