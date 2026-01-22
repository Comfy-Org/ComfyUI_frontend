<template>
  <div
    data-component-id="ModelInfoPanel"
    class="flex h-full flex-col scrollbar-custom"
  >
    <PropertiesAccordionItem :class="accordionClass">
      <template #label>
        <span class="text-xs uppercase font-inter">
          {{ t('assetBrowser.modelInfo.basicInfo') }}
        </span>
      </template>
      <ModelInfoField :label="t('assetBrowser.modelInfo.displayName')">
        <EditableText
          :model-value="displayName"
          :is-editing="isEditingDisplayName"
          :class="cn('break-all', !isImmutable && 'text-base-foreground')"
          @dblclick="isEditingDisplayName = !isImmutable"
          @edit="handleDisplayNameEdit"
          @cancel="isEditingDisplayName = false"
        />
      </ModelInfoField>
      <ModelInfoField :label="t('assetBrowser.modelInfo.fileName')">
        <span class="break-all">{{ asset.name }}</span>
      </ModelInfoField>
      <ModelInfoField
        v-if="sourceUrl"
        :label="t('assetBrowser.modelInfo.source')"
      >
        <a
          :href="sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          <img
            v-if="sourceName === 'Civitai'"
            src="/assets/images/civitai.svg"
            alt=""
            class="size-4 shrink-0"
          />
          {{ t('assetBrowser.modelInfo.viewOnSource', { source: sourceName }) }}
          <i class="icon-[lucide--external-link] size-4 shrink-0" />
        </a>
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem :class="accordionClass">
      <template #label>
        <span class="text-xs uppercase font-inter">
          {{ t('assetBrowser.modelInfo.modelTagging') }}
        </span>
      </template>
      <ModelInfoField :label="t('assetBrowser.modelInfo.modelType')">
        <Select v-model="selectedModelType" :disabled="isImmutable">
          <SelectTrigger class="w-full">
            <SelectValue
              :placeholder="t('assetBrowser.modelInfo.selectModelType')"
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in modelTypes"
              :key="option.value"
              :value="option.value"
            >
              {{ option.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </ModelInfoField>
      <ModelInfoField :label="t('assetBrowser.modelInfo.compatibleBaseModels')">
        <TagsInput
          v-slot="{ isEmpty }"
          v-model="baseModels"
          :disabled="isImmutable"
        >
          <TagsInputItem
            v-for="model in baseModels"
            :key="model"
            :value="model"
          >
            <TagsInputItemText />
            <TagsInputItemDelete />
          </TagsInputItem>
          <TagsInputInput
            :is-empty="isEmpty"
            :placeholder="
              isImmutable
                ? t('assetBrowser.modelInfo.baseModelUnknown')
                : t('assetBrowser.modelInfo.addBaseModel')
            "
          />
        </TagsInput>
      </ModelInfoField>
      <ModelInfoField :label="t('assetBrowser.modelInfo.additionalTags')">
        <TagsInput
          v-slot="{ isEmpty }"
          v-model="additionalTags"
          :disabled="isImmutable"
        >
          <TagsInputItem v-for="tag in additionalTags" :key="tag" :value="tag">
            <TagsInputItemText />
            <TagsInputItemDelete />
          </TagsInputItem>
          <TagsInputInput
            :is-empty="isEmpty"
            :placeholder="
              isImmutable
                ? t('assetBrowser.modelInfo.noAdditionalTags')
                : t('assetBrowser.modelInfo.addTag')
            "
          />
        </TagsInput>
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem :class="accordionClass">
      <template #label>
        <span class="text-xs uppercase font-inter">
          {{ t('assetBrowser.modelInfo.modelDescription') }}
        </span>
      </template>
      <ModelInfoField
        v-if="triggerPhrases.length > 0"
        :label="t('assetBrowser.modelInfo.triggerPhrases')"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-for="phrase in triggerPhrases"
            :key="phrase"
            class="rounded px-2 py-0.5 text-xs"
          >
            {{ phrase }}
          </span>
        </div>
      </ModelInfoField>
      <ModelInfoField
        v-if="description"
        :label="t('assetBrowser.modelInfo.description')"
      >
        <p class="text-sm whitespace-pre-wrap">{{ description }}</p>
      </ModelInfoField>
      <ModelInfoField :label="t('assetBrowser.modelInfo.description')">
        <textarea
          ref="descriptionTextarea"
          v-model="userDescription"
          :disabled="isImmutable"
          :placeholder="
            isImmutable
              ? t('assetBrowser.modelInfo.descriptionNotSet')
              : t('assetBrowser.modelInfo.descriptionPlaceholder')
          "
          rows="3"
          :class="
            cn(
              'w-full resize-y rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-component-node-foreground outline-none transition-colors focus:bg-component-node-widget-background',
              isImmutable && 'cursor-not-allowed'
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
import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { AssetUserMetadata } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetAdditionalTags,
  getAssetBaseModels,
  getAssetDescription,
  getAssetDisplayName,
  getAssetModelType,
  getAssetSourceUrl,
  getAssetTriggerPhrases,
  getAssetUserDescription,
  getSourceName
} from '@/platform/assets/utils/assetMetadataUtils'
import { useAssetsStore } from '@/stores/assetsStore'
import { cn } from '@/utils/tailwindUtil'

import ModelInfoField from './ModelInfoField.vue'

const { t } = useI18n()

const descriptionTextarea = useTemplateRef<HTMLTextAreaElement>(
  'descriptionTextarea'
)

const accordionClass = cn(
  'bg-modal-panel-background border-t border-border-default'
)

const { asset, cacheKey } = defineProps<{
  asset: AssetDisplayItem
  cacheKey?: string
}>()

const assetsStore = useAssetsStore()
const { modelTypes } = useModelTypes()

const pendingUpdates = ref<AssetUserMetadata>({})
const isEditingDisplayName = ref(false)

const isImmutable = computed(() => asset.is_immutable ?? true)
const displayName = computed(
  () => pendingUpdates.value.name ?? getAssetDisplayName(asset)
)
const sourceUrl = computed(() => getAssetSourceUrl(asset))
const sourceName = computed(() =>
  sourceUrl.value ? getSourceName(sourceUrl.value) : ''
)
const description = computed(() => getAssetDescription(asset))
const triggerPhrases = computed(() => getAssetTriggerPhrases(asset))

watch(
  () => asset.user_metadata,
  () => {
    pendingUpdates.value = {}
  }
)

const debouncedFlushMetadata = useDebounceFn(() => {
  if (isImmutable.value) return
  assetsStore.updateAssetMetadata(
    asset.id,
    { ...(asset.user_metadata ?? {}), ...pendingUpdates.value },
    cacheKey
  )
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

const debouncedSaveModelType = useDebounceFn((newModelType: string) => {
  if (isImmutable.value) return
  const currentModelType = getAssetModelType(asset)
  if (currentModelType === newModelType) return
  const newTags = asset.tags
    .filter((tag) => tag !== currentModelType)
    .concat(newModelType)
  assetsStore.updateAssetTags(asset.id, newTags, cacheKey)
}, 500)

const baseModels = computed({
  get: () => pendingUpdates.value.base_model ?? getAssetBaseModels(asset),
  set: (value: string[]) => queueMetadataUpdate({ base_model: value })
})

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

const selectedModelType = computed({
  get: () => getAssetModelType(asset) ?? undefined,
  set: (value: string | undefined) => {
    if (value) debouncedSaveModelType(value)
  }
})
</script>
