<template>
  <div class="color-picker-wrapper flex items-center gap-2">
    <ColorPicker v-model="hexValue" class="w-28" v-bind="$attrs" />
    <Input v-model="hexValue" class="w-28" :placeholder="label" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'
import Input from '@/components/ui/input/Input.vue'

const modelValue = defineModel<string>('modelValue')
defineProps<{
  label?: string
}>()

defineOptions({
  inheritAttrs: false
})

// Preserve the PrimeVue ColorPicker storage contract (hex without `#`);
// the underlying picker uses `#`-prefixed hex, so normalize on read.
const hexValue = computed<string>({
  get: () =>
    modelValue.value?.startsWith('#')
      ? modelValue.value
      : `#${modelValue.value ?? '000000'}`,
  set: (next) => {
    modelValue.value = next.replace(/^#/, '')
  }
})
</script>
