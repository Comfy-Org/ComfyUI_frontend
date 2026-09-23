<template>
  <thead
    :class="cn('[&_tr]:border-b [&_tr]:border-interface-stroke/60', className)"
  >
    <slot />
  </thead>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>
