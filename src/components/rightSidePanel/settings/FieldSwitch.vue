<script setup lang="ts">
import Switch from '@comfyorg/design-system/switch/Switch'

import LayoutField from './LayoutField.vue'

defineProps<{
  id?: string
  label: string
  tooltip?: string
}>()

const modelValue = defineModel<boolean>({ default: false })
</script>

<template>
  <LayoutField singleline :label :tooltip>
    <Switch
      :id
      v-model="modelValue"
      :aria-label="label"
      class="transition-transform active:scale-90"
    />
  </LayoutField>
</template>
