<template>
  <div
    :ref="primeVueOverlay.overlayScopeRef"
    class="flex flex-col gap-4 text-sm text-muted-foreground"
  >
    <div class="flex flex-col gap-2">
      <p class="m-0">
        {{ $t('assetBrowser.modelAssociatedWithLink') }}
      </p>
      <div
        class="flex items-center gap-3 rounded-lg bg-secondary-background px-4 py-2"
      >
        <img
          v-if="previewImage"
          :src="previewImage"
          :alt="metadata?.filename || metadata?.name || 'Model preview'"
          class="size-14 shrink-0 rounded-sm object-cover"
        />
        <p class="m-0 min-w-0 flex-1 truncate text-base-foreground">
          {{ metadata?.filename || metadata?.name }}
        </p>
      </div>
    </div>

    <div
      v-if="isMissingModelResolution"
      class="flex flex-col gap-2 rounded-lg bg-secondary-background px-4 py-3"
    >
      <i18n-t
        keypath="assetBrowser.missingModelImportWillReplace"
        tag="p"
        class="m-0 text-base-foreground"
      >
        <template #model>
          <span>{{ missingModelName }}</span>
        </template>
      </i18n-t>
      <ul class="m-0 list-none space-y-1 p-0">
        <li
          v-for="target in replacementTargets"
          :key="`${target.nodeId}:${target.widgetName}`"
          class="flex min-w-0 items-center gap-2"
        >
          <span class="min-w-0 truncate text-muted-foreground">
            {{ target.nodeLabel }}
          </span>
          <span class="shrink-0 text-muted-foreground">
            - {{ target.widgetName }}
          </span>
        </li>
      </ul>
    </div>

    <!-- Model Type Selection -->
    <div class="flex flex-col gap-2">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <label>
            {{ $t('assetBrowser.modelTypeSelectorLabel') }}
          </label>
          <i
            aria-hidden="true"
            class="icon-[lucide--circle-question-mark] text-muted-foreground"
          />
          <span v-if="!isMissingModelResolution" class="text-muted-foreground">
            {{ $t('assetBrowser.notSureLeaveAsIs') }}
          </span>
        </div>
      </div>
      <SingleSelect
        v-model="modelValue"
        :label="
          isLoading
            ? $t('g.loading')
            : $t('assetBrowser.modelTypeSelectorPlaceholder')
        "
        :options="modelTypes"
        :disabled="isLoading || isMissingModelResolution"
        :content-style="selectContentStyle"
        data-attr="upload-model-step2-type-selector"
      />
      <i18n-t
        v-if="isMissingModelResolution"
        keypath="assetBrowser.missingModelImportTypeLocked"
        tag="span"
        class="text-muted-foreground"
      >
        <template #type>
          <span>{{ selectedModelTypeLabel }}</span>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import { usePrimeVueOverlayChildStyle } from '@/composables/usePopoverSizing'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { UploadModelDialogContext } from '@/platform/assets/composables/useUploadModelWizard'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'

const { uploadContext } = defineProps<{
  metadata?: AssetMetadata
  previewImage?: string
  uploadContext?: UploadModelDialogContext
}>()

const modelValue = defineModel<string | undefined>()

const { modelTypes, isLoading } = useModelTypes()
const primeVueOverlay = usePrimeVueOverlayChildStyle()
const selectContentStyle = primeVueOverlay.contentStyle

const isMissingModelResolution = computed(
  () => uploadContext?.kind === 'missing-model-resolution'
)
const missingModelName = computed(() =>
  uploadContext?.kind === 'missing-model-resolution'
    ? uploadContext.missingModelName
    : ''
)
const replacementTargets = computed(() =>
  uploadContext?.kind === 'missing-model-resolution'
    ? uploadContext.replacementTargets
    : []
)
const selectedModelTypeLabel = computed(() => {
  const value =
    uploadContext?.kind === 'missing-model-resolution'
      ? uploadContext.requiredModelType
      : modelValue.value
  return (
    modelTypes.value.find((option) => option.value === value)?.name ?? value
  )
})
</script>
