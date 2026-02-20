<template>
  <WidgetLayoutField :widget="widget">
    <input
      v-model="modelValue"
      type="password"
      autocomplete="off"
      :class="
        cn(
          WidgetInputBaseClass,
          'w-full text-xs py-2 px-4 truncate min-w-[4ch]'
        )
      "
      :aria-label="widget.name"
    />
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'

defineProps<{
  widget: SimplifiedWidget<string>
}>()

const modelValue = defineModel<string>({ default: '' })
</script>
