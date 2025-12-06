<template>
  <div class="flex flex-col gap-4 text-sm text-muted-foreground">
    <!-- Model Info Section -->
    <div class="flex flex-col gap-2">
      <p class="m-0">
        {{ $t('assetBrowser.modelAssociatedWithLink') }}
      </p>
      <p
        class="mt-0 bg-modal-card-background text-base-foreground p-3 rounded-lg"
      >
        {{ metadata?.name || metadata?.filename }}
      </p>
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
  metadata: AssetMetadata | null
}>()

const modelValue = defineModel<string | undefined>()

const { modelTypes, isLoading } = useModelTypes()
</script>
