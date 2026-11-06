<template>
  <div
    data-component-id="ModelInfoPanel"
    class="flex scrollbar-custom h-full flex-col"
  >
    <PropertiesAccordionItem variant="card">
      <template #label>
        {{ t('assetBrowser.modelInfo.basicInfo') }}
      </template>
      <ModelInfoField :label="t('assetBrowser.modelInfo.displayName')">
        <div class="group flex justify-between">
          <EditableText
            :model-value="displayName"
            :is-editing="isEditingDisplayName"
            :class="cn('flex-auto break-all text-muted-foreground')"
            @dblclick="isEditingDisplayName = !isImmutable"
            @edit="handleDisplayNameEdit"
            @cancel="isEditingDisplayName = false"
          />
          <Button
            v-if="!isImmutable && !isEditingDisplayName"
            size="icon-sm"
            variant="muted-textonly"
            class="opacity-0 transition-opacity group-hover:opacity-100"
            :aria-label="t('assetBrowser.modelInfo.editDisplayName')"
            @click="isEditingDisplayName = !isImmutable"
          >
            <i class="icon-[lucide--square-pen] self-center" />
          </Button>
        </div>
      </ModelInfoField>
      <ModelInfoField :label="t('assetBrowser.modelInfo.fileName')">
        <span class="break-all text-muted-foreground">{{
          getAssetFilename(asset)
        }}</span>
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
          <img
            v-else-if="sourceName === 'Hugging Face'"
            src="/assets/images/hf-logo.svg"
            alt=""
            class="size-4 shrink-0"
          />
          {{ t('assetBrowser.modelInfo.viewOnSource', { source: sourceName }) }}
          <i class="icon-[lucide--external-link]" />
        </a>
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem variant="card">
      <template #label>
        {{ t('assetBrowser.modelInfo.modelTagging') }}
      </template>
      <ModelInfoField :label="t('assetBrowser.modelInfo.modelType')">
        <Select v-if="isModelTypeEditable" v-model="selectedModelType">
          <SelectTrigger>
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
        <template v-else>
          <div
            aria-disabled="true"
            :aria-describedby="modelTypeReadonlyReasonId"
            class="cursor-not-allowed p-2 text-muted-foreground"
          >
            {{
              modelTypes.find((o) => o.value === selectedModelType)?.name ??
              t('assetBrowser.unknown')
            }}
          </div>
          <span :id="modelTypeReadonlyReasonId" class="sr-only">
            {{ modelTypeReadonlyReason }}
          </span>
        </template>
      </ModelInfoField>
      <ModelInfoField :label="t('assetBrowser.modelInfo.compatibleBaseModels')">
        <TagEditor
          v-model="baseModels"
          :disabled="isImmutable"
          :placeholder="
            isImmutable
              ? t('assetBrowser.modelInfo.baseModelUnknown')
              : t('assetBrowser.modelInfo.addBaseModel')
          "
        />
      </ModelInfoField>
      <ModelInfoField :label="t('assetBrowser.modelInfo.additionalTags')">
        <TagEditor
          v-model="additionalTags"
          :disabled="isImmutable"
          :placeholder="
            isImmutable
              ? t('assetBrowser.modelInfo.noAdditionalTags')
              : t('assetBrowser.modelInfo.addTag')
          "
        />
      </ModelInfoField>
    </PropertiesAccordionItem>

    <PropertiesAccordionItem variant="card">
      <template #label>
        {{ t('assetBrowser.modelInfo.modelDescription') }}
      </template>
      <ModelInfoField
        v-if="triggerPhrases.length > 0"
        :label="t('assetBrowser.modelInfo.triggerPhrases')"
      >
        <template #label-action>
          <Button
            variant="muted-textonly"
            size="icon-sm"
            :title="t('g.copyAll')"
            :aria-label="t('g.copyAll')"
            @click="copyToClipboard(triggerPhrases.join(', '))"
          >
            <i class="icon-[lucide--copy] min-h-4 min-w-4 opacity-60" />
          </Button>
        </template>
        <div class="flex flex-wrap gap-1 pt-1">
          <Button
            v-for="phrase in triggerPhrases"
            :key="phrase"
            variant="muted-textonly"
            size="unset"
            :title="t('g.copyToClipboard')"
            class="text-left text-xs text-pretty whitespace-normal"
            @click="copyToClipboard(phrase)"
          >
            {{ phrase }}
            <i class="icon-[lucide--copy] min-h-4 min-w-4 opacity-60" />
          </Button>
        </div>
      </ModelInfoField>
      <ModelInfoField
        v-if="description"
        :label="t('assetBrowser.modelInfo.description')"
      >
        <p class="whitespace-pre-wrap">{{ description }}</p>
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
              'w-full resize-y scrollbar-gutter-stable rounded-lg border border-transparent bg-transparent px-3 py-2 transition-colors outline-none focus:bg-input',
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
import {
  computed,
  ref,
  shallowReactive,
  useId,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import EditableText from '@comfyorg/design-system/common/EditableText'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import PropertiesAccordionItem from '@comfyorg/design-system/accordion/PropertiesAccordionItem'
import Button from '@comfyorg/design-system/button/Button'
import Select from '@comfyorg/design-system/select/Select'
import SelectContent from '@comfyorg/design-system/select/SelectContent'
import SelectItem from '@comfyorg/design-system/select/SelectItem'
import SelectTrigger from '@comfyorg/design-system/select/SelectTrigger'
import SelectValue from '@comfyorg/design-system/select/SelectValue'
import TagEditor from '@/components/common/TagEditor.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import { isCloud } from '@/platform/distribution/types'
import type { AssetUserMetadata } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetAdditionalTags,
  getAssetBaseModels,
  getAssetDescription,
  getAssetDisplayName,
  getAssetFilename,
  getAssetSourceUrl,
  getAssetTriggerPhrases,
  getAssetUserDescription,
  getEditableModelType,
  getSourceName,
  resolveModelTypeTagUpdate
} from '@/platform/assets/utils/assetMetadataUtils'
import { useAssetsStore } from '@/stores/assetsStore'
import { cn } from '@comfyorg/tailwind-utils'

