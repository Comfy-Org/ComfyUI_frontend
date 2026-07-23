<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { attachmentMediaClass } from './attachment.variants'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="attachment-media"
    :class="cn(attachmentMediaClass, className)"
  >
    <slot />
  </div>
</template>
