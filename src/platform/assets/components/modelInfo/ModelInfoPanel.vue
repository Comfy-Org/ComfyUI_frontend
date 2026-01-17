<template>
  <div
    data-component-id="ModelInfoPanel"
    class="flex h-full flex-col scrollbar-custom"
  >
    <PropertiesAccordionItem :class="accordionClass">
      <template #label>
        <span class="text-xs uppercase font-inter">
          {{ $t('assetBrowser.modelInfo.basicInfo') }}
        </span>
      </template>
      <ModelInfoField :label="$t('assetBrowser.modelInfo.displayName')">
        <span class="break-all">{{ displayName }}</span>
      </ModelInfoField>
      <ModelInfoField :label="$t('assetBrowser.modelInfo.fileName')">
        <span class="break-all">{{ asset.name }}</span>
      </ModelInfoField>
      <ModelInfoField
        v-if="sourceUrl"
        :label="$t('assetBrowser.modelInfo.source')"
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
          {{
            $t('assetBrowser.modelInfo.viewOnSource', { source: sourceName })
          }}
          <i class="icon-[lucide--external-link] size-4 shrink-0" />
        </a>
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem :class="accordionClass">
      <template #label>
        <span class="text-xs uppercase font-inter">
          {{ $t('assetBrowser.modelInfo.modelTagging') }}
        </span>
      </template>
      <ModelInfoField :label="$t('assetBrowser.modelInfo.modelType')">
        <select
          v-model="selectedModelType"
          :disabled="isImmutable"
          class="w-full rounded-lg border-2 border-transparent bg-secondary-background px-3 py-2 text-sm text-base-foreground outline-none focus:border-node-component-border"
        >
          <option
            v-for="option in modelTypes"
            :key="option.value"
            :value="option.value"
          >
            {{ option.name }}
          </option>
        </select>
      </ModelInfoField>
      <ModelInfoField
        :label="$t('assetBrowser.modelInfo.compatibleBaseModels')"
      >
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
                ? $t('assetBrowser.modelInfo.baseModelUnknown')
                : $t('assetBrowser.modelInfo.addBaseModel')
            "
          />
        </TagsInput>
      </ModelInfoField>
      <ModelInfoField :label="$t('assetBrowser.modelInfo.additionalTags')">
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
                ? $t('assetBrowser.modelInfo.noAdditionalTags')
                : $t('assetBrowser.modelInfo.addTag')
            "
          />
        </TagsInput>
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem :class="accordionClass">
      <template #label>
        <span class="text-xs uppercase font-inter">
          {{ $t('assetBrowser.modelInfo.modelDescription') }}
        </span>
      </template>
      <ModelInfoField
        v-if="triggerPhrases.length > 0"
        :label="$t('assetBrowser.modelInfo.triggerPhrases')"
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
        :label="$t('assetBrowser.modelInfo.description')"
      >
        <p class="text-sm whitespace-pre-wrap">{{ description }}</p>
      </ModelInfoField>
    </PropertiesAccordionItem>
  </div>
</template>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import {
  getAssetAdditionalTags,
  getAssetBaseModels,
  getAssetDescription,
  getAssetDisplayName,
  getAssetModelType,
  getAssetSourceUrl,
  getAssetTriggerPhrases,
  getSourceName
} from '@/platform/assets/utils/assetMetadataUtils'
import { useAssetsStore } from '@/stores/assetsStore'

import ModelInfoField from './ModelInfoField.vue'

const accordionClass = 'bg-transparent border-t border-border-default'

const { asset, cacheKey } = defineProps<{
  asset: AssetDisplayItem
  cacheKey?: string
}>()

const displayName = computed(() => getAssetDisplayName(asset))
const sourceUrl = computed(() => getAssetSourceUrl(asset))
const sourceName = computed(() =>
  sourceUrl.value ? getSourceName(sourceUrl.value) : ''
)
const baseModels = ref<string[]>(getAssetBaseModels(asset))
const additionalTags = ref<string[]>(getAssetAdditionalTags(asset))
const selectedModelType = ref<string | undefined>(
  getAssetModelType(asset) ?? undefined
)
watch(
  () => asset,
  () => {
    baseModels.value = getAssetBaseModels(asset)
    additionalTags.value = getAssetAdditionalTags(asset)
    selectedModelType.value = getAssetModelType(asset) ?? undefined
  }
)
const description = computed(() => getAssetDescription(asset))
const triggerPhrases = computed(() => getAssetTriggerPhrases(asset))
const isImmutable = computed(() => asset.is_immutable ?? true)

const { modelTypes } = useModelTypes()

const assetsStore = useAssetsStore()

async function saveMetadata() {
  if (isImmutable.value) return

  await assetsStore.updateAssetMetadata(
    asset.id,
    {
      ...asset.user_metadata,
      base_model: baseModels.value,
      additional_tags: additionalTags.value
    },
    cacheKey
  )
}

async function saveModelType(newModelType: string | undefined) {
  if (isImmutable.value || !newModelType) return

  const currentModelType = getAssetModelType(asset)
  if (currentModelType === newModelType) return

  const newTags = asset.tags
    .filter((tag) => tag !== currentModelType)
    .concat(newModelType)
  await assetsStore.updateAssetTags(asset.id, newTags, cacheKey)
}

watchDebounced(baseModels, saveMetadata, { debounce: 500 })
watchDebounced(additionalTags, saveMetadata, { debounce: 500 })
watchDebounced(selectedModelType, saveModelType, { debounce: 500 })
</script>
