<template>
  <div class="flex flex-col gap-4 text-sm text-muted-foreground">
    <div class="flex flex-col gap-2">
      <p class="m-0">
        {{ $t('assetBrowser.modelAssociatedWithLink') }}
      </p>
      <div
        class="flex items-center gap-3 bg-secondary-background p-3 rounded-lg"
      >
        <img
          v-if="previewImage"
          :src="previewImage"
          :alt="metadata?.filename || metadata?.name || 'Model preview'"
          class="w-14 h-14 rounded object-cover flex-shrink-0"
        />
        <p class="m-0 text-base-foreground">
          {{ metadata?.filename || metadata?.name }}
        </p>
      </div>
    </div>

    <!-- Model Type Selection -->
    <div class="flex flex-col gap-2">
      <label class="">
        {{ $t('assetBrowser.modelTypeSelectorLabel') }}
      </label>
      <SingleSelect
        v-model="modelValue"
        :label="
          isLoading
            ? $t('g.loading')
            : $t('assetBrowser.modelTypeSelectorPlaceholder')
        "
        :options="modelTypes"
        :disabled="isLoading"
        data-attr="upload-model-step2-type-selector"
      />
      <div class="flex items-center gap-2">
        <i class="icon-[lucide--circle-question-mark]" />
        <span>{{ $t('assetBrowser.notSureLeaveAsIs') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SingleSelect from '@/components/input/SingleSelect.vue'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'

defineProps<{
  metadata?: AssetMetadata
  previewImage?: string
}>()

const modelValue = defineModel<string | undefined>()

const { modelTypes, isLoading } = useModelTypes()
</script>
