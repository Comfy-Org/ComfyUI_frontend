<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { useId, provide } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { FORM_ITEM_ID_INJECTION_KEY } from './injectionKeys'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const id = useId()
provide(FORM_ITEM_ID_INJECTION_KEY, id)
</script>

<template>
  <div :class="cn('space-y-2', className)">
    <slot />
  </div>
</template>
