<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AttachmentVariants } from './attachment.variants'
import { attachmentVariants } from './attachment.variants'

const { size = 'default', class: className } = defineProps<{
  size?: AttachmentVariants['size']
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="attachment"
    :data-size="size"
    :class="cn(attachmentVariants({ size }), className)"
  >
    <slot />
  </div>
</template>
