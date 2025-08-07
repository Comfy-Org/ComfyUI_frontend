<template>
  <div
    class="minimap-panel p-3 mr-2 flex flex-col gap-3 text-sm"
    :style="panelStyles"
  >
    <div
      v-for="option in optionsList"
      :key="option.key"
      class="flex items-center gap-2"
    >
      <Checkbox
        :input-id="option.key"
        :name="option.key"
        :model-value="option.value"
        binary
        @update:model-value="
          (value) => $emit('updateOption', option.key, value)
        "
      />
      <label :for="option.key">{{ $t(option.labelKey) }}</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'

import type { MinimapOptionKey } from '@/composables/useMinimap'

defineProps<{
  optionsList: any[]
  panelStyles: any
}>()

defineEmits<{
  updateOption: [key: MinimapOptionKey, value: boolean]
}>()
</script>
