<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { useFormField } from './useFormField'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { errorMessage, formMessageId } = useFormField()
</script>

<template>
  <p
    v-if="errorMessage"
    :id="formMessageId"
    :class="cn('text-[0.8rem] font-medium text-danger', className)"
  >
    {{ errorMessage }}
  </p>
</template>
