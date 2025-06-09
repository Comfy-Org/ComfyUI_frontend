<template>
  <div class="px-2">
    <Select
      v-model="selectedValue"
      :options="computedOptions"
      :placeholder="placeholder"
      class="w-full rounded-lg bg-[#222222] text-xs border-[#222222] shadow-none"
      :disabled="isLoading"
    />
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import { computed } from 'vue'

import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComponentWidget } from '@/scripts/domWidget'

const selectedValue = defineModel<string>()
const { widget } = defineProps<{
  widget?: ComponentWidget<string>
}>()

const inputSpec = (widget?.inputSpec ?? {}) as ComboInputSpec
const placeholder = 'Select option'
const isLoading = computed(() => selectedValue.value === 'Loading...')

// For remote widgets, we need to dynamically get options
const computedOptions = computed(() => {
  if (inputSpec.remote) {
    // For remote widgets, the options may be dynamically updated
    // The useRemoteWidget will update the inputSpec.options
    return inputSpec.options ?? []
  }
  return inputSpec.options ?? []
})

// Tooltip support is available via inputSpec.tooltip if needed in the future
</script>
