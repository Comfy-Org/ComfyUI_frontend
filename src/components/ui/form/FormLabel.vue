<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { useFormField } from './useFormField'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { errorMessage, formItemId } = useFormField()
</script>

<template>
  <label
    :for="formItemId"
    :class="
      cn(
        'text-sm leading-none font-medium',
        errorMessage && 'text-danger',
        className
      )
    "
  >
    <slot />
  </label>
</template>