import ModelInfoField from '@comfyorg/design-system/field/ModelInfoField'

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()

const descriptionTextarea = useTemplateRef<HTMLTextAreaElement>(
  'descriptionTextarea'
)

const { asset, cacheKey } = defineProps<{
  asset: AssetDisplayItem
  cacheKey?: string
}>()

const assetsStore = useAssetsStore()
const { flags } = useFeatureFlags()
const { modelTypes } = useModelTypes()

const metadataDrafts = shallowReactive(
  new Map<string, ReturnType<typeof createMetadataDraft>>()
)
const pendingUpdates = computed(
  () => metadataDrafts.get(asset.id)?.updates.value ?? {}
)
const pendingModelType = ref<string | undefined>(undefined)
const isEditingDisplayName = ref(false)

const isImmutable = computed(() => asset.is_immutable ?? true)
// Retagging a model rewrites its asset tags; core is filesystem-backed and does
// not yet move the file to match, so the model type is read-only off-cloud.
const isModelTypeEditable = computed(() => !isImmutable.value && isCloud)
// The read-only field is reached for an immutable asset (even on cloud) or on
// core. Immutability is the more specific, actionable reason, so it wins when
// both hold rather than blaming "core" on a cloud deployment.
const modelTypeReadonlyReason = computed(() =>
  isImmutable.value
    ? t('assetBrowser.modelInfo.modelTypeImmutableReadonly')
    : t('assetBrowser.modelInfo.modelTypeCoreReadonly')
)
const modelTypeReadonlyReasonId = useId()
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
  () => asset.tags,
  () => {
    pendingModelType.value = undefined
  }
)

function createMetadataDraft(initialAsset: AssetDisplayItem) {
  const updates = ref<AssetUserMetadata>({})
  let targetAsset = initialAsset
  let targetCacheKey = cacheKey
  let saving = false

  const flush = useDebounceFn(async () => {
    if (saving || targetAsset.is_immutable !== false) return
    const submitted = updates.value
    if (Object.keys(submitted).length === 0) return
    const metadata = { ...targetAsset.user_metadata, ...submitted }
    saving = true
    const saved = await assetsStore.updateAssetMetadata(
      targetAsset,
      metadata,
      targetCacheKey
    )
    saving = false
    const hasNewerEdits = updates.value !== submitted
    if (saved) {
      targetAsset = { ...targetAsset, user_metadata: metadata }
      const confirmed = new Map(Object.entries(submitted))
      updates.value = Object.fromEntries(
        Object.entries(updates.value).filter(
          ([key, value]) => !confirmed.has(key) || value !== confirmed.get(key)
        )
      )
    }
    if ((saved || hasNewerEdits) && Object.keys(updates.value).length > 0)
      flush()
  }, 500)

  function queue(
    newUpdates: AssetUserMetadata,
    currentAsset: AssetDisplayItem,
    currentCacheKey?: string
  ) {
    targetAsset = currentAsset
    targetCacheKey = currentCacheKey
    updates.value = { ...updates.value, ...newUpdates }
    flush()
  }

  return { updates, queue }
}

function queueMetadataUpdate(updates: AssetUserMetadata) {
  let draft = metadataDrafts.get(asset.id)
  if (!draft) {
    draft = createMetadataDraft(asset)
    metadataDrafts.set(asset.id, draft)
  }
  draft.queue(updates, asset, cacheKey)
}

function handleDisplayNameEdit(newName: string) {
  isEditingDisplayName.value = false
  if (newName && newName !== displayName.value) {
    queueMetadataUpdate({ name: newName })
  }
}

const debouncedSaveModelType = useDebounceFn((newModelType: string) => {
  const newTags = resolveModelTypeTagUpdate(
    asset,
    newModelType,
    isModelTypeEditable.value,
    flags.supportsModelTypeTags
  )
  if (newTags) assetsStore.updateAssetTags(asset, newTags, cacheKey)
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
  get: () =>
    pendingModelType.value ??
    getEditableModelType(asset, flags.supportsModelTypeTags) ??
    undefined,
  set: (value: string | undefined) => {
    if (!value) return
    pendingModelType.value = value
    debouncedSaveModelType(value)
  }
})
</script>
