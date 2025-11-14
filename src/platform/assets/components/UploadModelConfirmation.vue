<template>
  <div class="flex flex-col gap-4">
    <!-- Model Info Section -->
    <div class="flex flex-col gap-2">
      <p class="text-sm text-muted m-0">
        {{ $t('assetBrowser.modelAssociatedWithLink') }}
      </p>
      <p class="text-sm mt-0">
        {{ metadata?.name || metadata?.filename }}
      </p>
    </div>

    <!-- Model Type Selection -->
    <div class="flex flex-col gap-2">
      <label class="text-sm text-muted">
        {{ $t('assetBrowser.modelTypeSelectorLabel') }}
      </label>
      <SingleSelect
        v-model="selectedModelType"
        :label="
          isLoading
            ? $t('g.loading')
            : $t('assetBrowser.modelTypeSelectorPlaceholder')
        "
        :options="modelTypes"
        :disabled="isLoading"
      />
      <div class="flex items-center gap-2 text-sm text-muted">
        <i class="icon-[lucide--info]" />
        <span>{{ $t('assetBrowser.notSureLeaveAsIs') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import SingleSelect from '@/components/input/SingleSelect.vue'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { AssetMetadata } from '@/platform/assets/schemas/assetSchema'

const props = defineProps<{
  modelValue: string | undefined
  metadata: AssetMetadata | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const { modelTypes, isLoading } = useModelTypes()

const selectedModelType = computed({
  get: () => props.modelValue ?? null,
  set: (value: string | null) => emit('update:modelValue', value ?? undefined)
})
</script>
