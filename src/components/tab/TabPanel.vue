<template>
  <div
    v-if="isActive"
    :id="`tabpanel-${value}`"
    role="tabpanel"
    tabindex="0"
    :aria-labelledby="`tab-${value}`"
  >
    <slot />
  </div>
</template>

<script setup lang="ts" generic="T extends string = string">
import { computed, inject } from 'vue'

import { TAB_LIST_INJECTION_KEY } from './tabKeys'

const { value, modelValue } = defineProps<{
  value: T
  modelValue?: T
}>()

const context = inject(TAB_LIST_INJECTION_KEY, undefined)
const isActive = computed(() =>
  modelValue !== undefined
    ? modelValue === value
    : context?.modelValue.value === value
)
</script>
