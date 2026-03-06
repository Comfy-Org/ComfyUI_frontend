<template>
  <div
    :class="
      cn(
        'm-0 flex items-center justify-between px-3 py-0 pt-5',
        collapsible && 'cursor-pointer select-none'
      )
    "
    @click="collapsible && toggleCollapse()"
  >
    <h3 class="text-xs font-bold text-text-secondary uppercase">
      {{ title }}
    </h3>
    <i
      v-if="collapsible"
      :class="
        cn(
          'pi text-xs text-text-secondary transition-transform duration-200',
          isCollapsed ? 'pi-chevron-right' : 'pi-chevron-down'
        )
      "
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const {
  title,
  modelValue = false,
  collapsible = false
} = defineProps<{
  title: string
  modelValue?: boolean
  collapsible?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isCollapsed = computed({
  get: () => modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>
