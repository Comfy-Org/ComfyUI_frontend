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
        {{ $t('assetBrowser.whatTypeOfModel') }}
      </label>
      <SingleSelect
        v-model="selectedModelType"
        :label="$t('assetBrowser.whatTypeOfModel')"
        :options="modelTypes"
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

interface ModelMetadata {
  content_length: number
  final_url: string
  content_type?: string
  filename?: string
  name?: string
  tags?: string[]
  preview_url?: string
}

const props = defineProps<{
  modelValue: string
  metadata: ModelMetadata | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { modelTypes } = useModelTypes()

const selectedModelType = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})
</script>
