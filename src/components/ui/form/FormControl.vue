<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { Slot } from 'reka-ui'

import { cn } from '@/utils/tailwindUtil'

import { useFormField } from './useFormField'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { describedBy, errorMessage, formItemId } = useFormField()
</script>

<template>
  <Slot
    :id="formItemId"
    :aria-describedby="describedBy"
    :aria-invalid="Boolean(errorMessage)"
    :class="cn(className)"
  >
    <slot />
  </Slot>
</template>
