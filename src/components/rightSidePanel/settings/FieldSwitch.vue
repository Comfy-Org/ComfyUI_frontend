<script setup lang="ts">
import Switch from '@/components/ui/switch/Switch.vue'

import LayoutField from './LayoutField.vue'

defineProps<{
  label: string
  tooltip?: string
}>()

const modelValue = defineModel<boolean>({ default: false })
</script>

<template>
  <LayoutField singleline :label :tooltip>
    <Switch
      v-model="modelValue"
      :aria-label="label"
      class="transition-transform active:scale-90"
    />
  </LayoutField>
</template>
