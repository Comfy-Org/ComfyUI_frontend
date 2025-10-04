<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import SeedControlPopover from './SeedControlPopover.vue'
import WidgetInputNumberInput from './WidgetInputNumberInput.vue'

defineProps<{
  widget: SimplifiedWidget<number>
  readonly?: boolean
}>()

const modelValue = defineModel<number>({ default: 0 })
const popover = ref()

const togglePopover = (event: Event) => {
  popover.value.toggle(event)
}
</script>

<template>
  <div class="relative">
    <WidgetInputNumberInput
      v-model="modelValue"
      :widget="widget"
      :readonly="readonly"
    />

    <Button
      variant="link"
      size="small"
      class="absolute right-12 top-1/2 -translate-y-1/2 h-4 w-7 p-0 bg-blue-100/30 rounded-xl"
      @click="togglePopover"
    >
      <i class="icon-[lucide--shuffle] text-blue-100" />
    </Button>

    <SeedControlPopover ref="popover" />
  </div>
</template>
