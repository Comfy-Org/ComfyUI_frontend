<template>
  <div class="flex h-full flex-col bg-comfy-menu-bg">
    <div class="flex h-18 items-center border-b border-divider px-4">
      <h2 class="text-lg font-semibold">
        {{ $t('assetBrowser.modelInfo.title') }}
      </h2>
    </div>

    <div class="flex-1 overflow-y-auto scrollbar-custom">
      <PropertiesAccordionItem>
        <template #label>
          <span class="text-xs uppercase">
            {{ $t('assetBrowser.modelInfo.basicInfo') }}
          </span>
        </template>
        <ModelInfoField :label="$t('assetBrowser.modelInfo.displayName')">
          <span class="text-sm">{{ displayName }}</span>
        </ModelInfoField>
        <ModelInfoField :label="$t('assetBrowser.modelInfo.fileName')">
          <span class="text-sm">{{ asset.name }}</span>
        </ModelInfoField>
        <ModelInfoField
          v-if="sourceUrl"
          :label="$t('assetBrowser.modelInfo.source')"
        >
          <a
            :href="sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-link hover:underline"
          >
            {{
              $t('assetBrowser.modelInfo.viewOnSource', { source: sourceName })
            }}
          </a>
        </ModelInfoField>
      </PropertiesAccordionItem>

      <PropertiesAccordionItem>
        <template #label>
          <span class="text-xs uppercase">
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
              class="rounded bg-surface-container px-2 py-0.5 text-xs"
            >
              {{ tag }}
            </span>
          </div>
        </ModelInfoField>
      </PropertiesAccordionItem>

      <PropertiesAccordionItem>
        <template #label>
          <span class="text-xs uppercase">
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
              class="rounded bg-surface-container px-2 py-0.5 text-xs"
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
