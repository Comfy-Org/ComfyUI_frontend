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
      <ModelInfoField
        v-if="modelType"
        :label="$t('assetBrowser.modelInfo.modelType')"
      >
        <span class="text-sm">{{ modelType }}</span>
      </ModelInfoField>
      <ModelInfoField
        v-if="baseModel"
        :label="$t('assetBrowser.modelInfo.compatibleBaseModels')"
      >
        <span class="text-sm">{{ baseModel }}</span>
      </ModelInfoField>
      <ModelInfoField
        v-if="additionalTags.length > 0"
        :label="$t('assetBrowser.modelInfo.additionalTags')"
      >
        <div class="flex flex-wrap gap-1">
          <span
            v-for="tag in additionalTags"
            :key="tag"
            class="rounded px-2 py-0.5 text-xs"
          >
            {{ tag }}
          </span>
        </div>
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
import { computed } from 'vue'

import PropertiesAccordionItem from '@/components/rightSidePanel/layout/PropertiesAccordionItem.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import {
  getAssetBaseModel,
  getAssetDescription,
  getAssetDisplayName,
  getAssetSourceUrl,
  getAssetTags,
  getAssetTriggerPhrases,
  getSourceName
} from '@/platform/assets/utils/assetMetadataUtils'

import ModelInfoField from './ModelInfoField.vue'

const accordionClass = 'bg-transparent border-t border-border-default'

const { asset } = defineProps<{
  asset: AssetDisplayItem
}>()

const displayName = computed(() => getAssetDisplayName(asset))
const sourceUrl = computed(() => getAssetSourceUrl(asset))
const sourceName = computed(() =>
  sourceUrl.value ? getSourceName(sourceUrl.value) : ''
)
const baseModel = computed(() => getAssetBaseModel(asset))
const description = computed(() => getAssetDescription(asset))
const triggerPhrases = computed(() => getAssetTriggerPhrases(asset))
const additionalTags = computed(() => getAssetTags(asset))

const modelType = computed(() => {
  const typeTag = asset.tags.find((tag) => tag !== 'models')
  if (!typeTag) return null
  return typeTag.includes('/') ? typeTag.split('/').pop() : typeTag
})
</script>
